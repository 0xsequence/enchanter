#!/usr/bin/env node

import { mkdir, open, rm } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve, sep } from "node:path"
import { randomInt } from "node:crypto"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { Account } from "@0xsequence/account"
import { commons } from "@0xsequence/core"
import { allNetworks } from "@0xsequence/network"
import { Orchestrator } from "@0xsequence/signhub"
import { trackers } from "@0xsequence/sessions"
import { State, Wallet } from "@0xsequence/wallet-core"
import { Config, Context, Payload } from "@0xsequence/wallet-primitives"
import { ethers } from "ethers"

const TRACKER = new trackers.remote.RemoteConfigTracker("https://sessions.sequence.app")
const V3_STATE_PROVIDER = new State.Sequence.Provider()
const KEY_MACHINE_URL = "https://keymachine.sequence.app"
const UINT31_MAX = 2147483647

function fail(message) {
  console.error(`Error: ${message}`)
  process.exit(2)
}

function usage() {
  console.error(`Usage: create-test-wallets.mjs --output test-results/FILE.json [options]

Options:
  --wallets-per-version N  default 1
  --threshold N            default 2
  --signers N              default 2, each weight 1
  --salt-base N            default random uint31 range
  --publish-witnesses      publish first-signer witnesses and verify discovery
  --force                  replace an existing output artifact`)
}

const options = {
  output: undefined,
  walletsPerVersion: 1,
  threshold: 2,
  signerCount: 2,
  saltBase: randomInt(1, UINT31_MAX - 10000),
  publishWitnesses: false,
  force: false,
}

for (let index = 2; index < process.argv.length; index++) {
  const arg = process.argv[index]
  const next = () => {
    const value = process.argv[++index]
    if (value === undefined) fail(`${arg} requires a value`)
    return value
  }
  if (arg === "--output") options.output = next()
  else if (arg === "--wallets-per-version") options.walletsPerVersion = Number(next())
  else if (arg === "--threshold") options.threshold = Number(next())
  else if (arg === "--signers") options.signerCount = Number(next())
  else if (arg === "--salt-base") options.saltBase = Number(next())
  else if (arg === "--publish-witnesses") options.publishWitnesses = true
  else if (arg === "--force") options.force = true
  else if (arg === "--help" || arg === "-h") {
    usage()
    process.exit(0)
  } else fail(`unknown option ${arg}`)
}

if (!options.output) fail("--output is required")
for (const [name, value] of [
  ["wallets-per-version", options.walletsPerVersion],
  ["threshold", options.threshold],
  ["signers", options.signerCount],
  ["salt-base", options.saltBase],
]) {
  if (!Number.isSafeInteger(value)) fail(`${name} must be an integer`)
}
if (options.walletsPerVersion < 1 || options.walletsPerVersion > 20) fail("wallets-per-version must be 1..20")
if (options.signerCount < 1 || options.signerCount > 20) fail("signers must be 1..20")
if (options.threshold < 1 || options.threshold > options.signerCount) fail("threshold must be 1..signers")
const walletTotal = options.walletsPerVersion * 2
if (options.saltBase < 0 || options.saltBase + walletTotal - 1 > UINT31_MAX) fail("salt range exceeds 0..2147483647")

const repositoryRoot = process.cwd()
const testResultsRoot = resolve(repositoryRoot, "test-results")
const outputPath = resolve(repositoryRoot, options.output)
const outputRelative = relative(testResultsRoot, outputPath)
if (isAbsolute(outputRelative) || outputRelative === "" || outputRelative === ".." || outputRelative.startsWith(`..${sep}`)) {
  fail("output must be a file below this repository's test-results directory")
}
if (!outputPath.endsWith(".json")) fail("output must use a .json extension")

const secretSigners = Array.from({ length: options.signerCount }, () => {
  const privateKey = generatePrivateKey()
  const account = privateKeyToAccount(privateKey)
  return { privateKey, account, address: ethers.getAddress(account.address), weight: 1 }
})
const publicSigners = secretSigners.map(({ address, weight }) => ({ address, weight }))

async function keyMachineRpc(method, args) {
  const response = await fetch(`${KEY_MACHINE_URL}/rpc/KeyMachine/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(`Key Machine ${method}: ${body.cause || body.msg || response.status}`)
  }
  return response.json()
}

async function createV2(checkpoint) {
  const wallet = await Account.new({
    config: { threshold: options.threshold, checkpoint, signers: publicSigners },
    tracker: TRACKER,
    contexts: commons.context.defaultContexts,
    orchestrator: new Orchestrator([]),
    networks: allNetworks,
  })
  const reverse = await TRACKER.imageHashOfCounterfactualWallet({ wallet: wallet.address })
  if (!reverse?.imageHash) throw new Error(`v2 config verification failed for ${wallet.address}`)
  const config = await TRACKER.configOfImageHash({ imageHash: reverse.imageHash })
  if (!config) throw new Error(`v2 image hash verification failed for ${wallet.address}`)
  return { version: 2, address: ethers.getAddress(wallet.address), checkpoint, imageHash: reverse.imageHash }
}

async function createV3(checkpoint) {
  const config = {
    threshold: BigInt(options.threshold),
    checkpoint: BigInt(checkpoint),
    topology: Config.flatLeavesToTopology(publicSigners.map((signer) => ({
      type: "signer",
      address: signer.address,
      weight: BigInt(signer.weight),
    }))),
  }
  const wallet = await Wallet.fromConfiguration(config, {
    context: Context.Rc5,
    stateProvider: V3_STATE_PROVIDER,
  })
  const status = await wallet.getStatus()
  if (status.configuration.checkpoint !== BigInt(checkpoint)) {
    throw new Error(`v3 config verification failed for ${wallet.address}`)
  }
  return {
    version: 3,
    address: ethers.getAddress(wallet.address),
    checkpoint,
    imageHash: ethers.hexlify(Config.hashConfiguration(config)),
  }
}

async function publishV2Witness(wallet) {
  const digest = ethers.id(`Enchanter test witness ${wallet.address} ${Date.now()}`)
  const subdigest = commons.signature.subdigestOf({ digest, chainId: 0, address: wallet.address })
  const signature = await secretSigners[0].account.signMessage({ message: { raw: subdigest } })
  await TRACKER.saveWitnesses({
    wallet: wallet.address,
    digest,
    chainId: 0,
    signatures: [signature + "02"],
  })
  const found = await TRACKER.walletsOfSigner({ signer: secretSigners[0].address })
  if (!found.some((entry) => entry.wallet.toLowerCase() === wallet.address.toLowerCase())) {
    throw new Error(`v2 witness verification failed for ${wallet.address}`)
  }
}

async function publishV3Witness(wallet) {
  const statement = JSON.stringify({
    action: "enchanter-witness",
    statement: "I attest that I am a signer of this Sequence wallet",
    wallet: wallet.address,
    signer: secretSigners[0].address,
    timestamp: new Date().toISOString(),
    testOnly: true,
  })
  const message = ethers.hexlify(ethers.toUtf8Bytes(statement))
  const typedData = Payload.toTyped(wallet.address, 0, Payload.fromMessage(message))
  const signature = await secretSigners[0].account.signTypedData(typedData)
  await keyMachineRpc("SaveSignerSignatures3", {
    wallet: wallet.address,
    payload: { type: "message", message },
    chainID: "0",
    signatures: [{ type: "EIP712", signature }],
  })
  const found = await keyMachineRpc("Wallets", {
    signer: secretSigners[0].address,
    cursor: 0,
    limit: 100,
  })
  if (!Object.keys(found.wallets || {}).some((address) => address.toLowerCase() === wallet.address.toLowerCase())) {
    throw new Error(`v3 witness verification failed for ${wallet.address}`)
  }
}

const wallets = []
for (let index = 0; index < options.walletsPerVersion; index++) {
  wallets.push(await createV2(options.saltBase + index))
}
for (let index = 0; index < options.walletsPerVersion; index++) {
  wallets.push(await createV3(options.saltBase + options.walletsPerVersion + index))
}

if (options.publishWitnesses) {
  for (const wallet of wallets) {
    if (wallet.version === 2) await publishV2Witness(wallet)
    else await publishV3Witness(wallet)
    wallet.witnessedBy = secretSigners[0].address
  }
}

const artifact = {
  schema: "enchanter-test-wallets-v1",
  testOnly: true,
  createdAt: new Date().toISOString(),
  note: "Throwaway unfunded service fixtures. Never fund or use outside tests.",
  threshold: options.threshold,
  signers: secretSigners.map(({ address, privateKey, weight }) => ({ address, privateKey, weight })),
  wallets: wallets.map((wallet) => ({ ...wallet, signers: publicSigners })),
}

await mkdir(dirname(outputPath), { recursive: true, mode: 0o700 })
if (options.force) await rm(outputPath, { force: true })
let handle
try {
  handle = await open(outputPath, "wx", 0o600)
  await handle.writeFile(`${JSON.stringify(artifact, null, 2)}\n`, { encoding: "utf8" })
} catch (error) {
  if (error?.code === "EEXIST") fail("output exists; choose another path or pass --force")
  throw error
} finally {
  await handle?.close()
}

console.log(`Wrote secret test artifact (mode 0600): ${relative(repositoryRoot, outputPath)}`)
console.log(`Test signers: ${publicSigners.map((signer) => signer.address).join(", ")}`)
for (const wallet of wallets) {
  console.log(`Sequence v${wallet.version}: ${wallet.address} checkpoint=${wallet.checkpoint} imageHash=${wallet.imageHash}${wallet.witnessedBy ? " witnessed" : ""}`)
}
console.log("No wallet was deployed, funded, or used for an EVM transaction.")
