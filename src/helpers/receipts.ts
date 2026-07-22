import {
  BaseError,
  ContractFunctionZeroDataError,
  Hex,
  PublicClient,
  RpcLog,
  hexToBigInt,
  numberToHex,
  toEventSelector,
} from "viem"

// Execution status of a Sequence meta-transaction, derived from the wallet's
// own events. The wallet emits one event per action, so a payload counts as
// "executed" when at least one action succeeded.
export type ExecutionStatus = "executed" | "failed"

export type ExecutionResult = {
  status: ExecutionStatus
  txHash: string
  blockNumber?: bigint
}

export type LocatedExecution = {
  // "replaced" = the nonce was consumed by a different payload (proven by
  // finding the consumption block without our subdigest in it).
  // "consumed" = the nonce is spent but the receipt could not be located;
  // the transaction can never execute again either way.
  status: ExecutionStatus | "replaced" | "consumed"
  txHash: string
  blockNumber?: bigint
}

export type ExecutionTarget = {
  wallet: string
  space: string
  nonce: string
  subdigest: string
  version?: 2 | 3
}

export const READ_NONCE_ABI = [
  {
    inputs: [{ internalType: "uint256", name: "_space", type: "uint256" }],
    name: "readNonce",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const

const V2_TOPICS: Record<string, ExecutionStatus> = {
  [toEventSelector("TxExecuted(bytes32,uint256)")]: "executed",
  [toEventSelector("TxFailed(bytes32,uint256,bytes)")]: "failed",
}

const V3_TOPICS: Record<string, ExecutionStatus> = {
  [toEventSelector("CallSucceeded(bytes32,uint256)")]: "executed",
  [toEventSelector("CallFailed(bytes32,uint256,bytes)")]: "failed",
  [toEventSelector("CallAborted(bytes32,uint256,bytes)")]: "failed",
}

function topicsFor(version?: 2 | 3): Record<string, ExecutionStatus> {
  return version === 3 ? V3_TOPICS : V2_TOPICS
}

export type ExecutionLog = {
  address: string
  topics: readonly string[]
  transactionHash?: string | null
  blockNumber?: bigint | string | null
}

function logBlockNumber(log: ExecutionLog): bigint | undefined {
  if (typeof log.blockNumber === "bigint") return log.blockNumber
  if (typeof log.blockNumber === "string") return hexToBigInt(log.blockNumber as Hex)
  return undefined
}

export function executionResultFromLogs(
  logs: ExecutionLog[],
  target: Pick<ExecutionTarget, "wallet" | "subdigest" | "version">
): ExecutionResult | undefined {
  const topics = topicsFor(target.version)
  const wallet = target.wallet.toLowerCase()
  const subdigest = target.subdigest.toLowerCase()

  let failed: ExecutionResult | undefined
  for (const log of logs) {
    if (log.address.toLowerCase() !== wallet) continue
    const [topic0, topic1] = log.topics
    if (!topic0 || !topic1 || topic1.toLowerCase() !== subdigest) continue
    const status = topics[topic0.toLowerCase()]
    if (!status || !log.transactionHash) continue
    const result = { status, txHash: log.transactionHash, blockNumber: logBlockNumber(log) }
    if (status === "executed") return result
    failed = failed ?? result
  }
  return failed
}

async function fetchExecutionLogs(
  client: PublicClient,
  target: Pick<ExecutionTarget, "wallet" | "version"> & { subdigest?: string },
  fromBlock: bigint,
  toBlock: bigint
): Promise<ExecutionLog[]> {
  const topics: (string[] | string)[] = [Object.keys(topicsFor(target.version))]
  if (target.subdigest) topics.push(target.subdigest.toLowerCase())

  const logs = (await client.request({
    method: "eth_getLogs",
    params: [
      {
        address: target.wallet as Hex,
        fromBlock: numberToHex(fromBlock),
        toBlock: numberToHex(toBlock),
        topics: topics as [Hex[], Hex],
      },
    ],
  })) as RpcLog[]

  return logs
}

// The app derives nonce spaces from Date.now(), which lets us anchor log
// scans near the transaction creation time. Imported entries may use
// arbitrary spaces, so validate the range before trusting it.
export function spaceTimestampSeconds(space: string): bigint | undefined {
  try {
    const value = BigInt(space)
    const min = 1_300_000_000_000n // ~2011, in milliseconds
    const max = BigInt(Date.now()) + 86_400_000n
    if (value < min || value > max) return undefined
    return value / 1000n
  } catch {
    return undefined
  }
}

// Number of interior points probed in parallel per search round. Each round
// divides the range by PROBES + 1, so latency scales with round trips
// (log_8 instead of log_2) rather than with individual calls.
const PROBES = 7

function interiorPoints(lo: bigint, hi: bigint): bigint[] {
  const span = hi - lo
  const count = span - 1n < BigInt(PROBES) ? Number(span - 1n) : PROBES
  const points: bigint[] = []
  for (let i = 1; i <= count; i++) {
    const point = lo + (span * BigInt(i)) / BigInt(count + 1)
    if (point > lo && point < hi && !points.includes(point)) points.push(point)
  }
  return points
}

// Narrows [lo, hi] with parallel probes until hi is the first block where
// `pastTarget` holds. Invariant: !pastTarget(lo) && pastTarget(hi).
async function parallelSearch(
  lo: bigint,
  hi: bigint,
  pastTarget: (block: bigint) => Promise<boolean>
): Promise<{ lo: bigint; hi: bigint }> {
  for (let i = 0; i < 40 && lo + 1n < hi; i++) {
    const points = interiorPoints(lo, hi)
    if (points.length === 0) break
    const results = await Promise.all(points.map(pastTarget))
    let next = { lo, hi }
    for (let j = 0; j < points.length; j++) {
      if (results[j]) {
        next = { lo: next.lo, hi: points[j] }
        break
      }
      next = { lo: points[j], hi: next.hi }
    }
    lo = next.lo
    hi = next.hi
  }
  return { lo, hi }
}

// Latest block with timestamp <= the target, by parallel search over block
// headers. Works on any RPC (no archive state or extra services needed).
export async function blockNearTimestamp(
  client: PublicClient,
  timestamp: bigint,
  head: { number: bigint; timestamp: bigint }
): Promise<bigint> {
  if (head.timestamp <= timestamp) return head.number
  const { lo } = await parallelSearch(0n, head.number, async (blockNumber) => {
    const block = await client.getBlock({ blockNumber })
    return block.timestamp > timestamp
  })
  return lo
}

// First block where readNonce(space) exceeds the transaction's nonce, by
// parallel search over historical state. Requires an RPC that serves
// eth_call at old blocks; throws otherwise so callers can fall back to log
// scanning.
export async function findConsumptionBlock(
  client: PublicClient,
  target: Pick<ExecutionTarget, "wallet" | "space" | "nonce">,
  lowerBound: bigint,
  head: bigint
): Promise<bigint> {
  const nonce = BigInt(target.nonce)

  const consumedAt = async (blockNumber: bigint): Promise<boolean> => {
    try {
      const value = (await client.readContract({
        address: target.wallet as Hex,
        abi: READ_NONCE_ABI,
        functionName: "readNonce",
        args: [BigInt(target.space)],
        blockNumber,
      })) as bigint
      return value > nonce
    } catch (error) {
      // The wallet was not deployed yet at this block, so nothing was consumed
      if (error instanceof BaseError && error.walk((e) => e instanceof ContractFunctionZeroDataError)) {
        return false
      }
      throw error
    }
  }

  let lo = lowerBound
  if (lo > 0n && (await consumedAt(lo))) {
    // The anchor estimate landed after the execution; widen to genesis
    lo = 0n
  }

  const { hi } = await parallelSearch(lo, head, consumedAt)
  return hi
}

// Chunked eth_getLogs walk over [fromBlock, toBlock], shrinking the chunk
// size when the RPC rejects the range. Bounded by maxRequests.
export async function scanExecutionLogs(
  client: PublicClient,
  target: ExecutionTarget,
  fromBlock: bigint,
  toBlock: bigint,
  maxRequests = 50
): Promise<ExecutionResult | undefined> {
  let chunk = 2000n
  let at = fromBlock
  let requests = 0

  while (at <= toBlock && requests < maxRequests) {
    const end = at + chunk - 1n > toBlock ? toBlock : at + chunk - 1n
    try {
      requests++
      const logs = await fetchExecutionLogs(client, target, at, end)
      const result = executionResultFromLogs(logs, target)
      if (result) return result
      at = end + 1n
    } catch {
      if (chunk <= 250n) return undefined
      chunk /= 2n
    }
  }
  return undefined
}

// Locates how a consumed nonce was spent. Callers should only invoke this
// once the live readNonce(space) is known to exceed the transaction's nonce.
export async function locateExecution(
  client: PublicClient,
  target: ExecutionTarget
): Promise<LocatedExecution> {
  const head = await client.getBlock()

  try {
    const block = await findConsumptionBlock(client, target, 0n, head.number)
    const logs = await fetchExecutionLogs(client, target, block, block)
    const own = executionResultFromLogs(logs, target)
    if (own) return { ...own, blockNumber: block }

    // The nonce was consumed at this block by a different payload
    const any = await fetchExecutionLogs(client, { wallet: target.wallet, version: target.version }, block, block)
    const replacement = any.find((log) => log.address.toLowerCase() === target.wallet.toLowerCase())
    return { status: "replaced", txHash: replacement?.transactionHash ?? "", blockNumber: block }
  } catch {
    // No archive state available; fall back to bounded log scanning
  }

  let anchor: bigint | undefined
  const createdAt = spaceTimestampSeconds(target.space)
  if (createdAt !== undefined) {
    try {
      // Rewind a little in case of clock skew between browser and chain
      anchor = await blockNearTimestamp(client, createdAt - 900n, head)
    } catch {
      anchor = undefined
    }
  }

  const fromBlock = anchor ?? (head.number > 100_000n ? head.number - 100_000n : 0n)
  const scanned = await scanExecutionLogs(client, target, fromBlock, head.number)
  if (scanned) return scanned

  return { status: "consumed", txHash: "" }
}
