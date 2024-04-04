
import { TransactionBundle, SignedTransactionBundle, IntendedTransactionBundle } from "@0xsequence/core/dist/declarations/src/commons/transaction"
import { Status, signers } from "@0xsequence/signhub"
import { BytesLike, ethers } from "ethers"

export class StaticSigner implements signers.SapientSigner {
  private readonly signatureBytes: Uint8Array
  private readonly savedSuffix: Uint8Array

  constructor(
    private readonly address: string,
    private readonly signature: string
  ) {
    const raw = ethers.utils.arrayify(this.signature)

    // Separate last byte as suffix
    this.savedSuffix = raw.slice(-1)
    this.signatureBytes = raw.slice(0, -1)
  }

  async buildDeployTransaction(_: object): Promise<TransactionBundle | undefined> {
    return undefined
  }

  async predecorateSignedTransactions(_: object): Promise<SignedTransactionBundle[]> {
    return []
  }

  async decorateTransactions(og: IntendedTransactionBundle, _: object): Promise<IntendedTransactionBundle> {
    return og
  }

  async sign(_message: BytesLike, _metadata: object): Promise<BytesLike> {
    return this.signatureBytes
  }

  notifyStatusChange(_a: string, _b: Status, _c: object): void {}

  suffix(): BytesLike {
    return this.savedSuffix
  }

  async getAddress() {
    console.log('StaticSigner.getAddress', this.address)
    return this.address
  }
}
