import { Config as V3Config, Payload } from "@0xsequence/wallet-primitives"
import { ethers } from "ethers"
import { useEffect, useState } from "react"
import { addTransaction, subdigestOf, TransactionsEntry } from "./db/Transactions"
import { addMessage, MessageEntry } from "./db/Messages"
import { addTrustedUpdate, updateFromImageHash } from "./db/Updates"
import { mainDB } from "./db/Main"
import { encodeMessageBytes, decodeMessageBytes } from "../helpers/messageBytes"
import { signatureParts } from "../helpers/signatures"

// The Key Machine is Sequence's shared counterfactual state service. It stores
// v3 payloads keyed by digest, so a subdigest URL is enough to recover the full
// transaction, message, or config update on any device.
export const KEY_MACHINE_URL = "https://keymachine.sequence.app"

export type ServiceCall = {
  to: string
  value: string
  data: string
  gasLimit: string
  delegateCall: boolean
  onlyFallback: boolean
  behaviorOnError: string
}

export type ServicePayload =
  | { type: "call"; space: string; nonce: string; calls: ServiceCall[] }
  | { type: "message"; message: string }
  | { type: "config-update"; imageHash: string }
  | { type: "digest"; digest: string }

class NotFoundError extends Error {}

export async function keyMachineRpc<T>(method: string, args: unknown): Promise<T> {
  return rpc<T>(method, args)
}

async function rpc<T>(method: string, args: unknown): Promise<T> {
  const res = await fetch(`${KEY_MACHINE_URL}/rpc/KeyMachine/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => undefined)
    if (res.status === 404 && body?.error === "NotFound") {
      throw new NotFoundError(body?.cause || "not found")
    }
    throw new Error(
      `Key Machine ${method} failed: ${body?.cause || body?.msg || res.status}`
    )
  }

  return res.json()
}

export function txServicePayload(tx: TransactionsEntry): ServicePayload {
  return {
    type: "call",
    space: BigInt(tx.space).toString(),
    nonce: BigInt(tx.nonce).toString(),
    calls: tx.transactions.map((t) => ({
      to: t.to,
      value: BigInt(t.value || 0).toString(),
      data: t.data || "0x",
      gasLimit: BigInt(t.gasLimit || 0).toString(),
      delegateCall: t.delegateCall || false,
      onlyFallback: false,
      behaviorOnError: t.revertOnError ? "revert" : "ignore",
    })),
  }
}

export function messageServicePayload(raw: string): ServicePayload {
  return { type: "message", message: encodeMessageBytes(raw) }
}

export function updateServicePayload(imageHash: string): ServicePayload {
  return { type: "config-update", imageHash }
}

function serviceConfigTree(topology: V3Config.Topology): unknown {
  if (V3Config.isNode(topology)) {
    return [serviceConfigTree(topology[0]), serviceConfigTree(topology[1])]
  } else if (V3Config.isSignerLeaf(topology)) {
    return { weight: topology.weight.toString(), address: topology.address }
  } else if (V3Config.isSapientSignerLeaf(topology)) {
    return { weight: topology.weight.toString(), address: topology.address, imageHash: topology.imageHash }
  } else if (V3Config.isSubdigestLeaf(topology)) {
    return { subdigest: topology.digest }
  } else if (V3Config.isAnyAddressSubdigestLeaf(topology)) {
    return { subdigest: topology.digest, isAnyAddress: true }
  } else if (V3Config.isNestedLeaf(topology)) {
    return {
      weight: topology.weight.toString(),
      threshold: topology.threshold.toString(),
      tree: serviceConfigTree(topology.tree),
    }
  } else if (V3Config.isNodeLeaf(topology)) {
    return topology
  }
  throw new Error("unknown config topology")
}

export function serviceConfig(config: V3Config.Config) {
  return {
    threshold: config.threshold.toString(),
    checkpoint: config.checkpoint.toString(),
    checkpointer: config.checkpointer,
    tree: serviceConfigTree(config.topology),
  }
}

async function savePayload(wallet: string, chainId: string | number, payload: ServicePayload) {
  await rpc("SavePayload", {
    version: 3,
    payload,
    wallet,
    chainID: String(chainId),
  })
}

// Publishing is best effort: failures only cost the URL its portability, so
// they are logged and never surfaced to the caller.
export async function publishTransaction(tx: TransactionsEntry) {
  if (tx.version !== 3) return
  try {
    await savePayload(tx.wallet, tx.chainId, txServicePayload(tx))
  } catch (error) {
    console.warn("Key Machine: failed to publish transaction", error)
  }
}

export async function publishMessage(message: MessageEntry) {
  if (message.version !== 3) return
  try {
    await savePayload(message.wallet, message.chainId, messageServicePayload(message.raw))
  } catch (error) {
    console.warn("Key Machine: failed to publish message", error)
  }
}

// Stores the individual signer signature alongside the payload, creating a
// witness record for the signer. `signature` is the local stored form: its
// optional trailing type byte selects between EIP712 (signed the subdigest
// itself, i.e. typed signing) and EthSign. Config update payloads must carry
// `toConfig`: the Key Machine only stores a digest row once (ON CONFLICT DO
// NOTHING), and a config-update row saved without its target config would
// permanently break the wallet's update chain. For the same reason updates
// are never published through SavePayload.
export async function publishSignature(args: {
  wallet: string
  chainId: string | number
  payload: ServicePayload
  signature: string
  toConfig?: unknown
}) {
  try {
    const parts = signatureParts(args.signature)
    await rpc("SaveSignerSignatures3", {
      wallet: args.wallet,
      payload: args.payload,
      chainID: String(args.chainId),
      signatures: [{
        type: parts.type === "hash" ? "EIP712" : "EthSign",
        signature: parts.signature,
      }],
      toConfig: args.toConfig,
    })
  } catch (error) {
    console.warn("Key Machine: failed to publish signature", error)
  }
}

type PayloadResult = {
  version: number
  payload: ServicePayload
  wallet: string
  chainID: string
}

// The app joins records to wallets by exact string, so a restored entry must
// reuse the casing of a locally tracked wallet when one matches.
async function localWalletCasing(address: string): Promise<string> {
  try {
    const db = await mainDB()
    const wallets = await db.getAll("wallets")
    db.close()
    const match = wallets.find(
      (w) => typeof w.address === "string" && w.address.toLowerCase() === address.toLowerCase()
    )
    return match ? match.address : address
  } catch {
    return address
  }
}

export type KeyMachineHit = "transaction" | "message" | "update"

// Fetches a payload by subdigest and, when it can be represented losslessly as
// a local entry, stores it in IndexedDB. Returns what was found, undefined if
// the Key Machine has nothing usable, and throws on transport errors.
export async function lookupKeyMachine(subdigest: string): Promise<KeyMachineHit | undefined> {
  let result: PayloadResult
  try {
    result = await rpc<PayloadResult>("Payload", { digest: subdigest })
  } catch (error) {
    if (error instanceof NotFoundError) return undefined
    throw error
  }

  if (result.version !== 3 || !result.payload) return undefined
  const wallet = await localWalletCasing(result.wallet)
  const chainId = result.chainID

  switch (result.payload.type) {
    case "call": {
      const entry: TransactionsEntry = {
        version: 3,
        wallet,
        space: result.payload.space,
        nonce: result.payload.nonce,
        chainId,
        transactions: result.payload.calls.map((call) => ({
          to: call.to,
          value: call.value,
          data: call.data,
          gasLimit: call.gasLimit,
          delegateCall: call.delegateCall,
          revertOnError: call.behaviorOnError === "revert",
        })),
      }

      // Reject payloads that do not round-trip (e.g. onlyFallback or abort
      // calls, which enchanter cannot represent)
      if (subdigestOf(entry).toLowerCase() !== subdigest.toLowerCase()) return undefined

      await addTransaction(entry)
      return "transaction"
    }

    case "message": {
      const raw = decodeMessageBytes(result.payload.message)
      if (raw === undefined) return undefined

      const computed = ethers.hexlify(
        Payload.hash(
          wallet as `0x${string}`,
          Number(chainId),
          Payload.fromMessage(result.payload.message as `0x${string}`)
        )
      )
      if (computed.toLowerCase() !== subdigest.toLowerCase()) return undefined

      const entry: MessageEntry = {
        version: 3,
        raw,
        subdigest: computed,
        chainId: Number(chainId),
        wallet,
        digest: ethers.hashMessage(raw),
        firstSeen: Date.now(),
      }

      await addMessage(entry)
      return "message"
    }

    case "config-update": {
      const rich = await updateFromImageHash(wallet, result.payload.imageHash, 3)
      if (rich.subdigest.toLowerCase() !== subdigest.toLowerCase()) return undefined

      await addTrustedUpdate(rich)
      return "update"
    }

    default:
      return undefined
  }
}

export type KeyMachineLookupStatus = "idle" | "searching" | "not-found" | "error"

// Looks up a missing record on the Key Machine. `missing` should be true only
// while the local store has no entry for the subdigest; a successful lookup
// writes to IndexedDB and flips it back through the store notifier.
export function useKeyMachineLookup(subdigest: string | undefined, missing: boolean) {
  const [status, setStatus] = useState<KeyMachineLookupStatus>("idle")
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!missing || !subdigest) {
      setStatus("idle")
      return
    }

    if (!/^0x[0-9a-fA-F]{64}$/.test(subdigest)) {
      setStatus("not-found")
      return
    }

    let cancelled = false
    setStatus("searching")

    // Local IndexedDB reads resolve within a frame or two; the small delay
    // avoids a lookup for records that are present locally.
    const timer = setTimeout(async () => {
      try {
        const hit = await lookupKeyMachine(subdigest)
        if (!cancelled) setStatus(hit ? "idle" : "not-found")
      } catch (error) {
        console.warn("Key Machine: lookup failed", error)
        if (!cancelled) setStatus("error")
      }
    }, 150)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [subdigest, missing, attempt])

  return { status, retry: () => setAttempt((a) => a + 1) }
}
