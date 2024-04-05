
import { useEffect, useState } from "react"
import { useNotifier } from "./Notifier"
import { mainDB } from "./Main"

export type WalletEntry = {
  address: string
  name: string
}

export function useWallets() {
  const notifier = useNotifier()

  const [wallets, setWallets] = useState<WalletEntry[]>([])

  useEffect(() => {
    async function fetchWallets() {
      const db = await mainDB()
      const tx = db.transaction("wallets", "readonly")
      const store = tx.objectStore("wallets")

      const wallets = await store.getAll()
      setWallets(wallets)

      db.close()
    }

    fetchWallets()
  }, [notifier.flag])

  const addWallet = async (address: string, name: string) => {
    const db = await mainDB()
    const tx = db.transaction("wallets", "readwrite")
    const store = tx.objectStore("wallets")

    const wallets = await store.getAll()
    if (wallets.find((w) => w.address === address)) {
      db.close()
      return false
    }

    await store.add({ address, name })
    await tx.done
    db.close()

    notifier.notify()

    return true
  }

  const removeWallet = async (address: string) => {
    const db = await mainDB()
    const tx = db.transaction("wallets", "readwrite")
    const store = tx.objectStore("wallets")

    await store.delete(address)
    await tx.done
    db.close()

    notifier.notify()
  }

  return { wallets, addWallet, removeWallet}
}
