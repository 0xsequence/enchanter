import { Text, Table, Box } from "@mantine/core";
import { TransactionsEntry } from "../stores/db/Transactions";

export function Actions(props: { transaction: TransactionsEntry }) {
  const rows = props.transaction.transactions.map((element, i) => (
    <Table.Tr key={i} style={{ verticalAlign: "text-top" }}>
      <Table.Td>{element.to}</Table.Td>
      <Table.Td>{element.value || "0"}</Table.Td>
      <Table.Td>
        <Box>
          <Text style={{ lineBreak: "anywhere" }}>{element.data || "0x"}</Text>
        </Box>
      </Table.Td>
      <Table.Td>
        {element.gasLimit || element.revertOnError ? "Auto" : "0"}
      </Table.Td>
      <Table.Td>{element.revertOnError ? "Yes" : "No"}</Table.Td>
      <Table.Td>{element.delegateCall ? "Yes" : "No"}</Table.Td>
    </Table.Tr>
  ));

  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>To</Table.Th>
          <Table.Th>Value</Table.Th>
          <Table.Th>Data</Table.Th>
          <Table.Th>Gas</Table.Th>
          <Table.Th>Revert on error</Table.Th>
          <Table.Th>Delegate call</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>{rows}</Table.Tbody>
    </Table>
  );
}
