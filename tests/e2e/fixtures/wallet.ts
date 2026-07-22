import { test as base, expect, type Page } from '@playwright/test'
import {
  createPublicClient,
  createWalletClient,
  http,
  type EIP1193RequestFn,
  type Hex,
} from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { polygonAmoy } from 'viem/chains'

const AMOY_RPC_URL = 'https://nodes.sequence.app/amoy/AQAAAAAAAKh_3GIcApt38mpVrGYKG8tOpXk'

type WalletFixture = {
  address: `0x${string}`
  chainId: number
  funded: boolean
  connect: () => Promise<void>
  balanceOf: (address: `0x${string}`) => Promise<bigint>
  codeAt: (address: `0x${string}`) => Promise<Hex | undefined>
  fund: (address: `0x${string}`, value: bigint) => Promise<Hex>
  waitForTransaction: (hash: Hex) => Promise<void>
}

type WalletRequest = {
  method: string
  params?: unknown[]
  chainId: number
}

function asHex(value: unknown): Hex {
  if (typeof value !== 'string' || !value.startsWith('0x')) {
    throw new Error(`Expected a hex value, received ${String(value)}`)
  }
  return value as Hex
}

async function installWalletProvider(
  page: Page,
  privateKey: Hex,
): Promise<WalletFixture> {
  const account = privateKeyToAccount(privateKey)
  const publicClient = createPublicClient({
    chain: polygonAmoy,
    transport: http(AMOY_RPC_URL),
  })
  const walletClient = createWalletClient({
    account,
    chain: polygonAmoy,
    transport: http(AMOY_RPC_URL),
  })

  await page.exposeBinding('__enchanterWalletRpc', async (_source, input: WalletRequest) => {
    const { method, params = [], chainId } = input
    if (chainId !== polygonAmoy.id) {
      throw new Error(`E2E wallet only supports Polygon Amoy (${polygonAmoy.id}), received ${chainId}`)
    }

    switch (method) {
      case 'personal_sign':
      case 'eth_sign': {
        const message = method === 'personal_sign' ? params[0] : params[1]
        return account.signMessage({ message: { raw: asHex(message) } })
      }
      case 'eth_signTypedData_v4': {
        const typedData = JSON.parse(String(params[1]))
        return account.signTypedData(typedData)
      }
      case 'eth_sendTransaction': {
        const transaction = params[0] as Record<string, unknown>
        return walletClient.sendTransaction({
          account,
          chain: polygonAmoy,
          to: asHex(transaction.to),
          data: transaction.data ? asHex(transaction.data) : undefined,
          value: transaction.value ? BigInt(String(transaction.value)) : undefined,
          gas: transaction.gas ? BigInt(String(transaction.gas)) : undefined,
          gasPrice: transaction.gasPrice ? BigInt(String(transaction.gasPrice)) : undefined,
          maxFeePerGas: transaction.maxFeePerGas ? BigInt(String(transaction.maxFeePerGas)) : undefined,
          maxPriorityFeePerGas: transaction.maxPriorityFeePerGas
            ? BigInt(String(transaction.maxPriorityFeePerGas))
            : undefined,
        })
      }
      default:
        return publicClient.request({
          method: method as EIP1193RequestFn["args"]["method"],
          params: params as never,
        })
    }
  })

  await page.addInitScript(
    ({ address, initialChainId }) => {
      type Listener = (...args: unknown[]) => void
      const listeners = new Map<string, Set<Listener>>()
      let chainId = initialChainId

      const emit = (event: string, ...args: unknown[]) => {
        for (const listener of listeners.get(event) || []) listener(...args)
      }

      const provider = {
        isMetaMask: true,
        providers: undefined,
        _metamask: { isUnlocked: async () => true },
        request: async ({ method, params = [] }: { method: string; params?: unknown[] }) => {
          switch (method) {
            case 'eth_accounts':
            case 'eth_requestAccounts':
              return [address]
            case 'eth_chainId':
              return `0x${chainId.toString(16)}`
            case 'net_version':
              return chainId.toString()
            case 'wallet_requestPermissions':
              return [{ parentCapability: 'eth_accounts' }]
            case 'wallet_getPermissions':
              return [{ parentCapability: 'eth_accounts' }]
            case 'wallet_switchEthereumChain': {
              const next = Number.parseInt(String((params[0] as { chainId: string }).chainId), 16)
              chainId = next
              emit('chainChanged', `0x${chainId.toString(16)}`)
              return null
            }
            case 'wallet_addEthereumChain':
              return null
            default:
              return (globalThis as typeof globalThis & {
                __enchanterWalletRpc: (request: WalletRequest) => Promise<unknown>
              }).__enchanterWalletRpc({ method, params, chainId })
          }
        },
        on: (event: string, listener: Listener) => {
          const eventListeners = listeners.get(event) || new Set<Listener>()
          eventListeners.add(listener)
          listeners.set(event, eventListeners)
          return provider
        },
        removeListener: (event: string, listener: Listener) => {
          listeners.get(event)?.delete(listener)
          return provider
        },
      }

      Object.defineProperty(globalThis, 'ethereum', {
        configurable: true,
        value: provider,
      })

      const detail = {
        info: {
          uuid: '350670db-19fa-4704-a166-e52e178b59d2',
          name: 'Enchanter E2E Wallet',
          icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
          rdns: 'app.sequence.enchanter.e2e',
        },
        provider,
      }
      const announce = () => dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail }))
      addEventListener('eip6963:requestProvider', announce)
      announce()
    },
    { address: account.address, initialChainId: polygonAmoy.id },
  )

  return {
    address: account.address,
    chainId: polygonAmoy.id,
    funded: Boolean(process.env.E2E_PRIVATE_KEY),
    balanceOf: (address) => publicClient.getBalance({ address }),
    codeAt: (address) => publicClient.getCode({ address }),
    fund: async (address, value) => {
      if (!process.env.E2E_PRIVATE_KEY) {
        throw new Error('Funding requires E2E_PRIVATE_KEY')
      }
      const hash = await walletClient.sendTransaction({
        account,
        chain: polygonAmoy,
        to: address,
        value,
      })
      await publicClient.waitForTransactionReceipt({ hash })
      return hash
    },
    waitForTransaction: async (hash) => {
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') {
        throw new Error(`Transaction ${hash} reverted`)
      }
    },
    connect: async () => {
      const connectedButton = page.getByRole('button', { name: /^0x[0-9a-f]{4}/i })
      if (await connectedButton.isVisible().catch(() => false)) return

      await page.getByRole('button', { name: /connect wallet/i }).click()
      const walletOption = page.getByText('Enchanter E2E Wallet', { exact: true })
      if (await walletOption.isVisible().catch(() => false)) {
        await walletOption.click()
      } else {
        await page.getByText('MetaMask', { exact: true }).click()
      }
      await expect(connectedButton).toBeVisible()
    },
  }
}

export const test = base.extend<{ wallet: WalletFixture }>({
  wallet: async ({ page }, use) => {
    const privateKey = (process.env.E2E_PRIVATE_KEY as Hex | undefined) || generatePrivateKey()
    await use(await installWalletProvider(page, privateKey))
  },
})

export { expect }
