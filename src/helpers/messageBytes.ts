import { ethers } from "ethers"

// Mirrors the message encoding of Wallet.prepareMessageSignature: hex input is
// used as raw bytes, anything else as UTF-8, both behind the EIP-191 prefix.
export function encodeMessageBytes(raw: string): string {
  const rawHex = ethers.isHexString(raw) ? raw : ethers.hexlify(ethers.toUtf8Bytes(raw))
  const size = ethers.getBytes(rawHex).length
  return ethers.hexlify(
    ethers.concat([ethers.toUtf8Bytes(`\x19Ethereum Signed Message:\n${size}`), rawHex])
  )
}

const MESSAGE_PREFIX = ethers.toUtf8Bytes("\x19Ethereum Signed Message:\n")

export function decodeMessageBytes(messageHex: string): string | undefined {
  const bytes = ethers.getBytes(messageHex)
  if (bytes.length <= MESSAGE_PREFIX.length) return undefined
  for (let i = 0; i < MESSAGE_PREFIX.length; i++) {
    if (bytes[i] !== MESSAGE_PREFIX[i]) return undefined
  }

  const rest = bytes.slice(MESSAGE_PREFIX.length)
  for (let digits = 1; digits < Math.min(9, rest.length); digits++) {
    const size = Number(ethers.toUtf8String(rest.slice(0, digits)))
    if (!Number.isInteger(size) || rest.length - digits !== size) continue

    const body = rest.slice(digits)
    let raw: string
    try {
      raw = ethers.toUtf8String(body)
    } catch {
      raw = ethers.hexlify(body)
    }

    // Only accept messages that enchanter can represent losslessly
    if (encodeMessageBytes(raw).toLowerCase() === messageHex.toLowerCase()) {
      return raw
    }
    return undefined
  }

  return undefined
}
