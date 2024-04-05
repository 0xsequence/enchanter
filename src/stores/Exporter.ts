import { SignatureEntry, addSignature, getSignaturesForSubdigest } from "./db/Signatures";
import { TransactionsEntry, addTransaction, isTransactionsEntry, subdigestOf } from "./db/Transactions";

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

export async function exportData(args: { tx: TransactionsEntry }): Promise<string> {
  const subdigest = subdigestOf(args.tx)
  const signatures = await getSignaturesForSubdigest(subdigest) 

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

export async function importData(payload: string): Promise<{
  importedTransactions: TransactionsEntry[],
  importedSignatures: SignatureEntry[]
}> {
  const raw = JSON.parse(payload)
  if (!isExportPayload(raw)) {
    throw new Error('Invalid payload')
  }

  const resTransactions: TransactionsEntry[] = []
  const resSignatures: SignatureEntry[] = []

  for (const tx of raw.transactions) {
    // Add the transaction if it doesn't exist
    if (await addTransaction(tx)) {
      resTransactions.push(tx)
    }
  }

  if (raw.signatures) {
    for (const subdigest in raw.signatures) {
      for (const signature of raw.signatures[subdigest]) {
        // Add the signature if it doesn't exist
        if (await addSignature({ subdigest, signature })) {
          resSignatures.push({ subdigest, signature })
        }
      }
    }
  }

  return {
    importedTransactions: resTransactions,
    importedSignatures: resSignatures
  }
}
