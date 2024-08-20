import { SignatureEntry, addSignature, getSignaturesForSubdigest } from "./db/Signatures";
import { TransactionsEntry, addTransaction, isTransactionsEntry, subdigestOf } from "./db/Transactions";
import { UpdateEntry, addUpdate } from "./db/Updates";
import { addMessage, MessageEntry } from "./db/Messages";

export type ExportPayload = {
  updates?: { wallet: string, imageHash: string }[]
  transactions?: TransactionsEntry[]
  signatures?: { [key: string]: string[] };
  messages?: MessageEntry[]
}

export function isExportPayload(payload: any): payload is ExportPayload {
  return (
    (payload.transactions === undefined || (
      Array.isArray(payload.transactions) &&
      payload.transactions.every(isTransactionsEntry)
    )) &&
    (payload.signatures === undefined || 
      (typeof payload.signatures === 'object' &&
      !Array.isArray(payload.signatures) &&
      Object.values(payload.signatures).every(Array.isArray))
    ) &&
    (payload.updates === undefined ||
      (Array.isArray(payload.updates) &&
      payload.updates.every((update: any) => 
        typeof update.wallet === 'string' && 
        typeof update.imageHash === 'string'
      ))
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

export async function exportMessage(args: { message: MessageEntry }): Promise<string> {
  const signatures = await getSignaturesForSubdigest(args.message.subdigest)

  const payload: ExportPayload = {
    messages: [args.message]
  }

  if (signatures.length > 0) {
    const sigs: { [key: string]: string[] } = {}
    sigs[args.message.subdigest] = signatures.map(s => s.signature)
    payload.signatures = sigs
  }

  return JSON.stringify(payload)
}

export async function exportUpdate(args: { update: UpdateEntry }): Promise<string> {
  const signatures = await getSignaturesForSubdigest(args.update.subdigest)
  const payload: ExportPayload = {
    updates: [{
      wallet: args.update.wallet,
      imageHash: args.update.imageHash
    }]
  }

  if (signatures.length > 0) {
    const sigs: { [key: string]: string[] } = {}
    sigs[args.update.subdigest] = signatures.map(s => s.signature)
    payload.signatures = sigs
  }

  return JSON.stringify(payload)
}

export async function importData(payload: string): Promise<{
  importedTransactions: TransactionsEntry[],
  importedMessages: MessageEntry[],
  importedSignatures: SignatureEntry[],
  importedUpdates: UpdateEntry[]
}> {
  const raw = JSON.parse(payload)
  if (!isExportPayload(raw)) {
    throw new Error('Invalid payload')
  }

  const resTransactions: TransactionsEntry[] = []
  const resMessages: MessageEntry[] = []
  const resSignatures: SignatureEntry[] = []
  const resUpdates: UpdateEntry[] = []

  if (raw.transactions) {
    for (const tx of raw.transactions) {
      // Add the transaction if it doesn't exist
      if (await addTransaction(tx)) {
        resTransactions.push(tx)
      }
    }
  }

  if (raw.messages) {
    for (const message of raw.messages) {
      // Add the message if it doesn't exist
      if (await addMessage(message)) {
        resMessages.push(message)
      }
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

  if (raw.updates) {
    for (const update of raw.updates) {
      // Add the update if it doesn't exist
      const res = await addUpdate(update)
      if (res.isNew) {
        resUpdates.push(res)
      }
    }
  }

  return {
    importedTransactions: resTransactions,
    importedMessages: resMessages,
    importedSignatures: resSignatures,
    importedUpdates: resUpdates
  }
}
