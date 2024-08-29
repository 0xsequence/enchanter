import { useNavigate, useParams } from "react-router-dom"
import { ethers } from "ethers"
import { Button, Loader, Table, Title, Text, Space } from "@mantine/core"
import { MiniCard } from "../components/MiniCard"
import { useUpdates } from "../stores/db/Updates"
import { useAccountState } from "../stores/Sequence"
import { universal } from "@0xsequence/core"

export function Updates() {
  const { address } = useParams<{ address: string }>()

  const title = <>
    <Title order={3} mb="md">Pending Updates</Title>
    <MiniCard title="Wallet" value={address?.toString() || "Undefined"} />
  </>

  const up = useUpdates({ wallet: address })
  const st = useAccountState(address)
  const navigate = useNavigate()

  if (!address || !ethers.utils.isAddress(address)) {
    return <>{title} Invalid wallet address</>
  }

  const loading = up.loading || st.loading

  if (loading) {
    return <>{title} <Loader /></>
  }

  const { updates } = up
  const { state, error } = st
  if (error || !state) {
    return <>{title} Error: {error}</>
  }

  const coder = universal.genericCoderFor(state.config.version)
  const checkpoint = coder.config.checkpointOf(state.config).toNumber()

  const checkpointCard = <MiniCard title="Checkpoint" value={checkpoint.toString()} />

  if (!updates) {
    return <>{title}{checkpointCard} No updates found</>
  }

  const sorted = updates.sort((a, b) => {
    return a.checkpoint - b.checkpoint
  })

  const pendingUpdates = sorted.filter((element) => {
    return element.checkpoint > checkpoint
  })

  const pastUpdates = sorted.filter((element) => {
    return element.checkpoint <= checkpoint
  })

  const pendingRows = pendingUpdates.map((element, i) => {
    return <Table.Tr key={i}>
      <Table.Td>{element.imageHash}</Table.Td>
      <Table.Td>{element.checkpoint}</Table.Td>
      <Table.Td>{element.checkpoint - checkpoint}</Table.Td>
      <Table.Td>
        <Button
          size="compact-sm"
          variant="outline"
          onClick={() => {
            navigate('/do-update/' + element.subdigest)
          }}
        >
          Open
        </Button>
      </Table.Td>
    </Table.Tr>
  })

  const pastRows = pastUpdates.map((element, i) => {
    return <Table.Tr key={i}>
      <Table.Td><Text c="dimmed">{element.imageHash}</Text></Table.Td>
      <Table.Td><Text c="dimmed">{element.checkpoint}</Text></Table.Td>
      <Table.Td><Text c="dimmed">{element.checkpoint - checkpoint}</Text></Table.Td>
      <Table.Td>
        <Button
          size="compact-sm"
          variant="outline"
          onClick={() => {
            navigate('/do-update/' + element.subdigest)
          }}
        >
          Open
        </Button>
      </Table.Td>
    </Table.Tr>
  })

  return <>
    {title}
    {checkpointCard}
    {pendingRows.length > 0 && <>
      <Title order={5} mt="lx">Pending Updates</Title>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>ImageHash</Table.Th>
            <Table.Th>Checkpoint</Table.Th>
            <Table.Th>Delta</Table.Th>
            <Table.Th></Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{pendingRows}</Table.Tbody>
      </Table>
    </>}
    {pastRows.length > 0 && <>
      <Space h="md" />
      <Title order={5} mt="lx">Past Updates</Title>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>ImageHash</Table.Th>
            <Table.Th>Checkpoint</Table.Th>
            <Table.Th>Delta</Table.Th>
            <Table.Th></Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{pastRows}</Table.Tbody>
      </Table>
    </>}
  </>
}