import { openDB } from "idb";

export function mainDB() {
  return openDB("sequence-enchanter", 3, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const walletStore = db.createObjectStore("wallets", {
          keyPath: "id",

          autoIncrement: true
        })

        walletStore.createIndex("address", "address", { unique: true })

        const transactionsStore = db.createObjectStore("transactions", {
          keyPath: "id",

          autoIncrement: true
        })

        transactionsStore.createIndex("wallet", "wallet")
        transactionsStore.createIndex("subdigest", "subdigest", { unique: true })

        const signaturesStore = db.createObjectStore("signatures", {
          keyPath: "id",

          autoIncrement: true
        })

        signaturesStore.createIndex("subdigest", "subdigest")
      }

      if (oldVersion < 2) {
        const updatesStore = db.createObjectStore("updates", {
          keyPath: "subdigest",
          autoIncrement: true
        })

        updatesStore.createIndex("wallet", "wallet")
      }

      if (oldVersion < 3) {
        const messageStore = db.createObjectStore("messages", {
          keyPath: "id",

          autoIncrement: true
        })

        messageStore.createIndex("wallet", "wallet")
        messageStore.createIndex("subdigest", "subdigest", { unique: true })
      }
    }
  })
}
