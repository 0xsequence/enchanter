
import { universal } from "@0xsequence/core"
import { AccountStatus } from "@0xsequence/account"
import { Table } from "@mantine/core"
import { nameForAddress } from "../Names"
import { useRecovered } from "../stores/Sequence"

export function Signatures(props: { state: AccountStatus, signatures: string[], subdigest: string }) {
  const signers = universal.genericCoderFor(props.state.config.version).config.signersOf(props.state.config)
  const recovered = useRecovered(props.subdigest, props.signatures)

  const rows = signers.map((element) => (
    <Table.Tr key={element.address}>
      <Table.Td>{nameForAddress(element.address)}</Table.Td>
      <Table.Td>{element.address}</Table.Td>
      <Table.Td>{element.weight}</Table.Td>
      <Table.Td>{recovered.has(element.address) ? "✅" : "🔴"}</Table.Td>
    </Table.Tr>
  ))

  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Signer</Table.Th>
          <Table.Th>Address</Table.Th>
          <Table.Th>Weight</Table.Th>
          <Table.Th>Signed</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>{rows}</Table.Tbody>
    </Table>
  )
}
