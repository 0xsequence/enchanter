import { notify, useNotifier } from "./Notifier";
import { useState, useEffect } from "react";

import { mainDB } from "./Main";

export type MessageEntry = {
  raw: string;
  digest: string;
  subdigest: string;
  chainId: number;
  wallet: string;
};

export function useMessage(args: { subdigest: string }) {
  const notifier = useNotifier();

  const [message, setMessage] = useState<MessageEntry | undefined>();

  useEffect(() => {
    async function fetchMessage() {
      const db = await mainDB();
      const entry = await db.getFromIndex(
        "messages",
        "subdigest",
        args.subdigest
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
