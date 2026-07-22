import { test, expect } from './fixtures/wallet'
import {
  clearPortableData,
  clearWallets,
  createMessage,
  createRawTransaction,
  createWallet,
  expectNotification,
  signTransaction,
} from './helpers/app'

test.describe.configure({ mode: 'serial', timeout: 180_000 })

test('restores v3 records and signatures from the Key Machine after local data is wiped', async ({
  page,
  wallet,
}) => {
  const created = await createWallet(page, wallet.address, 3)
  const txSubdigest = await createRawTransaction(
    page,
    created.address,
    '0x1111111111111111111111111111111111111111',
    { value: 1n, data: '0xcafe' },
  )

  // Sign on this "device"; the signature is posted to the Key Machine mailbox
  await wallet.connect()
  await signTransaction(page)

  const messageRaw = `keymachine sync ${created.salt}`
  const messageSubdigest = await createMessage(page, created.address, messageRaw)

  // Simulate a second device that knows the wallet but has none of the records
  await clearPortableData(page)
  await page.reload()

  await page.goto(`/#/transaction/${txSubdigest}`)
  await expect(page.getByText(created.address, { exact: true }).first()).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByText(txSubdigest, { exact: true }).first()).toBeVisible()
  await expect(page.getByText('0xcafe', { exact: true }).first()).toBeVisible()
  await expect(page.getByLabel('Active wallet')).toHaveValue(created.address)

  // The signature returns through the mailbox without signing again
  await expect(page.getByRole('cell', { name: 'Signed' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('100%', { exact: true })).toBeVisible()

  await page.goto(`/#/message/${messageSubdigest}`)
  await expect(page.getByText(messageRaw, { exact: true }).first()).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByText(messageSubdigest, { exact: true }).first()).toBeVisible()
  await expect(page.getByLabel('Active wallet')).toHaveValue(created.address)

  // The restored transaction is registered locally again
  await page.goto(`/#/transactions/${created.address}`)
  await expect(page.getByRole('cell', { name: txSubdigest })).toBeVisible()
})

test('publishes a witness and auto-detects the wallet on connect', async ({ page, wallet }) => {
  const created = await createWallet(page, wallet.address, 3)
  await wallet.connect()

  // createWallet leaves us on the wallet view
  const witnessButton = page.getByRole('button', { name: 'Sign witness' })
  await expect(witnessButton).toBeEnabled({ timeout: 30_000 })
  await witnessButton.click()
  await expectNotification(page, 'Witness published')
  await expect(page.getByRole('button', { name: 'Witness published' })).toBeDisabled()

  // Forget the wallet locally, then rediscover it through the witness
  await clearWallets(page)
  await page.goto('/#/')
  await page.reload()

  // wagmi reconnects the injected wallet automatically after the reload
  await expect(page.getByText('Detected wallets', { exact: true })).toBeVisible({
    timeout: 30_000,
  })
  const detectedRow = page.locator('tr').filter({ hasText: created.address })
  await expect(detectedRow).toBeVisible({ timeout: 30_000 })
  await detectedRow.getByRole('button', { name: 'Add', exact: true }).click()

  // The wallet is back in the local list under a generated name
  const shortName = `Detected ${created.address.slice(0, 6)}…${created.address.slice(-4)}`
  await expect(page.getByRole('cell', { name: shortName })).toBeVisible()
})

test('reports transactions that are unknown to the Key Machine', async ({ page }) => {
  const digest = `0x${'22'.repeat(32)}`
  await page.goto(`/#/transaction/${digest}`)
  await expect(page.getByText('Transaction not found.')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Check again' })).toBeVisible()
})
