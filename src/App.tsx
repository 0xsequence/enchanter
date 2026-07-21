import { AppShell, Anchor, Box, Burger, Group, NativeSelect, NavLink, ScrollArea, Text } from '@mantine/core';
import enchanterLogo from './assets/brand/enchanter-logo.svg';
import { useDisclosure } from '@mantine/hooks';
import { IconCirclePlus, IconEdit, IconFileImport, IconFileUpload, IconHome, IconList, IconListDetails, IconMessage, IconSend2, IconWallet, IconWritingSign } from '@tabler/icons-react';
import { Route, Routes, useLocation, useNavigate } from "react-router-dom"
import { Create } from './sections/Create';
import { Notifications } from '@mantine/notifications';
import { Home } from './sections/Home';
import { Wallet } from './sections/Wallet';
import { useWalletRoute, WalletSection } from './hooks/WalletRoute';
import { Send } from './sections/Send';
import { Sign } from './sections/Sign';
import { ConnectKitButton } from 'connectkit';
import { Transaction } from './sections/Transaction';
import { Message } from './sections/Message';
import { Transactions } from './sections/Transactions';
import { useImport } from './hooks/Import';
import { ImportWallet } from './sections/ImportWallet';
import { useWallets } from './stores/db/Wallets';
import { Update } from './sections/Update';
import { Updates } from './sections/Updates';
import { UpdateDetail } from './sections/UpdateDetail';
import { Messages } from './sections/Messages';

declare const __COMMIT_HASH__: string

const WALLET_LINKS: { section: WalletSection, label: string, icon: typeof IconWallet }[] = [
  { section: 'wallet', label: 'Wallet', icon: IconWallet },
  { section: 'new-transaction', label: 'New Transaction', icon: IconSend2 },
  { section: 'transactions', label: 'Transactions', icon: IconList },
  { section: 'update', label: 'Update Signers', icon: IconEdit },
  { section: 'updates', label: 'Pending Updates', icon: IconListDetails },
  { section: 'sign-message', label: 'Sign Message', icon: IconWritingSign },
  { section: 'messages', label: 'Messages', icon: IconMessage },
]

function shortAddress(address: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(address)
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address
}

export function App() {
  const importModal = useImport()

  const [opened, { toggle }] = useDisclosure();

  const navigate = useNavigate()

  const { wallets } = useWallets()

  // The URL is the single source of truth for which wallet is active
  const { address: activeWallet, section: activeSection } = useWalletRoute()

  const location = useLocation()
  const { pathname } = location;

  const knownWallet = wallets.find((w) => w.address === activeWallet)

  return (<>
      <Notifications />
      <AppShell
        header={{ height: 60 }}
        navbar={{ width: 300, breakpoint: 'sm', collapsed: { mobile: !opened } }}
        padding={{ base: 'md', sm: 'xl' }}
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between" wrap="nowrap">
            <Group gap={12} wrap="nowrap" align="center">
              <Burger opened={opened} onClick={toggle} size="sm" hiddenFrom="sm" />
              <img src={enchanterLogo} alt="Enchanter" style={{ height: 34, display: 'block' }} />
            </Group>
            <ConnectKitButton />
          </Group>
        </AppShell.Header>
        <AppShell.Navbar p="md">
          <AppShell.Section grow component={ScrollArea} scrollbarSize={6} type="never">
          <Box className="nav-section-label">General</Box>
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
          <Box className="nav-section-label">Wallet</Box>
          {(wallets.length > 0 || activeWallet) && (
            <NativeSelect
              aria-label="Active wallet"
              data={[
                ...(activeWallet ? [] : [{ label: 'Select wallet…', value: '' }]),
                ...wallets.map(w => ({
                  label: `${w.name} · ${shortAddress(w.address)}`,
                  value: w.address,
                })),
                ...(activeWallet && !knownWallet
                  ? [{ label: shortAddress(activeWallet), value: activeWallet }]
                  : []),
              ]}
              mb="xs"
              styles={{
                input: {
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                },
              }}
              onChange={(event) => {
                if (event.target.value) {
                  navigate(`/${activeSection ?? 'wallet'}/${event.target.value}`)
                }
              }}
              value={activeWallet ?? ''}
            />
          )}
          {activeWallet ? WALLET_LINKS.map(({ section, label, icon: Icon }) => (
            <NavLink
              key={section}
              href={`#${section}/${activeWallet}`}
              label={label}
              leftSection={<Icon size="1rem" stroke={1.5} />}
              active={activeSection === section}
            />
          )) : (
            <Text fz="sm" c="dimmed" px={12} py={4}>
              {wallets.length > 0
                ? 'Select a wallet to view and operate it.'
                : 'Create or import a wallet to get started.'}
            </Text>
          )}
          </AppShell.Section>
          <AppShell.Section pt="sm" style={{ borderTop: '1px solid var(--border)' }}>
            <Text ff="monospace" fz={12} c="dimmed">
              Version: 0x{__COMMIT_HASH__ || "Development mode"}
            </Text>
            <Anchor
              ff="monospace"
              fz={12}
              c="dimmed"
              td="underline"
              href="https://github.com/0xsequence/enchanter"
              target="_blank"
              rel="noreferrer"
            >
              github.com/0xsequence/enchanter
            </Anchor>
          </AppShell.Section>
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
            <Route path="/message/:subdigest" element={<Message />} />
            <Route path="/update/:address" element={<Update />} />
            <Route path="/updates/:address" element={<Updates />} />
            <Route path="/do-update/:subdigest" element={<UpdateDetail />} />
            <Route path="/sign-message/:address" element={<Sign />} />
            <Route path="/messages/:address" element={<Messages />} />
          </Routes>
        </AppShell.Main>
      </AppShell>
  </>);
}

export default App;