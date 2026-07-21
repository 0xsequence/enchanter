import { Payload } from "@0xsequence/wallet-primitives"
import { commons } from "@0xsequence/core"
import { ethers } from "ethers"
import { useEffect, useState } from "react"
import { keyMachineRpc } from "./KeyMachine"
import { TRACKER } from "./Sequence"
import { WalletEntry } from "./db/Wallets"

// Witnesses are the Key Machine's proof-of-intent records: a signature by a
// signer for a wallet, published so the signer → wallets reverse lookup works.
// Enchanter uses them to auto-detect a connected signer's wallets. Signing any
// transaction already creates a witness as a side effect; publishing one
// explicitly covers wallets the signer has not signed anything for yet.

export async function publishWitness(args: {
  wallet: string
  version: 2 | 3
  signer: string
  signMessage: (digest: Uint8Array) => Promise<string>
}): Promise<void> {
  if (args.version === 3) {
    const statement = JSON.stringify({
      action: "enchanter-witness",
      statement: "I attest that I am a signer of this Sequence wallet",
      wallet: args.wallet,
      signer: args.signer,
      timestamp: new Date().toISOString(),
    })
    const messageHex = ethers.hexlify(ethers.toUtf8Bytes(statement))
    const digest = Payload.hash(
      args.wallet as `0x${string}`,
      0,
      Payload.fromMessage(messageHex as `0x${string}`)
    )
    const signature = await args.signMessage(ethers.getBytes(digest))

    await keyMachineRpc("SaveSignerSignatures3", {
      wallet: args.wallet,
      payload: { type: "message", message: messageHex },
      chainID: "0",
      signatures: [{ type: "EthSign", signature }],
    })
    return
  }

  // v2 follows the Account.publishWitness convention of the Sequence SDK
  const digest = ethers.id(`This is a Sequence account woo! ${Date.now()}`)
  const subdigest = commons.signature.subdigestOf({
    digest,
    chainId: 0,
    address: args.wallet,
  })
  const signature = await args.signMessage(ethers.getBytes(subdigest))

  await TRACKER.saveWitnesses({
    wallet: args.wallet,
    digest,
    chainId: 0,
    signatures: [signature + "02"],
  })
}

// Whether a witness by `signer` for `wallet` is already published
export function useWitnessStatus(
  wallet: string | undefined,
  signer: string | undefined,
  version: 2 | 3 | undefined
) {
  const [published, setPublished] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    setPublished(undefined)
    if (!wallet || !signer || !version) return

    let cancelled = false
    ;(async () => {
      try {
        if (version === 3) {
          await keyMachineRpc("Witness", { signer, wallet })
          if (!cancelled) setPublished(true)
        } else {
          const wallets = await TRACKER.walletsOfSigner({ signer })
          if (!cancelled) {
            setPublished(wallets.some((w) => w.wallet.toLowerCase() === wallet.toLowerCase()))
          }
        }
      } catch {
        // NotFound (or a transient error): treat as not published
        if (!cancelled) setPublished(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [wallet, signer, version])

  return { published, setPublished }
}

const DETECT_PAGE_SIZE = 100
const DETECT_MAX_PAGES = 5

type WalletsResult = { wallets: { [wallet: string]: unknown }; cursor: number }

// All wallets the signer has witnessed, across the Key Machine (v3 and
// anything signed through it) and the v2 sessions tracker
export async function detectWallets(signer: string): Promise<string[]> {
  const [v3Wallets, v2Wallets] = await Promise.all([
    (async () => {
      const found: string[] = []
      let cursor = 0
      for (let page = 0; page < DETECT_MAX_PAGES; page++) {
        const result = await keyMachineRpc<WalletsResult>("Wallets", {
          signer,
          cursor,
          limit: DETECT_PAGE_SIZE,
        })
        const addresses = Object.keys(result.wallets)
        found.push(...addresses)
        if (addresses.length < DETECT_PAGE_SIZE || result.cursor <= cursor) break
        cursor = result.cursor
      }
      return found
    })().catch((error) => {
      console.warn("Witness: Key Machine wallet detection failed", error)
      return [] as string[]
    }),
    TRACKER.walletsOfSigner({ signer })
      .then((result) => result.map((w) => w.wallet))
      .catch((error) => {
        console.warn("Witness: v2 tracker wallet detection failed", error)
        return [] as string[]
      }),
  ])

  const seen = new Map<string, string>()
  for (const address of [...v3Wallets, ...v2Wallets]) {
    try {
      const checksummed = ethers.getAddress(address)
      if (!seen.has(checksummed.toLowerCase())) {
        seen.set(checksummed.toLowerCase(), checksummed)
      }
    } catch {
      // skip malformed addresses
    }
  }
  return [...seen.values()]
}

// Wallets witnessed by the connected signer that are not in the local list
export function useDetectedWallets(signer: string | undefined, existing: WalletEntry[]) {
  const [detected, setDetected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setDetected([])
    if (!signer) return

    let cancelled = false
    setLoading(true)
    detectWallets(signer)
      .then((list) => {
        if (!cancelled) setDetected(list)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [signer])

  return {
    detected: detected.filter(
      (address) => !existing.some((w) => w.address.toLowerCase() === address.toLowerCase())
    ),
    loading,
  }
}
