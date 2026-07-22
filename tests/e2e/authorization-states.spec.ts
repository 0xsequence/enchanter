import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { test, expect } from './fixtures/wallet'
import {
  createMessage,
  createRawTransaction,
  createUpdate,
  createWallet,
  expectNotification,
  uniqueSalt,
} from './helpers/app'

test.describe.configure({ mode: 'serial', timeout: 180_000 })

test('keeps partially signed 2-of-2 transactions, messages, and updates non-executable', async ({
  page,
  wallet,
}) => {
  const secondSigner = privateKeyToAccount(generatePrivateKey()).address

  await page.goto('/#/create-wallet')
  await page.getByLabel('Name (local only)').fill('2-of-2 authorization')
  await page.getByLabel('Threshold').fill('2')
  await page.getByLabel('Sequence protocol').selectOption('3')
  await page.getByLabel('Salt').fill(String(uniqueSalt()))
  await page.getByLabel('Address').fill(wallet.address)
  await page.getByLabel('Weight').fill('1')
  await page.getByRole('button', { name: 'Add signer' }).click()
  await page.getByLabel('Address').nth(1).fill(secondSigner)
  await page.getByLabel('Weight').nth(1).fill('1')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page).toHaveURL(/#\/wallet\/0x[0-9a-f]{40}$/i, { timeout: 45_000 })
  await expectNotification(page, 'Wallet created')
  const walletAddress = page.url().split('/').at(-1) as `0x${string}`

  await createRawTransaction(page, walletAddress, wallet.address)
  await page.getByRole('button', { name: 'Sign transaction' }).click()
  await expectNotification(page, 'Transaction signed')
  await expect(page.getByText('50%', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign transaction' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Execute transaction' })).toBeDisabled()

  await createMessage(page, walletAddress, 'A partially signed message')
  await page.getByRole('button', { name: 'Sign message' }).click()
  await expectNotification(page, 'Message signed')
  await expect(page.getByText('50%', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign message' })).toBeDisabled()
  await expect(page.getByText('Is Valid', { exact: true })).toBeHidden()

  await createUpdate(page, walletAddress, { threshold: 2, weight: 2 })
  await page.getByRole('button', { name: 'Sign change' }).click()
  await expectNotification(page, 'Update signed')
  await expect(page.getByText('50%', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign change' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Execute change' })).toBeDisabled()
})

test('prevents a connected non-signer from signing v2 transactions and messages', async ({
  page,
  wallet,
}) => {
  const actualSigner = privateKeyToAccount(generatePrivateKey()).address
  const created = await createWallet(page, actualSigner, 2, { name: 'Non-signer state' })

  await createRawTransaction(page, created.address, wallet.address)
  await expect(page.getByRole('button', { name: 'Sign transaction' })).toBeDisabled({
    timeout: 30_000,
  })
  await expect(page.getByRole('button', { name: 'Execute transaction' })).toBeDisabled()

  await createMessage(page, created.address, 'A message for another signer')
  await expect(page.getByRole('button', { name: 'Sign message' })).toBeDisabled({
    timeout: 30_000,
  })
})

test('requires the execution wallet to be on the transaction network', async ({ page, wallet }) => {
  const created = await createWallet(page, wallet.address, 3, { name: 'Network guard' })
  await createRawTransaction(page, created.address, wallet.address)
  await page.getByRole('button', { name: 'Sign transaction' }).click()
  await expectNotification(page, 'Transaction signed')
  await expect(page.getByRole('button', { name: 'Execute transaction' })).toBeEnabled()

  await page.evaluate(async () => {
    await (globalThis as typeof globalThis & {
      ethereum: { request: (request: unknown) => Promise<unknown> }
    }).ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x1' }],
    })
  })
  await expect(page.getByRole('button', { name: 'Execute transaction' })).toBeDisabled()
})
