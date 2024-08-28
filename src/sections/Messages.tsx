import { useNavigate, useParams } from "react-router-dom"
import { ethers } from "ethers"
import { Button, Table, Title } from "@mantine/core"
import { MiniCard } from "../components/MiniCard"
import { useMessages } from "../stores/db/Messages"

export function Messages() {
  const { address } = useParams<{ address: string }>()

  const messages = useMessages({ wallet: address })

  const navigate = useNavigate()

  const title = <>
    <Title order={3} mb="md">Messages</Title>
    <MiniCard title="Wallet" value={address?.toString() || "Undefined"} />
  </>

  if (!address || !ethers.utils.isAddress(address)) {
    return <>{title} Invalid wallet address</>
  }

  if (!messages) {
    return <>{title} No messages found</>
  }

  const messageRows = messages.map((element, i) => {
    return <Table.Tr key={i}>
      <Table.Td>{element.raw}</Table.Td>
      <Table.Td>{element.chainId}</Table.Td>
      <Table.Td>
        <Button
          size="compact-sm"
          variant="outline"
          onClick={() => {
            navigate('/message/' + element.subdigest)
          }}
        >
          Open
        </Button>
      </Table.Td>
    </Table.Tr>
  })

  return <>
    {title}
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Content</Table.Th>
          <Table.Th>Chain ID</Table.Th>
          <Table.Th>Actions</Table.Th>
          <Table.Th></Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>{messageRows}</Table.Tbody>
    </Table>
  </>
}