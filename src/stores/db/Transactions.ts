import { notify, useNotifier } from "./Notifier"
import { commons } from "@0xsequence/core"
import { useEffect, useState } from "react";
import { mainDB } from "./Main";

export type FlatTransaction = {
  to: string;
  value?: string;
  data?: string;
  gasLimit?: string;
  delegateCall?: boolean;
  revertOnError?: boolean;
}

export function isFlatTransaction(tx: unknown): tx is FlatTransaction {
  if (typeof tx !== 'object' || tx === null) {
    return false;
  }

  const t = tx as Record<string, unknown>;

  return (
    typeof t.to === 'string' &&
    (t.value === undefined || typeof t.value === 'string') &&
    (t.data === undefined || typeof t.data === 'string') &&
    (t.gasLimit === undefined || typeof t.gasLimit === 'string') &&
    (t.delegateCall === undefined || typeof t.delegateCall === 'boolean') &&
    (t.revertOnError === undefined || typeof t.revertOnError === 'boolean')
  );
}

export function toSequenceTransaction(tx: FlatTransaction): commons.transaction.Transaction {
  return {
    to: tx.to,
    value: tx.value ? BigInt(tx.value) : undefined,
    data: tx.data,
    gasLimit: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
    delegateCall: tx.delegateCall || false,
    revertOnError: tx.revertOnError || false
  }
}

export function toSequenceTransactions(txs: FlatTransaction[]): commons.transaction.Transaction[] {
  return txs.map(toSequenceTransaction)
}

export function fromSequenceTransactions(wallet: string, txs: commons.transaction.Transactionish): FlatTransaction[] {
  const sequenceTxs = commons.transaction.fromTransactionish(wallet, txs)
  return sequenceTxs.map(stx => ({
    to: stx.to,
    value: stx.value?.toString(),
    data: stx.data?.toString(),
    gasLimit: stx.gasLimit?.toString(),
    delegateCall: stx.delegateCall,
    revertOnError: stx.revertOnError
  }))
}

export type TransactionsEntry = {
  subdigest?: string
  wallet: string
  space: string
  nonce: string
  chainId: string
  transactions: FlatTransaction[]
}

export function isTransactionsEntry(entry: unknown): entry is TransactionsEntry {
  if (typeof entry !== 'object' || entry === null) {
    return false;
  }

  const e = entry as Record<string, unknown>;

  return (
    typeof e.wallet === 'string' &&
    typeof e.space === 'string' &&
    typeof e.nonce === 'string' &&
    typeof e.chainId === 'string' &&
    Array.isArray(e.transactions) &&
    e.transactions.every(isFlatTransaction) &&
    (e.subdigest === undefined || typeof e.subdigest === 'string')
  );
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

export async function addTransaction(entry: TransactionsEntry) {
  const db = await mainDB()
  const subdigest = subdigestOf(entry)

  // See if the transaction already exists
  const exists = await db.getFromIndex('transactions', 'subdigest', subdigest)
  if (exists) {
    db.close()
    return false
  }

  await db.add('transactions', { ...entry, subdigest })
  db.close()

  notify()

  return true
}

export function useTransaction(args: { subdigest: string | undefined }) {
  const notifier = useNotifier()

  const [transaction, setTransaction] = useState<TransactionsEntry | undefined>()

  useEffect(() => {
    async function fetchTransaction() {
      const db = await mainDB()
      const entry = await db.getFromIndex('transactions', 'subdigest', args.subdigest ?? '')

      if (!entry) {
        db.close()
        setTransaction(undefined)
        return
      }

      setTransaction(entry)
      db.close()
    }

    fetchTransaction()
  }, [notifier.flag, args.subdigest])

  return transaction
}

export function useTransactions(args: { wallet: string | undefined }) {
  const notifier = useNotifier()

  const [transactions, setTransactions] = useState<TransactionsEntry[]>([])

  useEffect(() => {
    async function fetchTransactions() {
      const db = await mainDB()
      const txs = await db.getAllFromIndex('transactions', 'wallet', args.wallet)
      setTransactions(txs)
      db.close()
    }

    fetchTransactions()
  }, [notifier.flag, args.wallet])

  return transactions

}
