import { useEffect, useState } from "react"
import { walletTransport } from "../walletTransport";

const KEY_PREFIX = `@0xsequence-enchanter-`
const SELECTED_WALLET_KEY = `${KEY_PREFIX}selected-wallet`

export function setSelectedWallet(address: string | undefined) {
  return sessionStorage.setItem(SELECTED_WALLET_KEY, address ?? "");
}

export function getSelectedWallet(): string | undefined {
  return sessionStorage.getItem(SELECTED_WALLET_KEY) || undefined;
}

export function useSelectedWallet() {
  const [selectedWalletAddress, setSelectedWalletAddress] = useState<string | undefined>(() => {
    return sessionStorage.getItem(SELECTED_WALLET_KEY) || undefined;
  });

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === SELECTED_WALLET_KEY) {
        setSelectedWalletAddress(sessionStorage.getItem(SELECTED_WALLET_KEY) || undefined);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const updateSelectedWalletAddress = (address: string | undefined) => {
    setSelectedWalletAddress(address);
    sessionStorage.setItem(SELECTED_WALLET_KEY, address ?? '');
    address ? walletTransport.setSignedInState({ address }) : walletTransport.setSignedInState(null);
  };

  return { selectedWalletAddress, updateSelectedWalletAddress };
}
