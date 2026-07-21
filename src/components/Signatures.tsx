
import { Badge, Table } from "@mantine/core"
import { nameForAddress } from "../Names"
import { UnifiedAccountState, useRecovered } from "../stores/Sequence"

export function Signatures(props: { state: UnifiedAccountState, signatures: string[], subdigest: string }) {
  const signers = props.state.signers
  const recovered = useRecovered(props.subdigest, props.signatures, props.state.version)

  const rows = signers.map((element) => (
    <Table.Tr key={element.address}>
      <Table.Td style={{ whiteSpace: 'nowrap' }}>{nameForAddress(element.address)}</Table.Td>
      <Table.Td className="mono-data">{element.address}</Table.Td>
      <Table.Td className="mono-data">{element.weight}</Table.Td>
      <Table.Td>
        {recovered.has(element.address)
          ? <Badge variant="light" color="green">Signed</Badge>
          : <Badge variant="light" color="gray">Unsigned</Badge>}
      </Table.Td>
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
