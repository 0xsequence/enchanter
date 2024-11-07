
import { commons } from "@0xsequence/core"
import { signers } from "@0xsequence/signhub"
import { BytesLike, ethers } from "ethers"

type TransactionBundle = commons.transaction.TransactionBundle
type SignedTransactionBundle = commons.transaction.SignedTransactionBundle
type IntendedTransactionBundle = commons.transaction.IntendedTransactionBundle

export class StaticSigner implements signers.SapientSigner {
  private readonly signatureBytes: Uint8Array
  private readonly savedSuffix: Uint8Array

  constructor(
    private readonly address: string,
    private readonly signature: string
  ) {
    const raw = ethers.getBytes(this.signature)

    // Separate last byte as suffix
    this.savedSuffix = raw.slice(-1)
    this.signatureBytes = raw.slice(0, -1)
  }

  async buildDeployTransaction(): Promise<TransactionBundle | undefined> {
    return undefined
  }

  async predecorateSignedTransactions(): Promise<SignedTransactionBundle[]> {
    return []
  }

  async decorateTransactions(og: IntendedTransactionBundle): Promise<IntendedTransactionBundle> {
    return og
  }

  async sign(): Promise<BytesLike> {
    return this.signatureBytes
  }

  notifyStatusChange(): void {}

  suffix(): BytesLike {
    return this.savedSuffix
  }

  async getAddress() {
    return this.address
  }
}
