import { useNavigate, useParams } from "react-router-dom"
import { ethers } from "ethers"
import { Button, Loader, Table, Text } from "@mantine/core"
import { CardGrid, MiniCard } from "../components/MiniCard"
import { useUpdates } from "../stores/db/Updates"
import { useAccountState } from "../stores/Sequence"
import { Page, PageHeader, Panel, SectionTitle } from "../components/Page"

export function Updates() {
  const { address } = useParams<{ address: string }>()

  const header = <PageHeader
    title="Pending Updates"
    description="Configuration changes waiting to reach the wallet checkpoint."
    meta={address?.toString() || "Undefined"}
  />

  const up = useUpdates({ wallet: address })
  const st = useAccountState(address)
  const navigate = useNavigate()

  if (!address || !ethers.isAddress(address)) {
    return <Page>{header} Invalid wallet address</Page>
  }

  const loading = up.loading || st.loading

  if (loading) {
    return <Page>{header} <Loader /></Page>
  }

  const { updates } = up
  const { state, error } = st
  if (error || !state) {
    return <Page>{header} Error: {error}</Page>
  }

  const checkpoint = state.checkpoint

  const checkpointCard = <CardGrid>
    <MiniCard title="Checkpoint" value={checkpoint.toString()} />
  </CardGrid>

  if (!updates) {
    return <Page>{header}{checkpointCard} No updates found</Page>
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

  const updateRow = (element: typeof sorted[number], i: number, dimmed: boolean) => (
    <Table.Tr key={i}>
      <Table.Td className="mono-data" c={dimmed ? 'dimmed' : undefined} style={{ minWidth: 260 }}>{element.imageHash}</Table.Td>
      <Table.Td className="mono-data" c={dimmed ? 'dimmed' : undefined}>{element.checkpoint}</Table.Td>
      <Table.Td className="mono-data" c={dimmed ? 'dimmed' : undefined}>{(BigInt(element.checkpoint) - checkpoint).toString()}</Table.Td>
      <Table.Td align="right">
        <Button
          size="compact-sm"
          variant="light"
          onClick={() => {
            navigate('/do-update/' + element.subdigest)
          }}
        >
          Open
        </Button>
      </Table.Td>
    </Table.Tr>
  )

  const tableHead = <Table.Thead>
    <Table.Tr>
      <Table.Th>ImageHash</Table.Th>
      <Table.Th>Checkpoint</Table.Th>
      <Table.Th>Delta</Table.Th>
      <Table.Th></Table.Th>
    </Table.Tr>
  </Table.Thead>

  return <Page>
    {header}
    {checkpointCard}
    {pendingUpdates.length === 0 && pastUpdates.length === 0 && (
      <Text fz="sm" c="dimmed">No updates for this wallet yet.</Text>
    )}
    {pendingUpdates.length > 0 && <>
      <SectionTitle>Pending Updates</SectionTitle>
      <Panel>
        <Table>
          {tableHead}
          <Table.Tbody>{pendingUpdates.map((element, i) => updateRow(element, i, false))}</Table.Tbody>
        </Table>
      </Panel>
    </>}
    {pastUpdates.length > 0 && <>
      <SectionTitle>Past Updates</SectionTitle>
      <Panel>
        <Table>
          {tableHead}
          <Table.Tbody>{pastUpdates.map((element, i) => updateRow(element, i, true))}</Table.Tbody>
        </Table>
      </Panel>
    </>}
  </Page>
}
