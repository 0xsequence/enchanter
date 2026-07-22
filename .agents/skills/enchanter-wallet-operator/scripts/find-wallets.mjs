#!/usr/bin/env node

import { ethers } from "ethers"
import { trackers } from "@0xsequence/sessions"

const KEY_MACHINE_URL = "https://keymachine.sequence.app"
const TRACKER = new trackers.remote.RemoteConfigTracker("https://sessions.sequence.app")
const PAGE_SIZE = 100
const MAX_PAGES = 5

function usage(message) {
  if (message) console.error(`Error: ${message}`)
  console.error("Usage: find-wallets.mjs 0xSIGNER")
  process.exit(2)
}

if (process.argv.length !== 3) usage()

let signer
try {
  signer = ethers.getAddress(process.argv[2])
} catch {
  usage("signer must be a valid EVM address")
}

async function keyMachineRpc(method, args) {
  const response = await fetch(`${KEY_MACHINE_URL}/rpc/KeyMachine/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.cause || body.msg || `${response.status} ${response.statusText}`)
  }
  return response.json()
}

async function findV3() {
  const wallets = []
  let cursor = 0
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await keyMachineRpc("Wallets", { signer, cursor, limit: PAGE_SIZE })
    const addresses = Object.keys(result.wallets || {})
    wallets.push(...addresses)
    if (addresses.length < PAGE_SIZE || Number(result.cursor) <= cursor) break
    cursor = Number(result.cursor)
  }
  return wallets
}

async function findV2() {
  return (await TRACKER.walletsOfSigner({ signer })).map((entry) => entry.wallet)
}

const settled = await Promise.allSettled([findV3(), findV2()])
const sources = ["v3-key-machine", "v2-tracker"]
const found = new Map()
const errors = []

for (let index = 0; index < settled.length; index++) {
  const result = settled[index]
  if (result.status === "rejected") {
    errors.push({ source: sources[index], error: String(result.reason?.message || result.reason) })
    continue
  }
  for (const candidate of result.value) {
    try {
      const address = ethers.getAddress(candidate)
      const key = address.toLowerCase()
      const existing = found.get(key) || { address, sources: [] }
      if (!existing.sources.includes(sources[index])) existing.sources.push(sources[index])
      found.set(key, existing)
    } catch {
      // Ignore malformed service entries.
    }
  }
}

console.log(JSON.stringify({
  signer,
  wallets: [...found.values()].sort((a, b) => a.address.localeCompare(b.address)),
  partial: errors.length > 0,
  errors,
}, null, 2))

if (settled.every((result) => result.status === "rejected")) process.exitCode = 1
