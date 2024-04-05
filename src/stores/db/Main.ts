import { openDB } from "idb";

export function mainDB() {
  return openDB("sequence-enchanter", 1, {
    upgrade(db) {
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
  })
}