
import { Badge, Table } from "@mantine/core"
import { SignerLabel } from "./SignerLabel"
import { UnifiedAccountState, useRecovered } from "../stores/Sequence"
import { useAddressLabels } from "../stores/db/AddressLabels"

export function Signatures(props: { state: UnifiedAccountState, signatures: string[], subdigest: string }) {
  const signers = props.state.signers
  const recovered = useRecovered(props.subdigest, props.signatures, props.state.version)
  const { labelForAddress } = useAddressLabels()

  const rows = signers.map((element) => (
    <Table.Tr key={element.address}>
      <Table.Td style={{ minWidth: 180 }}>
        <SignerLabel address={element.address} label={labelForAddress(element.address)} />
      </Table.Td>
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
