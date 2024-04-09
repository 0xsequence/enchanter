import { notify, useNotifier } from "./Notifier"

import { commons } from "@0xsequence/core"
import { ethers } from "ethers"
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

export function useTransaction(args: { subdigest: string }) {
  const notifier = useNotifier()

  const [transaction, setTransaction] = useState<TransactionsEntry | undefined>()

  useEffect(() => {
    async function fetchTransaction() {
      const db = await mainDB()
      const entry = await db.getFromIndex('transactions', 'subdigest', args.subdigest)

      if (!entry) {
        db.close()
        setTransaction(undefined)
        return
      }

      setTransaction(entry)
      db.close()
    }

    fetchTransaction()
  }, [notifier.flag])

  return transaction
}

export function useTransactions(args: { wallet: string }) {
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
  }, [notifier.flag])

  return transactions

}
