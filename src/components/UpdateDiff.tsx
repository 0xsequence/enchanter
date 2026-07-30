import { commons } from "@0xsequence/core"
import { Alert, Box, Divider, Text } from "@mantine/core"
import { IconFlag } from "@tabler/icons-react"
import { ethers } from "ethers"
import { SignerLabel } from "./SignerLabel"
import { useAddressLabels } from "../stores/db/AddressLabels"

export type UpdateSnapshot = {
  threshold: number,
  signers: {
    address: string,
    weight: number
  }[]
}

function isUpdateSnapshot(update: unknown): update is UpdateSnapshot {
  return (
    typeof update === 'object' && update !== null &&
    typeof (update as UpdateSnapshot).threshold === 'number' &&
    Array.isArray((update as UpdateSnapshot).signers) &&
    (update as UpdateSnapshot).signers.every((signer) => (
      typeof signer.address === 'string' &&
      (typeof signer.weight === 'number' || signer.weight === 0)
    ))
  );
}

function toUpdateSnapshot(update: UpdateSnapshot | commons.config.Config): UpdateSnapshot | undefined {
  if (isUpdateSnapshot(update)) {
    return update
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
    if (!ethers.isAddress(newEntry.address)) {
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
  to: UpdateSnapshot | commons.config.Config,
  noAlert?: boolean
}) {
  const { labelForAddress } = useAddressLabels()
  const from = toUpdateSnapshot(props.from)
  const to = toUpdateSnapshot(props.to)

  if (!from || !to) {
    return <div>Invalid update</div>
  }

  const changes = getChanges(from.signers, to.signers)
  const thresholdChanged = from.threshold !== to.threshold
  const hasRemoved = thresholdChanged || changes.removed.length > 0
  const hasAdded = thresholdChanged || changes.added.length > 0

  const signerRow = (prefix: "+" | "-", signer: Entry, color: string) => (
    <Box key={`${prefix}-${signer.address}-${signer.weight}`} mb={4} c={color}>
      <Text span mr={4}>{prefix}</Text>
      <SignerLabel address={signer.address} label={labelForAddress(signer.address)} />
      <Text span className="mono-data" ml={6}>{signer.address}</Text>
      <Text span> (Weight {signer.weight})</Text>
    </Box>
  )

  return <>
    { (hasRemoved || hasAdded) && <Box mb="md">
      <Box>
        { hasRemoved && <Box mb="md">
          <Box mb={6} style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
            Removing
          </Box>
          { thresholdChanged && <Box className="mono-data" mb={4} c="red.9">- Threshold {from.threshold}</Box> }
          { changes.removed.map((signer) => signerRow("-", signer, "red.9")) }
        </Box> }
        { hasAdded && <Box mb="md">
          <Box mb={6} style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
            Adding
          </Box>
          { thresholdChanged && <Box className="mono-data" mb={4} c="green.9">+ Threshold {to.threshold}</Box> }
          { changes.added.map((signer) => signerRow("+", signer, "green.9")) }
        </Box> }
      </Box>
      { !props.noAlert && hasRemoved && <Alert variant="light" color="red" title="Removing Signers" icon={<IconFlag/>}>
        Revoking weight only takes effect after sending a transaction on-chain, networks will be updated independently.
      </Alert>}
      <Divider my="md" />
    </Box> }
  </>
}
