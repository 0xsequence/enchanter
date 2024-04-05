import { useEffect, useState } from "react"
import store from "store2"

const KEY_PREFIX = '@0xsequence-enchanter-'
const SELECTED_WALLET_KEY = `${KEY_PREFIX}selected-wallet`

export function setSelectedWallet(address: string | undefined) {
  return store.set(SELECTED_WALLET_KEY, address)
}

export function getSelectedWallet(): string | undefined {
  return store.get(SELECTED_WALLET_KEY)
}

export function useSelectedWallet() {
  const [selectedWalletAddress, setSelectedWalletAddress] = useState<string | undefined>(() => {
    return store.get(SELECTED_WALLET_KEY);
  });

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === SELECTED_WALLET_KEY) {
        setSelectedWalletAddress(store.get(SELECTED_WALLET_KEY));
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const updateSelectedWalletAddress = (address: string | undefined) => {
    setSelectedWalletAddress(address);
    store.set(SELECTED_WALLET_KEY, address);
  };

  return { selectedWalletAddress, updateSelectedWalletAddress };
}
