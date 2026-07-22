#!/usr/bin/env node

import { Account } from "@0xsequence/account"
import { commons, universal } from "@0xsequence/core"
import { allNetworks } from "@0xsequence/network"
import { Orchestrator } from "@0xsequence/signhub"
import { trackers } from "@0xsequence/sessions"
import { State, Wallet } from "@0xsequence/wallet-core"
import { Config } from "@0xsequence/wallet-primitives"
import { ethers } from "ethers"

const TRACKER = new trackers.remote.RemoteConfigTracker("https://sessions.sequence.app")
const V3_STATE_PROVIDER = new State.Sequence.Provider()

function fail(message) {
  console.error(`Error: ${message}`)
  process.exit(2)
}

function usage() {
  console.error("Usage: inspect-wallet.mjs 0xWALLET [--version auto|2|3] [--chain-id N]")
}

const options = { address: undefined, version: "auto", chainId: 1 }
for (let index = 2; index < process.argv.length; index++) {
  const arg = process.argv[index]
  const next = () => {
    const value = process.argv[++index]
    if (value === undefined) fail(`${arg} requires a value`)
    return value
  }
  if (arg === "--version") options.version = next()
  else if (arg === "--chain-id") options.chainId = Number(next())
  else if (arg === "--help" || arg === "-h") {
    usage()
    process.exit(0)
  } else if (!options.address && !arg.startsWith("--")) options.address = arg
  else fail(`unknown argument ${arg}`)
}

if (!options.address) {
  usage()
  fail("wallet address is required")
}
if (!["auto", "2", "3"].includes(options.version)) fail("version must be auto, 2, or 3")
if (!Number.isSafeInteger(options.chainId) || options.chainId < 0) fail("chain-id must be a non-negative integer")

let address
try {
  address = ethers.getAddress(options.address)
} catch {
  fail("wallet must be a valid EVM address")
}

function v3Signers(topology) {
  const signers = []
  const visit = (node) => {
    if (Array.isArray(node)) {
      visit(node[0])
      visit(node[1])
    } else if (Config.isSignerLeaf(node)) {
      signers.push({ address: ethers.getAddress(node.address), weight: Number(node.weight) })
    } else {
      throw new Error("v3 configuration is not a simple weighted multisig")
    }
  }
  visit(topology)
  return signers
}

async function inspectV3() {
  const status = await new Wallet(address, { stateProvider: V3_STATE_PROVIDER }).getStatus()
  return {
    version: 3,
    address: ethers.getAddress(status.address),
    threshold: Number(status.configuration.threshold),
    signers: v3Signers(status.configuration.topology),
    checkpoint: status.configuration.checkpoint.toString(),
    imageHash: status.imageHash,
    pendingUpdates: status.pendingUpdates.length,
    deployment: "not-queried-without-chain-provider",
  }
}

async function inspectV2() {
  const account = new Account({
    address,
    tracker: TRACKER,
    contexts: commons.context.defaultContexts,
    orchestrator: new Orchestrator([]),
    networks: allNetworks,
  })
  const status = await account.status(options.chainId)
  if (status.original.version !== 2) throw new Error(`unsupported Sequence version ${status.original.version}`)
  const coder = universal.genericCoderFor(status.config.version)
  return {
    version: 2,
    address,
    chainId: options.chainId,
    threshold: Number(status.config.threshold || 0),
    signers: coder.config.signersOf(status.config).map((signer) => ({
      address: ethers.getAddress(signer.address),
      weight: Number(signer.weight),
    })),
    checkpoint: coder.config.checkpointOf(status.config).toString(),
    imageHash: coder.config.imageHashOf(status.config),
    pendingUpdates: status.presignedConfigurations.length,
    deployed: status.onChain.deployed,
  }
}

const errors = []
let result
if (options.version !== "2") {
  try {
    result = await inspectV3()
  } catch (error) {
    errors.push({ version: 3, error: String(error?.message || error) })
    if (options.version === "3") throw error
  }
}
if (!result && options.version !== "3") {
  try {
    result = await inspectV2()
  } catch (error) {
    errors.push({ version: 2, error: String(error?.message || error) })
    if (options.version === "2") throw error
  }
}
if (!result) {
  console.error(JSON.stringify({ address, errors }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify(result, null, 2))
