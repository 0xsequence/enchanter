import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { HashRouter as Router } from "react-router-dom"

import { createTheme, MantineProvider } from '@mantine/core'

import { WagmiProvider, createConfig } from "wagmi"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ConnectKitProvider, getDefaultConfig } from "connectkit"
import { NETWORKS } from './stores/Sequence.ts';
import { Chain, defineChain } from 'viem';
import { ImportProvider } from './providers/Import.tsx';
import { ExportProvider } from './providers/Export.tsx';

const theme = createTheme({
  /** Put your mantine theme override here */
})


const config = createConfig(
  getDefaultConfig({
    // Your dApps chains
    chains: (NETWORKS.sort((a, b) => a.chainId - b.chainId).map((n) => {
      return defineChain({
        id: n.chainId,
        name: n.name,
        rpcUrls: {
          default: {
            http: [n.rpcUrl]
          },
        },
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      }) as Chain
    }) as unknown as readonly [Chain, ...Chain[]]),

    // Required API Keys
    walletConnectProjectId: "",

    // Required App Info
    appName: "Sequence Enchanter1",

    // Optional App Info
    appDescription: "Sequence Enchanter",
    appUrl: "https://family.co", // your app's url
    appIcon: "https://family.co/logo.png", // your app's icon, no bigger than 1024x1024px (max. 1MB)
  }),
)

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme}>
      <Router>
        <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <ConnectKitProvider>
            <ExportProvider>
              <ImportProvider>
                <App />
              </ImportProvider>
            </ExportProvider>
          </ConnectKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </Router>
    </MantineProvider>
  </React.StrictMode>,
)
