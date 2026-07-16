/* eslint-disable */
import { Orchestrator, signers } from "@0xsequence/signhub";
import { allNetworks } from "@0xsequence/network";
import { trackers } from "@0xsequence/sessions";
import { Account, AccountStatus } from "@0xsequence/account";
import { commons, universal } from "@0xsequence/core";
import { State, Wallet, WalletStatus, WalletStatusWithOnchain } from "@0xsequence/wallet-core";
import { Config as V3Config, Context, Payload } from "@0xsequence/wallet-primitives";
import { useEffect, useState } from "react";
import { StaticSigner } from "./StaticSigner";
import { useAccount, useBytecode, usePublicClient, useReadContract } from "wagmi";
import { ethers } from "ethers";
import { parseAbiItem, parseSignature } from "viem";
import { TransactionsEntry, subdigestOf } from "./db/Transactions";

export type WalletVersion = 2 | 3;
export type V3Provider = Parameters<Wallet["prepareTransaction"]>[0];

export type WalletSigner = {
  address: string;
  weight: number;
};

export type UnifiedAccountState = {
  version: WalletVersion;
  address: string;
  config: unknown;
  signers: WalletSigner[];
  threshold: number;
  checkpoint: bigint;
  imageHash: string;
  deployed: boolean;
  pendingUpdates: number;
  legacy?: AccountStatus;
  v3?: WalletStatus | WalletStatusWithOnchain;
};

export const TRACKER = new trackers.remote.RemoteConfigTracker(
  "https://sessions.sequence.app"
);
export const NETWORKS = allNetworks;
export const V3_STATE_PROVIDER = new State.Sequence.Provider();

export function v3WalletFor(address: string) {
  return new Wallet(address as `0x${string}`, {
    stateProvider: V3_STATE_PROVIDER,
  });
}

export function toV3Config(
  threshold: number,
  checkpoint: bigint,
  walletSigners: WalletSigner[]
): V3Config.Config {
  return {
    threshold: BigInt(threshold),
    checkpoint,
    topology: V3Config.flatLeavesToTopology(
      walletSigners.map((signer) => ({
        type: "signer" as const,
        address: signer.address as `0x${string}`,
        weight: BigInt(signer.weight),
      }))
    ),
  };
}

export function v3SignersOf(config: V3Config.Config): WalletSigner[] {
  const result: WalletSigner[] = [];
  const visit = (topology: V3Config.Topology) => {
    if (Array.isArray(topology)) {
      visit(topology[0]);
      visit(topology[1]);
      return;
    }
    if (!V3Config.isSignerLeaf(topology)) {
      throw new Error(
        "This Sequence v3 configuration is not a simple weighted multisig"
      );
    }
    result.push({
      address: topology.address,
      weight: Number(topology.weight),
    });
  };
  visit(config.topology);
  return result;
}

export function v3PayloadHash(
  wallet: string,
  chainId: number,
  payload: Payload.Parented
): string {
  return ethers.hexlify(
    Payload.hash(wallet as `0x${string}`, chainId, payload)
  );
}

export function v3EnvelopeSignatures(recovered: Map<string, string>) {
  return Array.from(recovered, ([address, signature]) => {
    const parsed = parseSignature(signature as `0x${string}`);
    return {
      address: address as `0x${string}`,
      signature: {
        type: "eth_sign" as const,
        r: BigInt(parsed.r),
        s: BigInt(parsed.s),
        yParity: parsed.yParity,
      },
    };
  });
}

export function toV3Calls(transactions: TransactionsEntry["transactions"]): Payload.Call[] {
  return transactions.map((transaction) => ({
    to: transaction.to as `0x${string}`,
    value: BigInt(transaction.value || 0),
    data: (transaction.data || "0x") as `0x${string}`,
    gasLimit: BigInt(transaction.gasLimit || 0),
    delegateCall: transaction.delegateCall || false,
    onlyFallback: false,
    behaviorOnError: transaction.revertOnError ? "revert" : "ignore",
  }));
}

export function v3TransactionEnvelope(
  transaction: TransactionsEntry,
  state: UnifiedAccountState
) {
  if (state.version !== 3) {
    throw new Error("Not a Sequence v3 wallet");
  }

  return {
    wallet: transaction.wallet as `0x${string}`,
    chainId: Number(transaction.chainId),
    configuration: state.config as V3Config.Config,
    payload: Payload.fromCall(
      BigInt(transaction.nonce),
      BigInt(transaction.space),
      toV3Calls(transaction.transactions)
    ),
  };
}

function normalizeV2(address: string, status: AccountStatus): UnifiedAccountState {
  if (status.original.version !== 2) {
    throw new Error(`Unsupported Sequence wallet version ${status.original.version}`);
  }
  const coder = universal.genericCoderFor(status.config.version);
  return {
    version: 2,
    address,
    config: status.config,
    signers: coder.config.signersOf(status.config),
    threshold: Number((status.config as { threshold?: number }).threshold || 0),
    checkpoint: coder.config.checkpointOf(status.config),
    imageHash: coder.config.imageHashOf(status.config),
    deployed: status.onChain.deployed,
    pendingUpdates: status.presignedConfigurations.length,
    legacy: status,
  };
}

function normalizeV3(
  status: WalletStatus | WalletStatusWithOnchain
): UnifiedAccountState {
  return {
    version: 3,
    address: status.address,
    config: status.configuration,
    signers: v3SignersOf(status.configuration),
    threshold: Number(status.configuration.threshold),
    checkpoint: status.configuration.checkpoint,
    imageHash: status.imageHash,
    deployed: status.isDeployed,
    pendingUpdates: status.pendingUpdates.length,
    v3: status,
  };
}

export async function accountStateFor(
  address: string,
  network: number = 1,
  version?: WalletVersion,
  provider?: unknown
): Promise<UnifiedAccountState> {
  let v3Error: unknown;

  if (version !== 2) {
    try {
      const wallet = v3WalletFor(address);
      const status = provider
        ? await wallet.getStatus(provider as V3Provider)
        : await wallet.getStatus();
      return normalizeV3(status);
    } catch (error) {
      v3Error = error;
      if (version === 3) throw error;
    }
  }

  try {
    return normalizeV2(address, await accountFor({ address }).status(network));
  } catch (error) {
    if (v3Error) {
      throw new Error(
        `Wallet was not found as Sequence v2 or v3. v3: ${String(v3Error)}; v2: ${String(error)}`
      );
    }
    throw error;
  }
}

export async function noNesting(signers: { address: string }[]) {
  // Check that no signers are sequence wallets
  for (const signer of signers) {
    let res: { imageHash: string } | undefined = undefined;

    try {
      res = await TRACKER.imageHashOfCounterfactualWallet({
        wallet: signer.address,
      });
    } catch {}

    if (res !== undefined && res.imageHash !== undefined) {
      throw new Error(
        `${signer.address} is a Sequence Wallet, nesting is not implemented yet.`
      );
    }

    try {
      const deploy = await V3_STATE_PROVIDER.getDeploy(
        signer.address as `0x${string}`
      );
      if (deploy) {
        throw new Error(
          `${signer.address} is a Sequence Wallet, nesting is not implemented yet.`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("nesting")) {
        throw error;
      }
    }
  }
}

export async function createSequenceWallet(
  threshold: number,
  signers: { address: string; weight: number }[],
  nonce?: number,
  version: WalletVersion = 2
): Promise<string> {
  await noNesting(signers);

  const checkpoint = nonce ?? Math.floor((Date.now() / 1000) % 2147483647);

  if (version === 3) {
    const config = toV3Config(threshold, BigInt(checkpoint), signers);
    const wallet = await Wallet.fromConfiguration(config, {
      context: Context.Rc5,
      stateProvider: V3_STATE_PROVIDER,
    });

    await wallet.getStatus();
    return wallet.address;
  }

  const account = await Account.new({
    config: {
      threshold,
      // By default a random checkpoint is generated every second
      checkpoint,
      signers: signers,
    },
    tracker: TRACKER,
    contexts: commons.context.defaultContexts,
    orchestrator: new Orchestrator([]),
    networks: NETWORKS,
  });

  // Try to fetch the config from the tracker
  const reverse1 = await TRACKER.imageHashOfCounterfactualWallet({
    wallet: account.address,
  });
  if (!reverse1) {
    throw new Error("Failed to fetch imageHash from the tracker");
  }

  // Try to fetch the imageHash from the tracker
  const reverse2 = await TRACKER.configOfImageHash({
    imageHash: reverse1.imageHash,
  });
  if (!reverse2) {
    throw new Error("Failed to fetch config from the tracker");
  }

  return account.address;
}

export function accountFor(args: {
  address: string;
  signatures?: { signer: string; signature: string }[];
}) {
  const signers: signers.SapientSigner[] = [];

  if (args.signatures) {
    for (const { signer, signature } of args.signatures) {
      // Some ECDSA libraries may return the signature with `v` as 0x00 or 0x01
      // but the Sequence protocol expects it to be 0x1b or 0x1c. We need to
      // adjust the signature to match the protocol.
      let signatureArr = ethers.getBytes(signature);
      if (
        signatureArr.length === 66 &&
        (signatureArr[64] === 0 || signatureArr[64] === 1)
      ) {
        signatureArr[64] = signatureArr[64] + 27;
      }

      signers.push(
        new StaticSigner(signer, ethers.hexlify(signatureArr))
      );
    }
  }

  return new Account({
    address: args.address,
    tracker: TRACKER,
    contexts: commons.context.defaultContexts,
    orchestrator: new Orchestrator(signers),
    networks: NETWORKS,
  });
}

export async function updateAccount(args: {
  address: string;
  threshold: number;
  signers: { address: string; weight: number }[];
  version?: WalletVersion;
}) {
  await noNesting(args.signers);

  if (args.version === 3) {
    const wallet = v3WalletFor(args.address);
    const status = await wallet.getStatus();
    const checkpoint = status.configuration.checkpoint + 1n;
    const nextConfig = toV3Config(args.threshold, checkpoint, args.signers);
    await wallet.prepareUpdate(nextConfig);
    const imageHash = ethers.hexlify(V3Config.hashConfiguration(nextConfig));
    return { imageHash, checkpoint };
  }

  const account = accountFor({ address: args.address });
  const status = await account.status(1);

  const coders = universal.genericCoderFor(status.config.version);

  const checkpoint = coders.config.checkpointOf(status.config) + BigInt(1);
  const nextConfig = coders.config.fromSimple({
    threshold: args.threshold,
    signers: args.signers,
    checkpoint,
  });

  if (!coders.config.isComplete(nextConfig)) {
    throw new Error("Config is incomplete");
  }

  const imageHash = coders.config.imageHashOf(nextConfig);

  // Publish everything to the tracker
  await TRACKER.saveWalletConfig({ config: nextConfig });

  return { imageHash, checkpoint };
}

export function useAccountState(
  address: string | undefined,
  network: number = 1,
  version?: WalletVersion
) {
  const [state, setAccountState] = useState<UnifiedAccountState | undefined>(
    undefined
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(undefined);
  const publicClient = usePublicClient({
    chainId: network === 0 ? undefined : network,
  });

  useEffect(() => {
    async function fetchAccount(address: string) {
      setLoading(true);
      setAccountState(undefined);
      setError(undefined);

      try {
        const status = await accountStateFor(
          address,
          network,
          version,
          network === 0 ? undefined : publicClient
        );
        setAccountState(status);
        setError(undefined); // Reset error state in case of successful load
      } catch (err: any) {
        setError(err);
        setAccountState(undefined); // Reset account state in case of error
      } finally {
        setLoading(false);
      }
    }

    if (address) {
      fetchAccount(address);
    }
  }, [address, network, version, publicClient]); // Re-run the effect if the address changes

  return { state, loading, error };
}

export function useWalletConfig(imageHash: string, version: WalletVersion = 2) {
  const [config, setConfig] = useState<any | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(undefined);

  useEffect(() => {
    async function fetchConfig(imageHash: string) {
      setLoading(true);
      try {
        const res = version === 3
          ? await V3_STATE_PROVIDER.getConfiguration(imageHash as `0x${string}`)
          : await TRACKER.configOfImageHash({ imageHash });
        setConfig(res);
        setError(undefined);
      } catch (err: any) {
        setError(err);
        setConfig(undefined);
      } finally {
        setLoading(false);
      }
    }

    fetchConfig(imageHash);
  }, [imageHash, version]);

  return { config, loading, error };
}

export function useRecovered(
  subdigest: string,
  signatures: string[],
  version: WalletVersion = 2
) {
  const recovered = useState<Map<string, string>>(new Map<string, string>());

  useEffect(() => {
    const res = new Map<string, string>();

    for (const signature of signatures) {
      try {
        const r = version === 3
          ? ethers.verifyMessage(ethers.getBytes(subdigest), signature)
          : commons.signer.recoverSigner(subdigest, signature);
        res.set(ethers.getAddress(r), signature);
      } catch (e) {
        console.error("Failed to recover signature", e);
      }
    }

    recovered[1](res);
  }, [subdigest, signatures, version]);

  return recovered[0];
}

export function useReceipt(tx: TransactionsEntry) {
  const connectedAccount = useAccount();
  const receiptChainId = tx.chainId === "0"
    ? connectedAccount.chainId
    : Number(tx.chainId);
  const nonce = useReadContract({
    abi: [
      {
        inputs: [
          {
            internalType: "uint256",
            name: "_space",
            type: "uint256",
          },
        ],
        name: "readNonce",
        outputs: [
          {
            internalType: "uint256",
            name: "",
            type: "uint256",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
    ],
    address: tx.wallet as `0x${string}`,
    functionName: "readNonce",
    args: [BigInt(tx.space)],
    chainId: receiptChainId,
  });

  const code = useBytecode({
    address: tx.wallet as `0x${string}`,
    chainId: receiptChainId,
  });

  const client = usePublicClient({
    chainId: receiptChainId,
  });

  type Status =
    | "loading"
    | "unknown"
    | "pending"
    | "replaced"
    | "executed"
    | "failed";
  const [status, setStatus] = useState<Status>("loading");
  const [receipt, setReceipt] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(undefined);
  const [refreshInt, setRefresh] = useState(0);

  const fail = (error: any) => {
    setStatus("unknown");
    setError(error);
    setReceipt("");
    setLoading(false);
  };

  const success = (status: Status, receipt: string) => {
    setStatus(status);
    setError(undefined);
    setReceipt(receipt);
    setLoading(false);
  };

  const startLoading = () => {
    setStatus("loading");
    setLoading(true);
    setError(undefined);
    setReceipt("");
  };

  useEffect(() => {
    startLoading();
    if (code.isLoading) {
      return;
    }

    if (!code.data || code.data?.length === 0) {
      success("pending", "");
      return;
    }

    if (nonce.isLoading) {
      return;
    }

    if (
      nonce.data !== undefined &&
      nonce.data === BigInt(tx.nonce)
    ) {
      success("pending", "");
      return;
    }

    if (!client) {
      fail("Client not found");
      return;
    }

    (async () => {
      try {
        const currentBlock = await client.getBlockNumber();
        const recentFromBlock = currentBlock > 10000n ? currentBlock - 10000n : 0n;
        const logRanges = [{ fromBlock: recentFromBlock, toBlock: currentBlock }];

        try {
          const txCreatedBlockReq = await fetch(
            "https://api.sequence.app/rpc/API/BlockNumberAtTime",
            {
              method: "POST",
              headers: {
                "X-Access-Key": "AQAAAAAAAJ34xUT-MXAgwfvO0h2r5DciJYE",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                chainId: receiptChainId || client.chain.id,
                timestamps: [Number(tx.space.slice(0, 10))],
              }),
            }
          );

          if (txCreatedBlockReq.ok) {
            const { blocks } = await txCreatedBlockReq.json();
            if (Array.isArray(blocks) && blocks[0] !== undefined) {
              const fromBlock = BigInt(blocks[0]);
              logRanges.unshift({
                fromBlock,
                toBlock: fromBlock + 10000n > currentBlock
                  ? currentBlock
                  : fromBlock + 10000n,
              });
            }
          }
        } catch (error) {
          console.warn("Failed to find the transaction creation block", error);
        }

        const executedLogsReq = logRanges.map(({ fromBlock, toBlock }) =>
          client.getLogs({
            address: tx.wallet as `0x${string}`,
            fromBlock,
            toBlock,
            event: parseAbiItem(tx.version === 3
              ? "event CallSucceeded(bytes32 indexed _opHash, uint256 _index)"
              : "event TxExecuted(bytes32 indexed _tx, uint256 _index)"),
            args: tx.version === 3
              ? { _opHash: subdigestOf(tx) as `0x${string}` }
              : { _tx: subdigestOf(tx) as `0x${string}` },
          } as any)
        );

        // Try to fetch the receipt
        // the transaction could have been
        // 1) successfully executed, we will find a TxExecuted event
        // 2) failed to execute, we will find a TxFailed event
        // 3) replaced, we will find no events
        const logsExecuted = await Promise.all(executedLogsReq);

        for (const log of logsExecuted) {
          if (log.length > 0) {
            success("executed", log[0].transactionHash);
            return;
          }
        }

        const failedLogsReq = logRanges.map(({ fromBlock, toBlock }) =>
          client.getLogs({
            address: tx.wallet as `0x${string}`,
            fromBlock,
            toBlock,
            event: parseAbiItem(tx.version === 3
              ? "event CallFailed(bytes32 indexed _opHash, uint256 _index, bytes _returnData)"
              : "event TxFailed(bytes32 indexed _tx, uint256 _index, bytes _reason)"),
            args: tx.version === 3
              ? { _opHash: subdigestOf(tx) as `0x${string}` }
              : { _tx: subdigestOf(tx) as `0x${string}` },
          } as any)
        );

        const logsFailed = await Promise.all(failedLogsReq);

        for (const log of logsFailed) {
          if (log.length > 0) {
            success("failed", log[0].transactionHash);
            return;
          }
        }

        success("replaced", "");
      } catch (e) {
        console.error("Failed to fetch receipt", e);
        fail(e);
      }
    })();
  }, [refreshInt, nonce.data, code.data, nonce.isLoading, code.isLoading]);

  useEffect(() => {
    if (refreshInt === 0) {
      return;
    }

    nonce.refetch();
    code.refetch();
  }, [refreshInt]);

  const refresh = () => {
    setRefresh(refreshInt + 1);
  };

  return { receipt, loading, error, refresh, status };
}
