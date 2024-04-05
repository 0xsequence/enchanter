import { Button, Table, Title } from "@mantine/core";
import { setSelectedWallet } from "../stores/Storage";
import { useNavigate } from "react-router-dom";
import { useWallets } from "../stores/db/Wallets";

export function Home () {
  const { wallets } = useWallets()

  const navigate = useNavigate()

  const rows = wallets.map((element) => (
    <Table.Tr key={element.name}>
      <Table.Td>{element.name}</Table.Td>
      <Table.Td>{element.address}</Table.Td>
      <Table.Td>
        <Button
          size="compact-sm"
          variant="outline"
          onClick={() => {
            setSelectedWallet(element.address)
            navigate('/wallet/' + element.address)
          }}
        >
          Open
        </Button>
      </Table.Td>
    </Table.Tr>
  ))

  return (
    <div>
      <Title order={3} mb="md">My wallets</Title>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Address</Table.Th>
            <Table.Th></Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{rows}</Table.Tbody>
      </Table>
    </div>
  )
}