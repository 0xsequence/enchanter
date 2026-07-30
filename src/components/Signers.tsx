import { Table } from "@mantine/core";
import { SignerLabel } from "./SignerLabel";
import { WalletSigner } from "../stores/Sequence";
import { useAddressLabels } from "../stores/db/AddressLabels";

export function Signers(args: { signers: WalletSigner[] }) {
  const { labelForAddress, loaded, saveAddressLabel } = useAddressLabels()

  const rows = args.signers.map((element) => (
    <Table.Tr key={element.address}>
      <Table.Td style={{ minWidth: 240 }}>
        <SignerLabel
          address={element.address}
          label={labelForAddress(element.address)}
          onSave={loaded ? (label) => saveAddressLabel(element.address, label) : undefined}
        />
      </Table.Td>
      <Table.Td className="mono-data">{element.address}</Table.Td>
      <Table.Td className="mono-data">{element.weight}</Table.Td>
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
