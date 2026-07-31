import { useEffect, useState } from "react"
import { notify, useNotifier } from "./Notifier"
import { mainDB } from "./Main"
import { commons, universal } from "@0xsequence/core"
import { TRACKER } from "../Sequence"
import { Payload } from "@0xsequence/wallet-primitives"
import { ethers } from "ethers"
import { V3_STATE_PROVIDER } from "../Sequence"

export type UpdateEntry = {
  version?: 2 | 3,
  checkpoint: number,
  wallet: string,
  imageHash: string
  subdigest: string
}

function canonicalWallet(wallet: string): string {
  if (!ethers.isAddress(wallet)) {
    throw new Error("Invalid wallet address")
  }
  return ethers.getAddress(wallet)
}

async function walletCasingForStorage(wallet: string): Promise<string> {
  try {
    const db = await mainDB()
    const wallets = await db.getAll("wallets")
    db.close()
    const match = wallets.find(
      (entry) => typeof entry.address === "string" &&
        entry.address.toLowerCase() === wallet.toLowerCase()
    )
    return match ? match.address : wallet
  } catch {
    return wallet
  }
}

export function normalizeImageHash(imageHash: string): string {
  if (!ethers.isHexString(imageHash, 32)) {
    throw new Error("Invalid image hash")
  }
  return ethers.hexlify(ethers.getBytes(imageHash)).toLowerCase()
}

// v2 config updates are a SetImageHash signature payload on chain 0. Keeping
// this derivation beside update hydration makes every path use the same
// canonical wallet and image hash representation.
export function v2UpdateSubdigest(wallet: string, imageHash: string): string {
  const canonicalAddress = canonicalWallet(wallet)
  const normalizedImageHash = normalizeImageHash(imageHash)
  const digest = universal.genericCoderFor(2).signature.hashSetImageHash(normalizedImageHash)
  return commons.signature.subdigestOf({
    digest,
    chainId: 0,
    address: canonicalAddress,
  })
}

export function isUpdateEntry(entry: unknown): entry is UpdateEntry {
  if (typeof entry !== 'object' || entry === null) {
    return false;
  }

  const e = entry as Record<string, unknown>;

  return (
    typeof e.checkpoint === 'number' &&
    typeof e.wallet === 'string' &&
    typeof e.imageHash === 'string' &&
    typeof e.subdigest === 'string'
    && (e.version === undefined || e.version === 2 || e.version === 3)
  );
}

export async function updateFromImageHash(wallet: string, imageHash: string, version: 2 | 3 = 2) {
  const canonicalAddress = canonicalWallet(wallet)
  const storedWallet = await walletCasingForStorage(wallet)
  const normalizedImageHash = normalizeImageHash(imageHash)

  if (version === 3) {
    const config = await V3_STATE_PROVIDER.getConfiguration(normalizedImageHash as `0x${string}`)
    if (!config) {
      throw new Error("Failed to fetch v3 config from the state provider")
    }

    const payload = Payload.fromConfigUpdate(normalizedImageHash as `0x${string}`)
    return {
      version,
      wallet: storedWallet,
      imageHash: normalizedImageHash,
      subdigest: ethers.hexlify(Payload.hash(canonicalAddress as `0x${string}`, 0, payload)),
      checkpoint: Number(config.checkpoint),
    }
  }

  const res = await TRACKER.configOfImageHash({ imageHash: normalizedImageHash })
  if (!res) {
    throw new Error("Failed to fetch config from the tracker")
  }

  if (res.version !== 2) {
    throw new Error("Tracker configuration is not a v2 configuration")
  }

  const coder = universal.genericCoderFor(2)
  const computedImageHash = normalizeImageHash(coder.config.imageHashOf(res))
  if (computedImageHash !== normalizedImageHash) {
    throw new Error("Tracker configuration does not match image hash")
  }

  return {
    version: 2 as const,
    wallet: storedWallet,
    imageHash: normalizedImageHash,
    subdigest: v2UpdateSubdigest(canonicalAddress, normalizedImageHash),
    checkpoint: Number(coder.config.checkpointOf(res)),
  }
}

export async function addUpdate(entry: Omit<Omit<UpdateEntry, 'checkpoint'>, 'subdigest'>) {
  const rich = await updateFromImageHash(entry.wallet, entry.imageHash, entry.version)
  const res = await addTrustedUpdate(rich)
  return { ...rich, isNew: res }
}

export async function addTrustedUpdate(entry: UpdateEntry) {
  const db = await mainDB()
  const exist = await db.get('updates', entry.subdigest)
  if (exist) {
    db.close()
    return false
  }

  await db.add('updates', entry)
  db.close()
  notify()

  return true
}

export function useUpdates(args: { wallet: string | undefined }) {
  const notifier = useNotifier()

  const [updates, setUpdates] = useState<UpdateEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUpdates() {
      setLoading(true)
      const db = await mainDB()
      const txs = await db.getAllFromIndex('updates', 'wallet', args.wallet)
      setUpdates(txs)
      db.close()
      setLoading(false)
    }

    fetchUpdates()
  }, [notifier.flag, args.wallet])

  return { updates, loading }
}

export function useUpdate(args: { subdigest: string | undefined }) {
  const notifier = useNotifier()

  const [update, setUpdate] = useState<UpdateEntry | undefined>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchUpdate() {
      setLoading(true)
      const db = await mainDB()
      const key = args.subdigest && ethers.isHexString(args.subdigest, 32)
        ? args.subdigest.toLowerCase()
        : args.subdigest ?? ""
      const entry = await db.get('updates', key)

      if (!entry) {
        db.close()
        if (!cancelled) {
          setUpdate(undefined)
          setLoading(false)
        }
        return
      }

      db.close()
      if (!cancelled) {
        setUpdate(entry)
        setLoading(false)
      }
    }

    fetchUpdate()
    return () => {
      cancelled = true
    }
  }, [notifier.flag, args.subdigest])

  return { update, loading }
}
