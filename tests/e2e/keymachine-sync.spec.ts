import { test, expect } from './fixtures/wallet'
import { ethers } from 'ethers'
import {
  clearPortableData,
  clearWallets,
  createMessage,
  createRawTransaction,
  createUpdate,
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

test('restores an unsigned v2 update from its portable short link after all local data is wiped', async ({
  page,
  wallet,
}) => {
  const created = await createWallet(page, wallet.address, 2)
  const subdigest = await createUpdate(page, created.address)

  const imageHashCard = page.locator('.mini-card').filter({ hasText: 'ImageHash' })
  await expect(imageHashCard).toBeVisible({ timeout: 30_000 })
  const imageHash = await imageHashCard.locator('.mini-card-value').textContent()
  if (!imageHash || !/^0x[0-9a-f]{64}$/i.test(imageHash)) {
    throw new Error(`Could not read v2 update image hash: ${imageHash}`)
  }

  // The v2 mailbox is a fallback path, so it must still run if the primary
  // v3-only Payload lookup has an endpoint-specific failure.
  await page.route('**/rpc/KeyMachine/Payload', (route) => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Unavailable' }),
  }))

  // Simulate an incognito browser: no proposal, signatures, or locally saved
  // wallet survives. The short URL is the only retained piece of state.
  await clearPortableData(page)
  await clearWallets(page)
  await page.reload()

  await expect(page.getByText(created.address, { exact: true }).first()).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByText(imageHash, { exact: true }).first()).toBeVisible()
  await expect(page.getByText(subdigest, { exact: true }).first()).toBeVisible()
  await expect(page.getByText('New Configuration', { exact: true })).toBeVisible()
  await expect(
    page.locator('.mini-card').filter({ hasText: 'Version' }).getByText('2', { exact: true }),
  ).toBeVisible()

  // Recovery is metadata-only: no wallet approval or Sign change is needed.
  await expect(page.getByRole('button', { name: 'Sign change' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publish portable link' })).toHaveCount(0)
})

test('does not hydrate updates from malformed v2 mailbox metadata', async ({ page }) => {
  const subdigest = `0x${'33'.repeat(32)}`
  const forgedEnvelope = ethers.hexlify(ethers.toUtf8Bytes(JSON.stringify({
    t: 'enchanter-update-v2-v1',
    s: subdigest,
    wallet: '0x1111111111111111111111111111111111111111',
    imageHash: `0x${'44'.repeat(32)}`,
  })))

  await page.route('**/rpc/KeyMachine/Payload', (route) => route.fulfill({
    status: 404,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'NotFound' }),
  }))
  await page.route('**/rpc/KeyMachine/Wallets', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      wallets: {
        // This has the exact schema and canonical field encodings but the
        // wallet/image hash do not derive the requested subdigest.
        '0x0000000000000000000000000000000000000000': {
          payload: { type: 'message', message: forgedEnvelope },
        },
      },
      cursor: 0,
    }),
  }))

  await page.goto(`/#/do-update/${subdigest}`)
  await expect(page.getByText(`Update ${subdigest} not found.`)).toBeVisible({ timeout: 30_000 })

  const stored = await page.evaluate(async (key) => {
    const request = indexedDB.open('sequence-enchanter')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const transaction = database.transaction(['updates'], 'readonly')
    const result = await new Promise<unknown>((resolve, reject) => {
      const get = transaction.objectStore('updates').get(key)
      get.onsuccess = () => resolve(get.result)
      get.onerror = () => reject(get.error)
    })
    database.close()
    return result
  }, subdigest)
  expect(stored).toBeUndefined()
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
