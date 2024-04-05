import { AppShell, Box, Burger, Divider, Grid, Group, NativeSelect, NavLink, Title, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconCirclePlus, IconFileImport, IconFileUpload, IconHome, IconList, IconSend2, IconWallet } from '@tabler/icons-react';
import { Route, Routes, useLocation, useNavigate } from "react-router-dom"
import { Create } from './sections/Create';
import { Notifications } from '@mantine/notifications';
import { Home } from './sections/Home';
import { Wallet } from './sections/Wallet';
import { useSelectedWallet } from './stores/Storage';
import { Send } from './sections/Send';
import { ConnectKitButton } from 'connectkit';
import { Transaction } from './sections/Transaction';
import { Transactions } from './sections/Transactions';
import { useImport } from './sections/Import';
import { ImportWallet } from './sections/ImportWallet';
import { useWallets } from './stores/db/Wallets';


export function App() {
  const importModal = useImport()

  const [opened, { toggle }] = useDisclosure();

  const navigate = useNavigate()

  const { wallets } = useWallets()
  const { selectedWalletAddress, updateSelectedWalletAddress } = useSelectedWallet()

  const location = useLocation()
  const { pathname } = location;

  return (<>
      <Notifications />
      <AppShell
        header={{ height: 60 }}
        navbar={{ width: 300, breakpoint: 'sm', collapsed: { mobile: !opened } }}
        padding="md"
      >
        <AppShell.Header>
          <Group h="100%" px="md">
            <Grid justify="space-between" style={{width: "100%"}}>
              <Grid.Col span={"content"}>
                <Burger opened={opened} onClick={toggle} size="sm" hiddenFrom="sm" />
                <Title order={2}>🧙🏻 Sequence Enchanter</Title>
              </Grid.Col>
              <Grid.Col span={"content"}>
                <ConnectKitButton />
              </Grid.Col>
            </Grid>
          </Group>
        </AppShell.Header>
        <AppShell.Navbar p="md">
          <NavLink
            href="#"
            label="Home"
            leftSection={<IconHome size="1rem" stroke={1.5} />}
            active={pathname === '/'}
          />
          <NavLink
            href="#create-wallet"
            label="Create Wallet"
            leftSection={<IconCirclePlus size="1rem" stroke={1.5} />}
            active={pathname === '/create-wallet'}
          />
          <NavLink
            href="#import-wallet"
            label="Import Wallet"
            leftSection={<IconFileImport size="1rem" stroke={1.5} />}
            active={pathname === '/import-wallet'}
          />
          <NavLink
            label="Import Data"
            leftSection={<IconFileUpload size="1rem" stroke={1.5} />}
            active={importModal.opened}
            onClick={importModal.open}
          />
          <Divider />
          <NativeSelect
            description="Selected wallet"
            data={['Select wallet', ...wallets.map(w => w.address)]}
            mt="md"
            mb="md"
            onChange={(event) => {
              if (event.target.value !== 'Select wallet') {
                updateSelectedWalletAddress(event.target.value)
                navigate('/wallet/' + event.target.value)
              }
            }}
            value={selectedWalletAddress}
            />
          <Divider />
          <NavLink
            href={"#wallet/" + selectedWalletAddress}
            label="Wallet"
            leftSection={<IconWallet size="1rem" stroke={1.5} />}
            active={pathname === '/wallet/' + selectedWalletAddress}
            disabled={!selectedWalletAddress}
          />
          <NavLink
            href={"#new-transaction/" + selectedWalletAddress}
            label="New Transaction"
            leftSection={<IconSend2 size="1rem" stroke={1.5} />}
            active={pathname === '/new-transaction/' + selectedWalletAddress}
            disabled={!selectedWalletAddress}
          />
          <NavLink
            href={"#transactions/" + selectedWalletAddress}
            label="Transactions"
            leftSection={<IconList size="1rem" stroke={1.5} />}
            active={pathname === '/transactions/' + selectedWalletAddress}
            disabled={!selectedWalletAddress}
          />
          <Box mt="auto" />
          <Box>
            <Text size="sm" c="dimmed">Source</Text>
            <Text
              size="sm"
              c="dimmed"
              td="underline"
              style={{ cursor: 'pointer' }}
              onClick={() => window.open('https://github.com/0xsequence/enchanter')}
            > 
              https://github.com/0xsequence/enchanter
            </Text>
          </Box>
        </AppShell.Navbar>
        <AppShell.Main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/import-wallet" element={<ImportWallet />} />
            <Route path="/create-wallet" element={<Create />} />
            <Route path="/wallet/:address" element={<Wallet />} />
            <Route path="/new-transaction/:address" element={<Send />} />
            <Route path="/transactions/:address" element={<Transactions />} />
            <Route path="/transaction/:subdigest" element={<Transaction />} />
          </Routes>
        </AppShell.Main>
      </AppShell>
  </>);
}

export default App;