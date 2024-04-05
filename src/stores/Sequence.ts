

import { Orchestrator, signers } from "@0xsequence/signhub";
import { allNetworks } from "@0xsequence/network";
import { trackers } from "@0xsequence/sessions";
import { Account, AccountStatus } from "@0xsequence/account";
import { commons } from "@0xsequence/core";
import { useEffect, useState } from "react";
import { StaticSigner } from "./StaticSigner";
import { useBytecode, usePublicClient, useReadContract } from "wagmi";
import { ethers } from "ethers";
import { parseAbiItem } from "viem";
import { TransactionsEntry, subdigestOf } from "./db/Transactions";

const TRACKER = new trackers.remote.RemoteConfigTracker("https://sessions.sequence.app")
export const NETWORKS = allNetworks

export async function createSequenceWallet(
  threshold: number,
  signers: { address: string, weight: number }[],
  nonce?: number,
): Promise<string> {
  // Check that no signers are sequence wallets
  for (const signer of signers) {
    const res = await TRACKER.imageHashOfCounterfactualWallet({ wallet: signer.address })
    if (res) {
      throw new Error(`${signer.address} is a Sequence Wallet, nesting is not implemented yet.`)
    }
  }

  const account = await Account.new({
    config: {
      threshold,
      // By default a random checkpoint is generated every second
      checkpoint: nonce || Math.floor((Date.now() / 1000) % 2147483647),
      signers: signers
    },
    tracker: TRACKER,
    contexts: commons.context.defaultContexts,
    orchestrator: new Orchestrator([]),
    networks: NETWORKS
  })

  // Try to fetch the config from the tracker
  const reverse1 = await TRACKER.imageHashOfCounterfactualWallet({ wallet: account.address })
  if (!reverse1) {
    throw new Error("Failed to fetch imageHash from the tracker")
  }

  // Try to fetch the imageHash from the tracker
  const reverse2 = await TRACKER.configOfImageHash({ imageHash: reverse1.imageHash })
  if (!reverse2) {
    throw new Error("Failed to fetch config from the tracker")
  }

  return account.address
}

export function accountFor(args: { address: string, signatures?: { signer: string, signature: string }[] }) {
  const signers: signers.SapientSigner[] = []

  if (args.signatures) {
    for (const { signer, signature } of args.signatures) {
      signers.push(new StaticSigner(signer, signature))
    }
  }

  return new Account({
    address: args.address,
    tracker: TRACKER,
    contexts: commons.context.defaultContexts,
    orchestrator: new Orchestrator(signers),
    networks: NETWORKS
  })
}

export function useAccountState(address: string | undefined) {
  const [state, setAccountState] = useState<AccountStatus | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(undefined);

  useEffect(() => {
    async function fetchAccount(address: string) {
      setLoading(true);
      try {
        const account = accountFor({ address })
        const status = await account.status(1)
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
      fetchAccount(address)
    }
  }, [address]); // Re-run the effect if the address changes

  return { state, loading, error };
}

export function useRecovered(subdigest: string, signatures: string[]) {
  const recovered = useState<Map<string, string>>(new Map<string, string>())

  useEffect(() => {
    const res = new Map<string, string>()

    for (const signature of signatures) {
      try {
        const r = commons.signer.recoverSigner(subdigest, signature)
        res.set(r, signature)
      } catch (e) {
        console.error("Failed to recover signature", e)
      }
    }

    recovered[1](res)
  }, [subdigest, signatures])

  return recovered[0]
}

export function useReceipt(tx: TransactionsEntry) {
  const nonce = useReadContract({
    abi: [{
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_space",
          "type": "uint256"
        }
      ],
      "name": "readNonce",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }],
    address: tx.wallet as `0x${string}`,
    functionName: "readNonce",
    args: [ethers.BigNumber.from(tx.space).toBigInt()],
    chainId: ethers.BigNumber.from(tx.chainId).toNumber(),
  })

  const code = useBytecode({
    address: tx.wallet as `0x${string}`,
    chainId: ethers.BigNumber.from(tx.chainId).toNumber(),
  })

  const client = usePublicClient({
    chainId: ethers.BigNumber.from(tx.chainId).toNumber(),
  })

  type Status = 'loading' | 'unknown' | 'pending' | 'replaced' | 'executed' | 'failed'
  const [status, setStatus] = useState<Status>('loading')
  const [receipt, setReceipt] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(undefined)
  const [refreshInt, setRefresh] = useState(0)

  const fail = (error: any) => {
    setStatus("unknown")
    setError(error)
    setReceipt("")
    setLoading(false)
  }

  const success = (status: Status, receipt: string) => {
    setStatus(status)
    setError(undefined)
    setReceipt(receipt)
    setLoading(false)
  }

  const startLoading = () => {
    setStatus("loading")
    setLoading(true)
    setError(undefined)
    setReceipt("")
  }

  useEffect(() => {
    startLoading()
    if (code.isLoading) {
      return
    }

    if (!code.data || code.data?.length === 0) {
      success("pending", "")
      return
    }

    if (nonce.isLoading) {
      return
    }
    
    if (nonce.data !== undefined && nonce.data === ethers.BigNumber.from(tx.nonce).toBigInt()) {
      success("pending", "")
      return
    }

    if (!client) {
      fail("Client not found")
      return
    }

    (async () => {      
      try {
        const fromBlock = 1n

        // Try to fetch the receipt
        // the transaction could have been
        // 1) successfully executed, we will find a TxExecuted event
        // 2) failed to execute, we will find a TxFailed event
        // 3) replaced, we will find no events
        const logsExecuted = await client.getLogs({
          address: tx.wallet as `0x${string}`,
          fromBlock: fromBlock,
          toBlock: "latest",
          event: parseAbiItem("event TxExecuted(bytes32 indexed _tx, uint256 _index)"),
          args: { _tx: subdigestOf(tx) as `0x${string}` },
        })

        if (logsExecuted.length > 0) {
          success("executed", logsExecuted[0].transactionHash)
          return
        }

        const logsFailed = await client.getLogs({
          address: tx.wallet as `0x${string}`,
          fromBlock: 1n,
          toBlock: "latest",
          event: parseAbiItem("event TxFailed(bytes32 indexed _tx, uint256 _index, bytes _reason)"),
          args: { _tx: subdigestOf(tx) as `0x${string}` },
        })

        if (logsFailed.length > 0) {
          success("failed", logsFailed[0].transactionHash)
          return
        }

        success("replaced", "")
      } catch (e) {
        console.error("Failed to fetch receipt", e)
        fail(e)
      }
    })()
  }, [refreshInt, nonce.data, code.data, nonce.isLoading, code.isLoading])

  useEffect(() => {
    if (refreshInt === 0) {
      return
    }

    nonce.refetch()
    code.refetch()
  }, [refreshInt])

  const refresh = () => {
    setRefresh(refreshInt + 1)
  }

  return { receipt, loading, error, refresh, status }
}
