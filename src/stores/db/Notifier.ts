import { useEffect, useState } from "react"
import store from "store2"

const KEY_NOTIFIER = '@0xsequence-enchanter-indexed-db-notifier'

export function notify() {
  store.transact(KEY_NOTIFIER, (value: number) => {
    return (value || 0) + 1
  })
  window.dispatchEvent(new Event('storage'))
}

export function useNotifier() {
  const [flag, setFlag] = useState<number>(store.get(KEY_NOTIFIER) || 0)

  useEffect(() => {
    const handleStorageChange = () => {
      setFlag(store.get(KEY_NOTIFIER))
    }

    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  })

  return { flag, notify }
}