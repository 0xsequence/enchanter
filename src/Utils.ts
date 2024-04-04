
export function addressToShort(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function toUpperFirst(s: string) {
  if (!s || s.length === 0) return s
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}
