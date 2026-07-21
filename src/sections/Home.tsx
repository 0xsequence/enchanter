import { Button, Loader, Table, Text } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { useWallets } from "../stores/db/Wallets";
import { useDetectedWallets } from "../stores/Witness";
import { Page, PageHeader, Panel, SectionTitle } from "../components/Page";

export function Home () {
  const { wallets, addWallet } = useWallets()
  const account = useAccount()
  const { detected, loading: detecting } = useDetectedWallets(account.address, wallets)

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

  const detectedRows = detected.map((address) => (
    <Table.Tr key={address}>
      <Table.Td className="mono-data">{address}</Table.Td>
      <Table.Td align="right">
        <Button
          size="compact-sm"
          variant="light"
          onClick={() => addWallet(address, `Detected ${address.slice(0, 6)}…${address.slice(-4)}`)}
        >
          Add
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
      {account.address && (detected.length > 0 || detecting) && <>
        <SectionTitle>Detected wallets</SectionTitle>
        <Panel>
          {detected.length > 0 ? (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Address</Table.Th>
                  <Table.Th></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{detectedRows}</Table.Tbody>
            </Table>
          ) : (
            <Text fz="sm" c="dimmed" ta="center" py="lg">
              <Loader size="xs" mr="xs" style={{ verticalAlign: 'middle' }} /> Looking up wallets witnessed by the connected signer…
            </Text>
          )}
          <Text fz="xs" c="dimmed" px={12} py={8}>
            Wallets the connected signer has published witness signatures for on the Sequence Key
            Machine. Sign a transaction or use “Sign witness” on a wallet to make it detectable.
          </Text>
        </Panel>
      </>}
    </Page>
  )
}
