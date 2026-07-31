import { Payload } from "@0xsequence/wallet-primitives"
import { ethers } from "ethers"
import { useEffect, useRef } from "react"
import { addSignature } from "./db/Signatures"
import { keyMachineRpc } from "./KeyMachine"
import { signatureParts } from "../helpers/signatures"
import { addTrustedUpdate, normalizeImageHash, updateFromImageHash, UpdateEntry, v2UpdateSubdigest } from "./db/Updates"

// Signature mailbox on top of the Key Machine's existing endpoints.
//
// The Key Machine has no "signatures of digest" read, but it does enumerate a
// signer's witnesses — including each witness payload — via Wallets(signer).
// So every subdigest gets a deterministic ephemeral "mailbox" signer that
// anyone holding the URL can derive. Posting a signature means wrapping it in
// a message payload addressed to a fake wallet derived from the envelope
// content and witnessing it with the mailbox key; reading means enumerating
// the mailbox's witnesses. Envelopes are self-authenticating: only the inner
// signature matters, and it is verified against the wallet configuration like
// any manually imported signature.
const MAILBOX_DERIVATION = "enchanter-mailbox-v1"
const ENVELOPE_TYPE = "enchanter-sig-v1"
const UPDATE_ENVELOPE_TYPE = "enchanter-update-v2-v1"

const POLL_INTERVAL = 10_000
const MAX_ENTRIES = 500
const PAGE_SIZE = 100
const MAX_MESSAGE_BYTES = 8 * 1024
const REQUEST_TIMEOUT = 15_000

function mailboxSignerFor(subdigest: string): ethers.Wallet {
  const key = ethers.keccak256(
    ethers.concat([ethers.toUtf8Bytes(MAILBOX_DERIVATION), ethers.getBytes(subdigest)])
  )
  return new ethers.Wallet(key)
}

function normalizeSubdigest(subdigest: string): string {
  if (!ethers.isHexString(subdigest, 32)) {
    throw new Error("Invalid subdigest")
  }
  return ethers.hexlify(ethers.getBytes(subdigest)).toLowerCase()
}

function canonicalWallet(wallet: string): string {
  if (!ethers.isAddress(wallet)) {
    throw new Error("Invalid wallet address")
  }
  return ethers.getAddress(wallet)
}

type MailboxEnvelope = {
  t: string
  s: string
}

async function mailboxRpc<T>(method: string, args: unknown): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  try {
    return await keyMachineRpc<T>(method, args, controller.signal)
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Key Machine ${method} timed out`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

// A mailbox entry is a normal v3 message+witness record. The deterministic
// mailbox signer authenticates the transport only; its signature is never a
// wallet approval or update signature.
async function postEnvelopeToMailbox(subdigest: string, envelope: MailboxEnvelope) {
  const canonicalSubdigest = normalizeSubdigest(subdigest)
  if (envelope.s !== canonicalSubdigest) {
    throw new Error("Mailbox envelope subdigest does not match its route")
  }

  const bytes = ethers.toUtf8Bytes(JSON.stringify(envelope))
  const envelopeHex = ethers.hexlify(bytes)
  const entryWallet = ethers.getAddress("0x" + ethers.keccak256(bytes).slice(-40))
  const digest = Payload.hash(
    entryWallet as `0x${string}`,
    0,
    Payload.fromMessage(envelopeHex as `0x${string}`)
  )

  const mailbox = mailboxSignerFor(canonicalSubdigest)
  const mailboxSignature = await mailbox.signMessage(ethers.getBytes(digest))

  await mailboxRpc("SaveSignerSignatures3", {
    wallet: entryWallet,
    payload: { type: "message", message: envelopeHex },
    chainID: "0",
    signatures: [{ type: "EthSign", signature: mailboxSignature }],
  })
}

// The envelope carries the signer's 65-byte signature over the subdigest,
// optionally tagged with a trailing type byte: "01" for signatures over the
// digest itself (typed signing), "02" for eth_sign. Untagged means eth_sign;
// the reading side normalizes to each version's store format.
export async function postSignatureToMailbox(subdigest: string, signature: string) {
  try {
    const canonicalSubdigest = normalizeSubdigest(subdigest)
    await postEnvelopeToMailbox(canonicalSubdigest, {
      t: ENVELOPE_TYPE,
      s: canonicalSubdigest,
      sig: signature.toLowerCase(),
    } as MailboxEnvelope)
  } catch (error) {
    console.warn("Mailbox: failed to post signature", error)
  }
}

type V2UpdateEnvelope = {
  t: typeof UPDATE_ENVELOPE_TYPE
  s: string
  wallet: string
  imageHash: string
}

function canonicalV2UpdateEnvelope(update: Pick<UpdateEntry, "wallet" | "imageHash" | "subdigest">): V2UpdateEnvelope {
  const wallet = canonicalWallet(update.wallet)
  const imageHash = normalizeImageHash(update.imageHash)
  const subdigest = normalizeSubdigest(update.subdigest)
  if (v2UpdateSubdigest(wallet, imageHash).toLowerCase() !== subdigest) {
    throw new Error("Update metadata does not match its v2 subdigest")
  }

  return { t: UPDATE_ENVELOPE_TYPE, s: subdigest, wallet, imageHash }
}

// Unlike signatures, metadata publication is part of creating a portable v2
// link. It deliberately surfaces errors so callers can offer a retry.
export async function postV2UpdateToMailbox(
  update: Pick<UpdateEntry, "version" | "wallet" | "imageHash" | "subdigest">
): Promise<void> {
  if (update.version !== 2) {
    throw new Error("Only v2 updates can be published to the update mailbox")
  }
  const envelope = canonicalV2UpdateEnvelope(update)
  await postEnvelopeToMailbox(envelope.s, envelope)
}

type WalletsResult = {
  wallets?: { [wallet: string]: unknown }
  cursor: number
}

function mailboxMessage(entry: unknown): string | undefined {
  if (typeof entry !== "object" || entry === null) return undefined
  const payload = (entry as { payload?: unknown }).payload
  if (typeof payload !== "object" || payload === null) return undefined
  const message = payload as { type?: unknown, message?: unknown }
  if (message.type !== "message" || typeof message.message !== "string") return undefined
  if (!/^0x(?:[0-9a-fA-F]{2})*$/.test(message.message)) return undefined
  if ((message.message.length - 2) / 2 > MAX_MESSAGE_BYTES) return undefined
  return message.message
}

// All envelope classes use the same bounded Wallets(signer) scan. Every
// record is treated as untrusted input by its consumer.
async function scanMailboxMessages<T>(
  subdigest: string,
  onMessage: (message: string) => Promise<T | undefined> | T | undefined
): Promise<T | undefined> {
  const canonicalSubdigest = normalizeSubdigest(subdigest)
  const mailbox = mailboxSignerFor(canonicalSubdigest)

  let cursor = 0
  for (let fetched = 0; fetched < MAX_ENTRIES; ) {
    const result = await mailboxRpc<WalletsResult | undefined>("Wallets", {
      signer: mailbox.address,
      cursor,
      limit: PAGE_SIZE,
    })

    const entries = result && typeof result.wallets === "object" && result.wallets !== null
      ? Object.values(result.wallets)
      : []
    for (const entry of entries) {
      const message = mailboxMessage(entry)
      if (!message) continue
      const value = await onMessage(message)
      if (value !== undefined) return value
    }

    fetched += entries.length
    const nextCursor = result?.cursor
    if (entries.length < PAGE_SIZE || typeof nextCursor !== "number" || nextCursor <= cursor) break
    cursor = nextCursor
  }
  return undefined
}

async function fetchMailboxSignatures(subdigest: string): Promise<string[]> {
  const signatures: string[] = []
  await scanMailboxMessages(subdigest, (message) => {
    try {
      const parsed: unknown = JSON.parse(ethers.toUtf8String(message))
      if (typeof parsed !== "object" || parsed === null) return
      const envelope = parsed as { t?: unknown, s?: unknown, sig?: unknown }
      if (envelope.t !== ENVELOPE_TYPE) return
      if (typeof envelope.s !== "string" || envelope.s.toLowerCase() !== subdigest.toLowerCase()) return
      if (typeof envelope.sig !== "string" || !/^0x[0-9a-fA-F]{130}(01|02)?$/.test(envelope.sig)) return
      signatures.push(envelope.sig)
    } catch {
      // Not an enchanter signature envelope; anyone can post to a mailbox.
    }
  })
  return signatures
}

// Pulls co-signer signatures for a subdigest from the mailbox, verifies they
// recover against the subdigest, and merges them into the local store.
// Returns the number of newly added signatures.
export async function syncSignaturesFromMailbox(
  subdigest: string,
  version: 2 | 3
): Promise<number> {
  const candidates = await fetchMailboxSignatures(subdigest)

  let added = 0
  for (const signature of candidates) {
    try {
      // Reject envelopes whose signature does not recover; membership in the
      // wallet configuration is enforced by the weight computation, exactly
      // like manually imported signatures
      const parts = signatureParts(signature)
      if (parts.type === "hash") {
        ethers.recoverAddress(subdigest, parts.signature)
      } else {
        ethers.verifyMessage(ethers.getBytes(subdigest), parts.signature)
      }

      const stored = parts.type === "hash"
        ? parts.signature + "01"
        : version === 3 ? parts.signature : parts.signature + "02"
      if (await addSignature({ subdigest, signature: stored })) {
        added++
      }
    } catch (error) {
      console.warn("Mailbox: skipping envelope", error)
    }
  }

  return added
}

function v2UpdateEnvelopeFromMessage(message: string, requestedSubdigest: string): V2UpdateEnvelope | undefined {
  try {
    const parsed: unknown = JSON.parse(ethers.toUtf8String(message))
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined
    const value = parsed as Record<string, unknown>
    const keys = Object.keys(value)
    if (keys.length !== 4 || !["t", "s", "wallet", "imageHash"].every((key) => keys.includes(key))) {
      return undefined
    }
    if (value.t !== UPDATE_ENVELOPE_TYPE || typeof value.s !== "string" ||
      typeof value.wallet !== "string" || typeof value.imageHash !== "string") {
      return undefined
    }

    const expectedSubdigest = normalizeSubdigest(requestedSubdigest)
    // Metadata uses lower-case hashes and a checksummed wallet so equivalent
    // but non-canonical records cannot become local application state.
    if (value.s !== expectedSubdigest) return undefined
    const wallet = canonicalWallet(value.wallet)
    const imageHash = normalizeImageHash(value.imageHash)
    if (wallet !== value.wallet || imageHash !== value.imageHash) return undefined
    if (v2UpdateSubdigest(wallet, imageHash).toLowerCase() !== expectedSubdigest) return undefined

    return { t: UPDATE_ENVELOPE_TYPE, s: expectedSubdigest, wallet, imageHash }
  } catch {
    return undefined
  }
}

// Restores unsigned v2 update metadata from the deterministic mailbox. A
// record must first be canonical and cryptographically self-consistent, then
// the tracker configuration must independently reproduce its image hash.
export async function lookupV2UpdateFromMailbox(subdigest: string): Promise<"update" | undefined> {
  return scanMailboxMessages(subdigest, async (message) => {
    const envelope = v2UpdateEnvelopeFromMessage(message, subdigest)
    if (!envelope) return undefined

    try {
      const update = await updateFromImageHash(envelope.wallet, envelope.imageHash, 2)
      if (update.subdigest.toLowerCase() !== envelope.s) return undefined
      await addTrustedUpdate(update)
      return "update" as const
    } catch (error) {
      // The mailbox is public and untrusted. A bad config lookup must not
      // abort other records or hydrate local state.
      console.warn("Mailbox: skipping v2 update metadata", error)
      return undefined
    }
  })
}

// Polls the mailbox while `enabled` (typically: while the signature threshold
// is not met). New signatures land in IndexedDB and re-render through the
// store notifier; `onFound` fires with the count of newly synced signatures.
export function useMailboxSignatureSync(args: {
  subdigest: string | undefined
  version: 2 | 3
  enabled: boolean
  onFound?: (added: number) => void
}) {
  const { subdigest, version, enabled } = args
  const onFound = useRef(args.onFound)
  onFound.current = args.onFound

  useEffect(() => {
    if (!enabled || !subdigest || !/^0x[0-9a-fA-F]{64}$/.test(subdigest)) return

    let cancelled = false
    const sync = async () => {
      try {
        const added = await syncSignaturesFromMailbox(subdigest, version)
        if (!cancelled && added > 0) onFound.current?.(added)
      } catch (error) {
        console.warn("Mailbox: signature sync failed", error)
      }
    }

    sync()
    const interval = setInterval(sync, POLL_INTERVAL)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [subdigest, version, enabled])
}
