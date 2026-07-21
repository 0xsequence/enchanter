import { useNavigate, useParams } from "react-router-dom"
import { ethers } from "ethers"
import { Button, Table, Text } from "@mantine/core"
import { subdigestOf, useTransactions } from "../stores/db/Transactions"
import { Page, PageHeader, Panel } from "../components/Page"

export function Transactions() {
  const { address } = useParams<{ address: string }>()

  const transactions = useTransactions({ wallet: address })

  const navigate = useNavigate()

  const header = <PageHeader
    title="Transactions"
    description="Transactions staged for this wallet, newest first."
    meta={address?.toString() || "Undefined"}
  />

  if (!address || !ethers.isAddress(address)) {
    return <Page>{header} Invalid wallet address</Page>
  }

  if (!transactions) {
    return <Page>{header} No transactions found</Page>
  }

  // Sort by highest space first
  // then by highest nonce
  const sorted = transactions.sort((a, b) => {
    if (a.space > b.space) return -1
    if (a.space < b.space) return 1
    if (a.nonce > b.nonce) return -1
    if (a.nonce < b.nonce) return 1
    return 0
  })

  const txRows = sorted.map((element, i) => {
    const subdigest = subdigestOf(element)
    return <Table.Tr key={i}>
      <Table.Td className="mono-data" style={{ minWidth: 260 }}>{subdigest}</Table.Td>
      <Table.Td className="mono-data">{element.chainId}</Table.Td>
      <Table.Td className="mono-data">{element.space}</Table.Td>
      <Table.Td className="mono-data">{element.nonce}</Table.Td>
      <Table.Td className="mono-data">{element.transactions.length}</Table.Td>
      <Table.Td style={{ whiteSpace: 'nowrap' }}>{element.space ? new Date(Number(element.space)).toDateString(): "--"}</Table.Td>
      <Table.Td align="right">
        <Button
          size="compact-sm"
          variant="light"
          onClick={() => {
            navigate('/transaction/' + subdigest)
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
            <Table.Th>Subdigest</Table.Th>
            <Table.Th>Chain ID</Table.Th>
            <Table.Th>Space</Table.Th>
            <Table.Th>Nonce</Table.Th>
            <Table.Th>Actions</Table.Th>
            <Table.Th>First Seen</Table.Th>
            <Table.Th></Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {txRows.length > 0 ? txRows : (
            <Table.Tr>
              <Table.Td colSpan={7}>
                <Text fz="sm" c="dimmed" ta="center" py="xl">
                  No transactions yet. Create one from “New Transaction”.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Panel>
  </Page>
}
