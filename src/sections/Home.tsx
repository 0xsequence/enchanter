import { Button, Table, Text } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { useWallets } from "../stores/db/Wallets";
import { Page, PageHeader, Panel } from "../components/Page";

export function Home () {
  const { wallets } = useWallets()

  const navigate = useNavigate()

  const rows = wallets.map((element) => (
    <Table.Tr key={element.name}>
      <Table.Td fw={500}>{element.name}</Table.Td>
      <Table.Td className="mono-data">{element.address}</Table.Td>
      <Table.Td align="right">
        <Button
          size="compact-sm"
          variant="light"
          onClick={() => navigate('/wallet/' + element.address)}
        >
          Open
        </Button>
      </Table.Td>
    </Table.Tr>
  ))

  return (
    <Page>
      <PageHeader
        title="My wallets"
        description="Sequence multisig wallets stored in this browser. Open one to review signers, collect signatures, and execute transactions."
        actions={<>
          <Button variant="default" onClick={() => navigate('/import-wallet')}>Import wallet</Button>
          <Button onClick={() => navigate('/create-wallet')}>Create wallet</Button>
        </>}
      />
      <Panel>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Address</Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length > 0 ? rows : (
              <Table.Tr>
                <Table.Td colSpan={3}>
                  <Text fz="sm" c="dimmed" ta="center" py="xl">
                    No wallets yet. Create a new wallet or import an existing one to get started.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Panel>
    </Page>
  )
}
