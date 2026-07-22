import { useEffect, useState } from "react"
import { mainDB } from "./Main"
import { notify, useNotifier } from "./Notifier"

// Execution receipts are immutable on-chain facts: once a payload is seen
// executed (or failed, or its nonce proven consumed by a different payload),
// store it and never search again.
export type ReceiptEntry = {
  key: string
  subdigest: string
  chainId: number
  status: "executed" | "failed" | "replaced"
  txHash: string
  blockNumber?: string
}

export function receiptKey(subdigest: string, chainId: number): string {
  return `${subdigest.toLowerCase()}:${chainId}`
}

export async function saveReceipt(args: {
  subdigest: string
  chainId: number
  status: "executed" | "failed" | "replaced"
  txHash: string
  blockNumber?: bigint
}) {
  const entry: ReceiptEntry = {
    key: receiptKey(args.subdigest, args.chainId),
    subdigest: args.subdigest.toLowerCase(),
    chainId: args.chainId,
    status: args.status,
    txHash: args.txHash,
    blockNumber: args.blockNumber?.toString(),
  }

  const db = await mainDB()
  await db.put("receipts", entry)
  db.close()

  notify()
}

export function useStoredReceipt(subdigest: string | undefined, chainId: number | undefined) {
  const notifier = useNotifier()

  const [entry, setEntry] = useState<ReceiptEntry | undefined>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchReceipt() {
      if (!subdigest || chainId === undefined) {
        if (!cancelled) {
          setEntry(undefined)
          setLoading(false)
        }
        return
      }

      const db = await mainDB()
      const found = await db.get("receipts", receiptKey(subdigest, chainId))
      db.close()

      if (!cancelled) {
        setEntry(found)
        setLoading(false)
      }
    }

    setLoading(true)
    fetchReceipt()

    return () => {
      cancelled = true
    }
  }, [notifier.flag, subdigest, chainId])

  return { entry, loading }
}
