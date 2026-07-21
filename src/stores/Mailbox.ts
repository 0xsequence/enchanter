import { Payload } from "@0xsequence/wallet-primitives"
import { ethers } from "ethers"
import { useEffect, useRef } from "react"
import { addSignature } from "./db/Signatures"
import { keyMachineRpc } from "./KeyMachine"

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

const POLL_INTERVAL = 10_000
const MAX_ENTRIES = 500
const PAGE_SIZE = 100

function mailboxSignerFor(subdigest: string): ethers.Wallet {
  const key = ethers.keccak256(
    ethers.concat([ethers.toUtf8Bytes(MAILBOX_DERIVATION), ethers.getBytes(subdigest)])
  )
  return new ethers.Wallet(key)
}

// Raw 65-byte personal_sign signature over the subdigest, for both versions
// (the v2 store format appends its type byte on the reading side).
export async function postSignatureToMailbox(subdigest: string, signature: string) {
  try {
    const envelope = ethers.toUtf8Bytes(
      JSON.stringify({ t: ENVELOPE_TYPE, s: subdigest.toLowerCase(), sig: signature.toLowerCase() })
    )
    const envelopeHex = ethers.hexlify(envelope)
    const entryWallet = ethers.getAddress("0x" + ethers.keccak256(envelope).slice(-40))
    const digest = Payload.hash(
      entryWallet as `0x${string}`,
      0,
      Payload.fromMessage(envelopeHex as `0x${string}`)
    )

    const mailbox = mailboxSignerFor(subdigest)
    const mailboxSignature = await mailbox.signMessage(ethers.getBytes(digest))

    await keyMachineRpc("SaveSignerSignatures3", {
      wallet: entryWallet,
      payload: { type: "message", message: envelopeHex },
      chainID: "0",
      signatures: [{ type: "EthSign", signature: mailboxSignature }],
    })
  } catch (error) {
    console.warn("Mailbox: failed to post signature", error)
  }
}

type WalletsResult = {
  wallets: { [wallet: string]: { payload?: { type?: string; message?: string } } }
  cursor: number
}

async function fetchMailboxEnvelopes(subdigest: string): Promise<string[]> {
  const mailbox = mailboxSignerFor(subdigest)
  const signatures: string[] = []

  let cursor = 0
  for (let fetched = 0; fetched < MAX_ENTRIES; ) {
    const result = await keyMachineRpc<WalletsResult>("Wallets", {
      signer: mailbox.address,
      cursor,
      limit: PAGE_SIZE,
    })

    const entries = Object.values(result.wallets)
    for (const entry of entries) {
      if (entry.payload?.type !== "message" || !entry.payload.message) continue
      try {
        const parsed = JSON.parse(ethers.toUtf8String(entry.payload.message))
        if (parsed.t !== ENVELOPE_TYPE) continue
        if (typeof parsed.s !== "string" || parsed.s.toLowerCase() !== subdigest.toLowerCase()) continue
        if (typeof parsed.sig !== "string" || !/^0x[0-9a-fA-F]{130}$/.test(parsed.sig)) continue
        signatures.push(parsed.sig)
      } catch {
        // not an enchanter envelope; anyone can post to a mailbox
      }
    }

    fetched += entries.length
    if (entries.length < PAGE_SIZE || result.cursor <= cursor) break
    cursor = result.cursor
  }

  return signatures
}

// Pulls co-signer signatures for a subdigest from the mailbox, verifies they
// recover against the subdigest, and merges them into the local store.
// Returns the number of newly added signatures.
export async function syncSignaturesFromMailbox(
  subdigest: string,
  version: 2 | 3
): Promise<number> {
  const candidates = await fetchMailboxEnvelopes(subdigest)

  let added = 0
  for (const signature of candidates) {
    try {
      // Reject envelopes whose signature does not recover; membership in the
      // wallet configuration is enforced by the weight computation, exactly
      // like manually imported signatures
      ethers.verifyMessage(ethers.getBytes(subdigest), signature)

      const stored = version === 3 ? signature : signature + "02"
      if (await addSignature({ subdigest, signature: stored })) {
        added++
      }
    } catch (error) {
      console.warn("Mailbox: skipping envelope", error)
    }
  }

  return added
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
