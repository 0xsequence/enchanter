import { SignatureEntry, addSignature, getSignaturesForSubdigest } from "./db/Signatures";
import { TransactionsEntry, addTransaction, isTransactionsEntry, subdigestOf } from "./db/Transactions";
import { UpdateEntry, addUpdate } from "./db/Updates";
import { addMessage, isMessageEntry, MessageEntry } from "./db/Messages";
import { publishMessage, publishTransaction } from "./KeyMachine";
import { postSignatureToMailbox } from "./Mailbox";

export type ExportPayload = {
  updates?: { wallet: string, imageHash: string, version?: 2 | 3 }[]
  transactions?: TransactionsEntry[]
  signatures?: { [key: string]: string[] };
  messages?: MessageEntry[]
}

export function isExportPayload(payload: unknown): payload is ExportPayload {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  const typedPayload = payload as ExportPayload;

  return (
    (typedPayload.transactions === undefined || (
      Array.isArray(typedPayload.transactions) &&
      typedPayload.transactions.every(isTransactionsEntry)
    )) &&
    (typedPayload.signatures === undefined || 
      (typeof typedPayload.signatures === 'object' &&
      !Array.isArray(typedPayload.signatures) &&
      Object.values(typedPayload.signatures).every(Array.isArray))
    ) &&
    (typedPayload.updates === undefined ||
      (Array.isArray(typedPayload.updates) &&
      typedPayload.updates.every((update) => 
        typeof update.wallet === 'string' && 
        typeof update.imageHash === 'string' &&
        (update.version === undefined || update.version === 2 || update.version === 3)
      ))
    ) &&
    (typedPayload.messages === undefined || (
      Array.isArray(typedPayload.messages) &&
      typedPayload.messages.every(isMessageEntry)
    )) 
  );
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
      imageHash: args.update.imageHash,
      version: args.update.version,
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
        publishTransaction(tx)
        resTransactions.push(tx)
      }
    }
  }

  if (raw.messages) {
    for (const message of raw.messages) {
      // Add the message if it doesn't exist
      if (await addMessage(message)) {
        publishMessage(message)
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

          // Repost ECDSA signatures to the mailbox so devices that sync
          // automatically also pick up manually imported ones. Typed-signing
          // signatures keep their "01" tag on the wire; eth_sign travels as
          // the raw 65 bytes ("02"-tagged or untagged), matching what signing
          // clients post.
          if (/^0x[0-9a-fA-F]{132}$/.test(signature) && signature.toLowerCase().endsWith("02")) {
            postSignatureToMailbox(subdigest, signature.slice(0, -2))
          } else if (/^0x[0-9a-fA-F]{132}$/.test(signature) && signature.toLowerCase().endsWith("01")) {
            postSignatureToMailbox(subdigest, signature)
          } else if (/^0x[0-9a-fA-F]{130}$/.test(signature)) {
            postSignatureToMailbox(subdigest, signature)
          }
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
