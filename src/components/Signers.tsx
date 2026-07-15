import { Table } from "@mantine/core";
import { nameForAddress } from "../Names";
import { WalletSigner } from "../stores/Sequence";

export function Signers(args: { signers: WalletSigner[] }) {
  const rows = args.signers.map((element) => (
    <Table.Tr key={element.address}>
      <Table.Td>{nameForAddress(element.address)}</Table.Td>
      <Table.Td>{element.address}</Table.Td>
      <Table.Td>{element.weight}</Table.Td>
    </Table.Tr>
  ))

  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Name</Table.Th>
          <Table.Th>Address</Table.Th>
          <Table.Th>Weight</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>{rows}</Table.Tbody>
    </Table>
  )
}
