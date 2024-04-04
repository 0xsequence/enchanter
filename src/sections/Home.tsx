import { Button, Table, Title } from "@mantine/core";
import { WalletEntry, getWallets, setSelectedWallet } from "../stores/Storage";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export function Home () {
  const [wallets, setWallets] = useState<WalletEntry[]>([])

  let navigate = useNavigate()

  useEffect(() => {
    setWallets(getWallets())
  }, [])

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