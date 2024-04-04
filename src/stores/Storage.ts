import { useEffect, useState } from "react"
import store from "store2"
import { commons } from "@0xsequence/core"
import { ethers } from "ethers"

const KEY_PREFIX = '@0xsequence-enchanter-'
const WALLETS_KEY = `${KEY_PREFIX}wallets`
const SELECTED_WALLET_KEY = `${KEY_PREFIX}selected-wallet`
const TRANSACTIONS_KEY = `${KEY_PREFIX}transactions`
const SIGNATURES_KEY = `${KEY_PREFIX}signatures`

export type WalletEntry = {
  address: string
  name: string
}

export function addWallet(address: string, name: string): boolean {
  let result = false

  store.transact(WALLETS_KEY, (wallets: WalletEntry[] | undefined) => {
    if (!wallets) {
      wallets = []
    }

    if (wallets.find(w => w.address === address)) {
      return wallets
    }

    result = true
    wallets.push({
      address,
      name
    })
    return wallets
  })

  window.dispatchEvent(new Event('storage'))

  return result
}

export function getWallets(): WalletEntry[] {
  return store.get(WALLETS_KEY, [])
}

export function removeWallet(address: string): boolean {
  let result = false

  store.transact(WALLETS_KEY, (wallets: string[] | undefined) => {
    if (!wallets) {
      return wallets
    }

    const index = wallets.findIndex(w => w === address)
    if (index === -1) {
      return wallets
    }

    result = true
    wallets.splice(index, 1)
    return wallets
  })

  return result
}

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

export function useWallets() {
  const [wallets, setWallets] = useState<WalletEntry[]>(() => {
    return store.get(WALLETS_KEY, []);
  });

  useEffect(() => {
    const handleStorageChange = () => {
      setWallets(store.get(WALLETS_KEY, []));
    };

    window.addEventListener('storage', handleStorageChange);

    // Cleanup the event listener on component unmount
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return wallets;
}

// TODO: Migrate transactions and signatures to IndexedDB
export type FlatTransaction = {
  to: string;
  value?: string;
  data?: string;
  gasLimit?: string;
  delegateCall?: boolean;
  revertOnError?: boolean;
}

export function isFlatTransaction(tx: any): tx is FlatTransaction {
  return (
    tx.to &&
    typeof tx.to === 'string' &&
    (tx.value === undefined || typeof tx.value === 'string') &&
    (tx.data === undefined || typeof tx.data === 'string') &&
    (tx.gasLimit === undefined || typeof tx.gasLimit === 'string') &&
    (tx.delegateCall === undefined || typeof tx.delegateCall === 'boolean') &&
    (tx.revertOnError === undefined || typeof tx.revertOnError === 'boolean')
  )
}

export function fromSequenceTransaction(tx: commons.transaction.Transaction): FlatTransaction {
  return {
    to: tx.to,
    value: tx.value?.toString(),
    data: tx.data?.toString(),
    gasLimit: tx.gasLimit?.toString(),
    delegateCall: tx.delegateCall,
    revertOnError: tx.revertOnError
  }
}

export function toSequenceTransaction(tx: FlatTransaction): commons.transaction.Transaction {
  return {
    to: tx.to,
    value: tx.value ? ethers.BigNumber.from(tx.value) : undefined,
    data: tx.data ? ethers.utils.arrayify(tx.data) : undefined,
    gasLimit: tx.gasLimit ? ethers.BigNumber.from(tx.gasLimit) : undefined,
    delegateCall: tx.delegateCall || false,
    revertOnError: tx.revertOnError || false
  }
}

export function toSequenceTransactions(txs: FlatTransaction[]): commons.transaction.Transaction[] {
  return txs.map(toSequenceTransaction)
}

export type TransactionsEntry = {
  wallet: string
  space: string
  nonce: string
  chainId: string
  transactions: FlatTransaction[]
}

export function isTransactionsEntry(entry: any): entry is TransactionsEntry {
  return (
    entry.wallet &&
    entry.space &&
    entry.nonce &&
    entry.chainId &&
    entry.transactions &&
    typeof entry.wallet === 'string' &&
    typeof entry.space === 'string' &&
    typeof entry.nonce === 'string' &&
    typeof entry.chainId === 'string' &&
    Array.isArray(entry.transactions) &&
    entry.transactions.every(isFlatTransaction)
  )
}

export function digestOf(tx: TransactionsEntry): string {
  return commons.transaction.digestOfTransactions(
    commons.transaction.encodeNonce(tx.space, tx.nonce),
    toSequenceTransactions(tx.transactions),
  )
}

export function subdigestOf(tx: TransactionsEntry): string {
  const digest = digestOf(tx)

  return commons.signature.subdigestOf({
    digest,
    chainId: tx.chainId,
    address: tx.wallet
  })
}

export function addTransaction(transaction: TransactionsEntry): boolean {
  const subdigest = subdigestOf(transaction)

  let result = false
  store.transact(TRANSACTIONS_KEY, (transactions: TransactionsEntry[] | undefined) => {
    if (!transactions) {
      transactions = []
    }

    if (transactions.find(tx => subdigestOf(tx) === subdigest)) {
      return transactions
    }

    result = true
    transactions.push(transaction)
    return transactions
  })

  window.dispatchEvent(new Event('storage'))

  return result
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<TransactionsEntry[]>(() => {
    return store.get(TRANSACTIONS_KEY, []);
  })

  useEffect(() => {
    const handleStorageChange = () => {
      setTransactions(store.get(TRANSACTIONS_KEY, []));
    };

    window.addEventListener('storage', handleStorageChange);

    // Cleanup the event listener on component unmount
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [])

  return {
    transactions,
    addTransaction
  }
}

export function useTransactionFor(args: { subdigest: string } | { wallet: string }) {
  const transactions = useTransactions()

  if ((args as any).subdigest) {
    return transactions.transactions.find(tx => subdigestOf(tx) === (args as any).subdigest)
  }

  if ((args as any).wallet) {
    return transactions.transactions.filter(tx => tx.wallet === (args as any).wallet)
  }

  throw new Error('Invalid arguments')
}

export type SignatureEntry = {
  subdigest: string
  signature: string
}

export function addSignature(signature: SignatureEntry): boolean {
  let result = false
  store.transact(SIGNATURES_KEY, (signatures: SignatureEntry[] | undefined) => {
    if (!signatures) {
      signatures = []
    }

    if (signatures.find(s => s.subdigest === signature.subdigest && s.signature === signature.signature)) {
      return signatures
    }

    result = true
    signatures.push(signature)
    return signatures
  })

  window.dispatchEvent(new Event('storage'))

  return result
}

export function useSignatures() {
  const [signatures, setSignatures] = useState<SignatureEntry[]>(() => {
    return store.get(SIGNATURES_KEY, [])
  })

  useEffect(() => {
    const handleStorageChange = () => {
      setSignatures(store.get(SIGNATURES_KEY, []))
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  return {
    signatures,
    addSignature
  }
}

export function useSignaturesFor(args: { subdigest: string }) {
  const signatures = useSignatures()
  return signatures.signatures.filter(s => s.subdigest === args.subdigest)
}

export type ExportPayload = {
  transactions: TransactionsEntry[]
  signatures?: { [key: string]: string[] };
}

export function isExportPayload(payload: any): payload is ExportPayload {
  return (
    payload.transactions &&
    Array.isArray(payload.transactions) &&
    payload.transactions.every(isTransactionsEntry) &&
    (payload.signatures === undefined || 
      (typeof payload.signatures === 'object' &&
      !Array.isArray(payload.signatures) &&
      Object.values(payload.signatures).every(Array.isArray))
    )
  )
}

export function exportData(args: { tx: TransactionsEntry }): string {
  const subdigest = subdigestOf(args.tx)
  const signatures = (store.get(SIGNATURES_KEY, []) as SignatureEntry[]).filter(s => s.subdigest === subdigest)

  const payload: ExportPayload = {
    transactions: [args.tx]
  }

  if (signatures.length > 0) {
    const sigs: { [key: string]: string[] } = {}
    sigs[subdigest] = signatures.map(s => s.signature)
    payload.signatures = sigs
  }

  return JSON.stringify(payload)
}

export function importData(payload: string): {
  importedTransactions: TransactionsEntry[],
  importedSignatures: SignatureEntry[]
} {
  const raw = JSON.parse(payload)
  if (!isExportPayload(raw)) {
    throw new Error('Invalid payload')
  }

  const resTransactions: TransactionsEntry[] = []
  const resSignatures: SignatureEntry[] = []

  for (const tx of raw.transactions) {
    // Add the transaction if it doesn't exist
    if (addTransaction(tx)) {
      resTransactions.push(tx)
    }
  }

  if (raw.signatures) {
    Object.entries(raw.signatures).forEach(([subdigest, signatures]) => {
      signatures.forEach(signature => {
        // TODO: Validate signature before adding it
        if (addSignature({ subdigest, signature })) {
          resSignatures.push({ subdigest, signature });
        }
      });
    });
  }  

  return {
    importedTransactions: resTransactions,
    importedSignatures: resSignatures
  }
}
