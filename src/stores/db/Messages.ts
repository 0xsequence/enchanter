import { notify, useNotifier } from "./Notifier";
import { useState, useEffect } from "react";

import { mainDB } from "./Main";

export type MessageEntry = {
  raw: string;
  subdigest: string;
  chainId: number;
  wallet: string;
  digest: string;
};

export function isMessageEntry(entry: unknown): entry is MessageEntry {
  if (typeof entry !== 'object' || entry === null) {
    return false;
  }

  const e = entry as Record<string, unknown>;

  return (
    typeof e.raw === 'string' &&
    typeof e.subdigest === 'string' &&
    typeof e.wallet === 'string' &&
    typeof e.chainId === 'number' &&
    typeof e.digest === 'string'
  );
}

export function useMessage(args: { subdigest: string | undefined }) {
  const notifier = useNotifier();

  const [message, setMessage] = useState<MessageEntry | undefined>();

  useEffect(() => {
    async function fetchMessage() {
      const db = await mainDB();
      const entry = await db.getFromIndex(
        "messages",
        "subdigest",
        typeof args.subdigest === "undefined" ? "" : args.subdigest
      );

      if (!entry) {
        db.close();
        setMessage(undefined);
        return;
      }

      setMessage(entry);
      db.close();
    }

    fetchMessage();
  }, [notifier.flag]);

  return message;
}

export async function addMessage(entry: MessageEntry) {
  try {
    const db = await mainDB();

    const exists = await db.getFromIndex(
      "messages",
      "subdigest",
      entry.subdigest
    );
    if (exists) {
      db.close();
      return false;
    }

    await db.add("messages", entry);
    db.close();

    notify();

    return true;
  } catch (error) {
    console.log(error);
  }
}

export function useMessages(args: { wallet: string | undefined }) {
  const notifier = useNotifier()

  const [messages, setMessages] = useState<MessageEntry[]>([])

  useEffect(() => {
    async function fetchMessages() {
      const db = await mainDB()
      const messages = await db.getAllFromIndex('messages', 'wallet', args.wallet || "")
      setMessages(messages)
      db.close()
    }

    fetchMessages()
  }, [notifier.flag])

  return messages

}
