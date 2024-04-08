import { commons, universal } from "@0xsequence/core"
import { Box, Divider } from "@mantine/core"
import { ethers } from "ethers"

export type UpdateSnapshot = {
  threshold: number,
  signers: {
    address: string,
    weight: number
  }[]
}

function isUpdateSnapshot(update: any): update is UpdateSnapshot {
  return (
    typeof update.threshold === 'number' &&
    Array.isArray(update.signers) &&
    update.signers.every((signer: any) => (
      typeof signer.address === 'string' &&
      (typeof signer.weight === 'number' || signer.weight === 0)
    ))
  )
}

function toUpdateSnapshot(update: UpdateSnapshot | commons.config.Config): UpdateSnapshot | undefined {
  if (isUpdateSnapshot(update)) {
    return update
  }

  try {
    if ((update as any).threshold === undefined) {
      throw new Error("Threshold is required")
    }

    const coder = universal.genericCoderFor(update.version).config
    const signers = coder.signersOf(update).map((signer) => ({
      address: signer.address,
      weight: signer.weight
    }))

    return {
      threshold: (update as any).threshold,
      signers
    }
  } catch (e) {
    console.error(e)
  }

  return undefined
}

type Entry = {
  address: string,
  weight: number
}

function getChanges(
  oldEntries: Entry[],
  newEntries: Entry[]
): { added: Entry[], removed: Entry[] } {
  const added: Entry[] = [];
  const removed: Entry[] = [];

  // Any address that exists in the old entries but not in the new entries is removed
  const tmpNewEntries = [...newEntries]
  for (const oldEntry of oldEntries) {
    const index = tmpNewEntries.findIndex((entry) => (
      entry.address === oldEntry.address && entry.weight === oldEntry.weight
    ))
    if (index === -1) {
      removed.push(oldEntry)
    } else {
      tmpNewEntries.splice(index, 1)
    }
  }

  // Any address that exists in the new entries but not in the old entries is added
  const tmpOldEntries = [...oldEntries]
  for (const newEntry of newEntries) {
    if (!ethers.utils.isAddress(newEntry.address)) {
      continue
    }

    const index = tmpOldEntries.findIndex((entry) => (
      entry.address === newEntry.address && entry.weight === newEntry.weight
    ))
    if (index === -1) {
      added.push(newEntry)
    } else {
      tmpOldEntries.splice(index, 1)
    }
  }

  return { added, removed }
}

export function UpdateDiff(props: {
  from: UpdateSnapshot | commons.config.Config,
  to: UpdateSnapshot | commons.config.Config
}) {
  const from = toUpdateSnapshot(props.from)
  const to = toUpdateSnapshot(props.to)

  if (!from || !to) {
    return <div>Invalid update</div>
  }

  const changes = getChanges(from.signers, to.signers)

  const addRows = changes.added.map((signer) => `+ ${signer.address} (Weight ${signer.weight})`)
  const delRows = changes.removed.map((signer) => `- ${signer.address} (Weight ${signer.weight})`)

  if (from.threshold !== to.threshold) {
    delRows.unshift(`- Threshold ${from.threshold}`)
    addRows.unshift(`+ Threshold ${to.threshold}`)
  }

  return <>
    { (delRows.length !== 0 || addRows.length !== 0) && <Box mb="md">
      <Box style={{ fontSize: '12px', fontFamily: 'Courier New, monospace' }}>
        { delRows.length > 0 && <Box style={{ color: "red" }} mb="md">
          <h5 style={{ fontSize: '14px', margin: 0 }}>Removing</h5>
          { delRows.map((val, index) => (
            <Box key={index} mb="xs">{val}</Box>
          )) }
        </Box> }
        { addRows.length > 0 && <Box style={{ color: "green" }} mb="md">
          <h5 style={{ fontSize: '14px', margin: 0 }}>Adding</h5>
          { addRows.map((signer, index) => (
            <Box key={index} mb="xs">{signer}</Box>
          )) }
        </Box> }
      </Box>
      <Divider my="md" />
    </Box> }
  </>
}