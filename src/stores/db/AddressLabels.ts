import { useCallback, useEffect, useMemo, useState } from "react"
import { ethers } from "ethers"
import { mainDB } from "./Main"
import { notify, useNotifier } from "./Notifier"

export const MAX_ADDRESS_LABEL_LENGTH = 64

export type AddressLabel = {
  address: string
  label: string
}

export function normalizeAddressLabelKey(address: string) {
  if (!ethers.isAddress(address)) {
    throw new Error("Invalid address")
  }

  return ethers.getAddress(address).toLowerCase()
}

export async function saveAddressLabel(address: string, label: string) {
  const normalizedAddress = normalizeAddressLabelKey(address)
  const normalizedLabel = label.trim()

  if (normalizedLabel.length > MAX_ADDRESS_LABEL_LENGTH) {
    throw new Error(`Labels must be ${MAX_ADDRESS_LABEL_LENGTH} characters or fewer`)
  }

  const db = await mainDB()
  try {
    const tx = db.transaction("addressLabels", "readwrite")
    const store = tx.objectStore("addressLabels")

    if (normalizedLabel) {
      await store.put({ address: normalizedAddress, label: normalizedLabel })
    } else {
      await store.delete(normalizedAddress)
    }

    await tx.done
  } finally {
    db.close()
  }

  notify()
}

export function useAddressLabels() {
  const notifier = useNotifier()
  const [labels, setLabels] = useState<AddressLabel[]>([])

  useEffect(() => {
    let cancelled = false

    async function fetchLabels() {
      const db = await mainDB()
      try {
        const storedLabels = await db.getAll("addressLabels") as AddressLabel[]
        if (!cancelled) {
          setLabels(storedLabels)
        }
      } finally {
        db.close()
      }
    }

    void fetchLabels()

    return () => {
      cancelled = true
    }
  }, [notifier.flag])

  const labelsByAddress = useMemo(
    () => new Map(labels.map((entry) => [entry.address, entry.label])),
    [labels],
  )

  const labelForAddress = useCallback((address: string) => {
    try {
      return labelsByAddress.get(normalizeAddressLabelKey(address))
    } catch {
      return undefined
    }
  }, [labelsByAddress])

  return { labels, labelForAddress, saveAddressLabel }
}
