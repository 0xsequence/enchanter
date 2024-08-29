import { useNavigate, useParams } from "react-router-dom"
import { ethers } from "ethers"
import { Button, Table, Title } from "@mantine/core"
import { MiniCard } from "../components/MiniCard"
import { subdigestOf, useTransactions } from "../stores/db/Transactions"

export function Transactions() {
  const { address } = useParams<{ address: string }>()

  const title = <>
    <Title order={3} mb="md">Transactions</Title>
    <MiniCard title="Wallet" value={address?.toString() || "Undefined"} />
  </>

  const transactions = useTransactions({ wallet: address })

  const navigate = useNavigate()

  if (!address || !ethers.utils.isAddress(address)) {
    return <>{title} Invalid wallet address</>
  }

  if (!transactions) {
    return <>{title} No transactions found</>
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
      <Table.Td>{subdigest}</Table.Td>
      <Table.Td>{element.chainId}</Table.Td>
      <Table.Td>{element.space}</Table.Td>
      <Table.Td>{element.nonce}</Table.Td>
      <Table.Td>{element.transactions.length}</Table.Td>
      <Table.Td>{element.firstSeen ? new Date(element.firstSeen).toDateString() : "--"}</Table.Td>
      <Table.Td>
        <Button
          size="compact-sm"
          variant="outline"
          onClick={() => {
            navigate('/transaction/' + subdigest)
          }}
        >
          Open
        </Button>
      </Table.Td>
    </Table.Tr>
  })

  return <>
    {title}
    <Title order={5} mt="lx">Transactions</Title>
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
      <Table.Tbody>{txRows}</Table.Tbody>
    </Table>
  </>
}