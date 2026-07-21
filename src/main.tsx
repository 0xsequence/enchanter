import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './index.css'
import { HashRouter as Router } from "react-router-dom"

import { createTheme, MantineColorsTuple, MantineProvider } from '@mantine/core'

import { WagmiProvider, createConfig } from "wagmi"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ConnectKitProvider, getDefaultConfig } from "connectkit"
import { NETWORKS } from './stores/Sequence.ts';
import { Chain, defineChain } from 'viem';
import { ImportProvider } from './providers/Import.tsx';
import { ExportProvider } from './providers/Export.tsx';

// Polygon Brand 2026 — POL Purple #6700E5 (shade 6)
const polPurple: MantineColorsTuple = [
  '#F1E7FE',
  '#DFCCFB',
  '#C09BF8',
  '#A167F4',
  '#873BF0',
  '#7414EA',
  '#6700E5',
  '#5700C2',
  '#48009F',
  '#39007C',
]

// Polygon light-theme grayscale (Stroke at 3, Grey 200 at 7, Primary at 9)
const polGray: MantineColorsTuple = [
  '#F8F8FA',
  '#F2F1F5',
  '#E7E6E8',
  '#E1E1E5',
  '#D7D6D9',
  '#BAB9BB',
  '#A2A3A5',
  '#888A91',
  '#2D2B36',
  '#07060D',
]

const theme = createTheme({
  colors: {
    polPurple,
    gray: polGray,
  },
  primaryColor: 'polPurple',
  primaryShade: 6,
  white: '#FFFFFF',
  black: '#07060D',
  autoContrast: true,
  defaultRadius: 'md',
  cursorType: 'pointer',
  fontFamily: "'PolySans Neutral', sans-serif",
  fontFamilyMonospace: "'PolySans Neutral Mono', monospace",
  headings: {
    fontFamily: "'PolySans Slim Wide', sans-serif",
    fontWeight: '300',
    sizes: {
      h1: { fontSize: '56px', lineHeight: '0.9' },
      h2: { fontSize: '36px', lineHeight: '1.1' },
      h3: { fontSize: '28px', lineHeight: '1.25' },
      h4: { fontSize: '24px', lineHeight: '1.25' },
      h5: { fontSize: '18px', lineHeight: '1.25' },
      h6: { fontSize: '16px', lineHeight: '1.25' },
    },
  },
  components: {
    Table: {
      defaultProps: {
        verticalSpacing: 'sm',
        horizontalSpacing: 'md',
        highlightOnHover: true,
      },
    },
    Modal: {
      defaultProps: {
        radius: 'lg',
        padding: 'lg',
      },
    },
    Tooltip: {
      defaultProps: {
        radius: 'md',
      },
    },
    Badge: {
      defaultProps: {
        radius: 'sm',
      },
      styles: {
        label: { textTransform: 'uppercase', letterSpacing: '0.03em' },
      },
    },
  },
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
    walletConnectProjectId: "01ac9198aeee06290cf188dc038f24e3",

    // Required App Info
    appName: "Polygon Enchanter",

    // Optional App Info
    appDescription: "Polygon Enchanter",
    appUrl: "https://family.co", // your app's url
    appIcon: "https://family.co/logo.png", // your app's icon, no bigger than 1024x1024px (max. 1MB)
  }),
)

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} forceColorScheme="light">
      <Router>
        <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <ConnectKitProvider
            mode="light"
            customTheme={{
              '--ck-font-family': "'PolySans Neutral', sans-serif",
              '--ck-accent-color': '#6700E5',
              '--ck-accent-text-color': '#FFFFFF',
              '--ck-primary-button-background': '#6700E5',
              '--ck-primary-button-color': '#FFFFFF',
              '--ck-primary-button-hover-background': '#5700C2',
              '--ck-connectbutton-background': '#FFFFFF',
              '--ck-connectbutton-color': '#07060D',
              '--ck-connectbutton-box-shadow': 'inset 0 0 0 1px #E1E1E5',
              '--ck-connectbutton-hover-background': '#F8F8FA',
              '--ck-connectbutton-active-background': '#F2F1F5',
            }}
          >
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
