import { v2 } from "@0xsequence/core";
import { Table } from "@mantine/core";
import { nameForAddress } from "../Names";

export function Signers(args: { config: v2.config.WalletConfig }) {
  const rows = v2.config.ConfigCoder.signersOf(args.config).map((element) => (
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
