import { useEffect, useState } from "react"
import { notify, useNotifier } from "./Notifier"
import { mainDB } from "./Main"
import { commons, universal } from "@0xsequence/core"
import { TRACKER } from "../Sequence"

export type UpdateEntry = {
  checkpoint: number,
  wallet: string,
  imageHash: string
  subdigest: string
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
  );
}

export async function updateFromImageHash(wallet: string, imageHash: string) {
  const res = await TRACKER.configOfImageHash({ imageHash })
  if (!res) {
    throw new Error("Failed to fetch config from the tracker")
  }

  const coder = universal.genericCoderFor(res.version)

  const structHash = coder.signature.hashSetImageHash(imageHash)
  const subdigest = commons.signature.subdigestOf({
    digest: structHash,
    chainId: 0,
    address: wallet
  })

  return {
    wallet,
    imageHash,
    subdigest,
    checkpoint: coder.config.checkpointOf(res).toNumber(),
  }
}

export async function addUpdate(entry: Omit<Omit<UpdateEntry, 'checkpoint'>, 'subdigest'>) {
  const rich = await updateFromImageHash(entry.wallet, entry.imageHash)
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

export function useUpdates(args: { wallet: string }) {
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
  }, [notifier.flag])

  return { updates, loading }
}

export function useUpdate(args: { subdigest: string }) {
  const notifier = useNotifier()

  const [update, setUpdate] = useState<UpdateEntry | undefined>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUpdate() {
      setLoading(true)
      const db = await mainDB()
      const entry = await db.get('updates', args.subdigest)

      if (!entry) {
        db.close()
        setUpdate(undefined)
        setLoading(false)
        return
      }

      setUpdate(entry)
      db.close()
      setLoading(false)
    }

    fetchUpdate()
  }, [notifier.flag])

  return { update, loading }
}
