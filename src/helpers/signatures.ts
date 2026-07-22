export type SignaturePart = {
  type: "hash" | "eth_sign"
  signature: string
}

// A stored (or mailboxed) ECDSA signature is 65 bytes with an optional
// trailing type byte: "01" marks a signature over the digest itself (EIP-712
// typed signing), "02" an eth_sign signature over the digest. Untagged
// 65-byte signatures are eth_sign — the only kind that existed before typed
// signing. The type byte matches the Sequence v2 signature part encoding.
export function signatureParts(signature: string): SignaturePart {
  const normalized = signature.toLowerCase()
  let type: SignaturePart["type"] = "eth_sign"
  let inner = signature

  if (/^0x[0-9a-f]{132}$/.test(normalized)) {
    type = normalized.endsWith("01") ? "hash" : "eth_sign"
    inner = signature.slice(0, -2)
  }

  // Some signers return v as 0 or 1 instead of 27 or 28
  const v = inner.slice(-2).toLowerCase()
  if (v === "00") inner = inner.slice(0, -2) + "1b"
  else if (v === "01") inner = inner.slice(0, -2) + "1c"

  return { type, signature: inner }
}
