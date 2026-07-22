import { useNavigate, useParams } from "react-router-dom"
import { ethers } from "ethers"
import { Button, Table, Text } from "@mantine/core"
import { useMessages } from "../stores/db/Messages"
import { Page, PageHeader, Panel } from "../components/Page"

export function Messages() {
  const { address } = useParams<{ address: string }>()

  const messages = useMessages({ wallet: address })

  const navigate = useNavigate()

  const header = <PageHeader
    title="Messages"
    description="Messages staged for signing with this wallet."
    meta={address?.toString() || "Undefined"}
  />

  if (!address || !ethers.isAddress(address)) {
    return <Page>{header} Invalid wallet address</Page>
  }

  if (!messages) {
    return <Page>{header} No messages found</Page>
  }

  const sorted = messages.sort((a, b) => {
    const aId = a.id ?? 0
    const bId = b.id ?? 0
    if (aId > bId) return -1
    if (aId < bId) return 1
    return 0
  })

  const messageRows = sorted.map((element, i) => {
    return <Table.Tr key={i}>
      <Table.Td style={{ lineBreak: 'anywhere', minWidth: 260 }}>{element.raw}</Table.Td>
      <Table.Td className="mono-data">{element.chainId}</Table.Td>
      <Table.Td style={{ whiteSpace: 'nowrap' }}>{element.firstSeen ? new Date(element.firstSeen).toDateString() : "--"}</Table.Td>
      <Table.Td align="right">
        <Button
          size="compact-sm"
          variant="light"
          onClick={() => {
            navigate('/message/' + element.subdigest)
          }}
        >
          Open
        </Button>
      </Table.Td>
    </Table.Tr>
  })

  return <Page>
    {header}
    <Panel>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Content</Table.Th>
            <Table.Th>Chain ID</Table.Th>
            <Table.Th>First Seen</Table.Th>
            <Table.Th></Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {messageRows.length > 0 ? messageRows : (
            <Table.Tr>
              <Table.Td colSpan={4}>
                <Text fz="sm" c="dimmed" ta="center" py="xl">
                  No messages yet. Create one from “Sign Message”.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Panel>
  </Page>
}
