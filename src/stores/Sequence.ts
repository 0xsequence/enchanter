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
import { PublicClient, parseSignature } from "viem";
import { TransactionsEntry, subdigestOf } from "./db/Transactions";
import { MessageEntry } from "./db/Messages";
import { encodeMessageBytes } from "../helpers/messageBytes";
import { signatureParts } from "../helpers/signatures";
import { LocatedExecution, READ_NONCE_ABI, locateExecution } from "../helpers/receipts";
import { saveReceipt, useStoredReceipt } from "./db/Receipts";

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
    const parts = signatureParts(signature);
    const parsed = parseSignature(parts.signature as `0x${string}`);
    return {
      address: address as `0x${string}`,
      signature: {
        type: parts.type,
        r: BigInt(parsed.r),
        s: BigInt(parsed.s),
        yParity: parsed.yParity,
      },
    };
  });
}

// EIP-712 typed data whose hash is the entry's subdigest, so signers see the
// actual payload in their wallet instead of an opaque digest.
export function v3TransactionTypedData(transaction: TransactionsEntry) {
  return Payload.toTyped(
    transaction.wallet as `0x${string}`,
    Number(transaction.chainId),
    Payload.fromCall(
      BigInt(transaction.nonce),
      BigInt(transaction.space),
      toV3Calls(transaction.transactions)
    )
  );
}

export function v3MessageTypedData(message: MessageEntry) {
  return Payload.toTyped(
    message.wallet as `0x${string}`,
    Number(message.chainId),
    Payload.fromMessage(encodeMessageBytes(message.raw) as `0x${string}`)
  );
}

export function v3UpdateTypedData(wallet: string, imageHash: string) {
  return Payload.toTyped(
    wallet as `0x${string}`,
    0,
    Payload.fromConfigUpdate(imageHash as `0x${string}`)
  );
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
        let r: string;
        if (version === 3) {
          const parts = signatureParts(signature);
          r = parts.type === "hash"
            ? ethers.recoverAddress(subdigest, parts.signature)
            : ethers.verifyMessage(ethers.getBytes(subdigest), parts.signature);
        } else {
          r = commons.signer.recoverSigner(subdigest, signature);
        }
        res.set(ethers.getAddress(r), signature);
      } catch (e) {
        console.error("Failed to recover signature", e);
      }
    }

    recovered[1](res);
  }, [subdigest, signatures, version]);

  return recovered[0];
}

export type ReceiptStatus =
  | "loading"
  | "unknown"
  | "pending"
  | "replaced"
  | "executed"
  | "failed"
  | "consumed";

export function useReceipt(tx: TransactionsEntry) {
  const connectedAccount = useAccount();
  const receiptChainId = tx.chainId === "0"
    ? connectedAccount.chainId
    : Number(tx.chainId);

  const subdigest = subdigestOf(tx);

  // Receipts are immutable on-chain facts: once one is stored, no RPC
  // traffic is needed ever again for this transaction on this chain.
  const stored = useStoredReceipt(subdigest, receiptChainId);

  const [refreshInt, setRefresh] = useState(0);
  const [located, setLocated] = useState<{ key: string; result: LocatedExecution } | undefined>();
  const locateKey = `${subdigest}:${receiptChainId}:${refreshInt}`;

  const settled = stored.entry !== undefined || located?.key === locateKey;

  // The wallet's nonce is the authoritative signal: while readNonce(space)
  // stays at or below the transaction's nonce it can still be executed, and
  // the moment it goes past it can never execute again. Poll it until the
  // outcome is settled.
  const tracking = receiptChainId !== undefined && !stored.loading && !settled;
  const nonce = useReadContract({
    abi: READ_NONCE_ABI,
    address: tx.wallet as `0x${string}`,
    functionName: "readNonce",
    args: [BigInt(tx.space)],
    chainId: receiptChainId,
    query: {
      enabled: tracking,
      refetchInterval: 6_000,
      refetchOnWindowFocus: true,
    },
  });

  const code = useBytecode({
    address: tx.wallet as `0x${string}`,
    chainId: receiptChainId,
    query: {
      enabled: tracking,
      refetchInterval: 15_000,
    },
  });

  const client = usePublicClient({
    chainId: receiptChainId,
  });

  // wagmi reports "no code" as null rather than undefined
  const deployed = code.data != null && code.data.length > 0;
  const consumed =
    deployed &&
    nonce.data != null &&
    nonce.data > BigInt(tx.nonce);

  useEffect(() => {
    if (!consumed || !client || settled) {
      return;
    }

    let cancelled = false;

    (async () => {
      let result: LocatedExecution;
      try {
        result = await locateExecution(client as PublicClient, {
          wallet: tx.wallet,
          space: tx.space,
          nonce: tx.nonce,
          subdigest,
          version: tx.version,
        });
      } catch (e) {
        console.error("Failed to locate the execution receipt", e);
        result = { status: "consumed", txHash: "" };
      }

      if (cancelled) return;

      if (result.status !== "consumed" && receiptChainId !== undefined) {
        await saveReceipt({
          subdigest,
          chainId: receiptChainId,
          status: result.status,
          txHash: result.txHash,
          blockNumber: result.blockNumber,
        });
      }

      if (!cancelled) {
        setLocated({ key: locateKey, result });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [consumed, client, settled, locateKey, subdigest, receiptChainId, tx.wallet, tx.space, tx.nonce, tx.version]);

  let status: ReceiptStatus;
  let receipt = "";
  let loading = false;
  let locating = false;
  let error: unknown = undefined;

  if (stored.entry !== undefined) {
    status = stored.entry.status;
    receipt = stored.entry.txHash;
  } else if (located?.key === locateKey) {
    status = located.result.status;
    receipt = located.result.txHash;
  } else if (consumed) {
    // The nonce is spent, so this is final even before the receipt is found:
    // report it right away and locate the transaction hash in the background
    status = "consumed";
    locating = true;
  } else if (receiptChainId === undefined) {
    status = "unknown";
    error = "Connect a wallet to determine the execution network";
  } else if (stored.loading) {
    status = "loading";
    loading = true;
  } else if (code.isError) {
    status = "unknown";
    error = code.error;
  } else if (!code.isFetched) {
    status = "loading";
    loading = true;
  } else if (!deployed) {
    // The wallet is not deployed yet, so nothing could have been consumed
    status = "pending";
  } else if (nonce.isError) {
    status = "unknown";
    error = nonce.error;
  } else if (nonce.data == null) {
    status = "loading";
    loading = true;
  } else {
    status = "pending";
  }

  const refresh = () => {
    setLocated(undefined);
    setRefresh(refreshInt + 1);
    nonce.refetch();
    code.refetch();
  };

  return { receipt, loading, locating, error, refresh, status };
}
