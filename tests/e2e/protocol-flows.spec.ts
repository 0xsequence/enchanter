import { test, expect } from './fixtures/wallet'
import {
  clearPortableData,
  createMessage,
  createRawTransaction,
  createUpdate,
  createWallet,
  expectNotification,
  exportPayload,
  importPayload,
  signAndPublishUpdate,
  signMessage,
  signTransaction,
} from './helpers/app'

test.describe.configure({ mode: 'serial', timeout: 180_000 })

function combinePayloads(payloads: string[]) {
  const result: {
    transactions: unknown[]
    messages: unknown[]
    updates: unknown[]
    signatures: Record<string, string[]>
  } = { transactions: [], messages: [], updates: [], signatures: {} }

  for (const payload of payloads.map((item) => JSON.parse(item))) {
    result.transactions.push(...(payload.transactions || []))
    result.messages.push(...(payload.messages || []))
    result.updates.push(...(payload.updates || []))
    Object.assign(result.signatures, payload.signatures || {})
  }
  return JSON.stringify(result)
}

for (const version of [2, 3] as const) {
  test(`Sequence v${version} supports the complete portable wallet workflow`, async ({
    page,
    wallet,
  }) => {
    await page.goto('/')
    await wallet.connect()

    const created = await createWallet(page, wallet.address, version, {
      name: `Protocol v${version}`,
    })

    await expect(page.getByText(created.name, { exact: true })).toBeVisible()
    await expect(page.getByText(created.address, { exact: true })).toBeVisible()
    await expect(page.getByText('Threshold', { exact: true }).locator('..')).toContainText('1')
    await expect(page.getByText('Signers', { exact: true }).first().locator('..')).toContainText('1')
    await expect(page.getByRole('link', { name: 'Open on Delphiview' })).toBeVisible()

    await page.goto('/#/')
    const walletRow = page.getByRole('row').filter({ hasText: created.address })
    await expect(walletRow).toContainText(created.name)
    await walletRow.getByRole('button', { name: 'Open' }).click()
    await expect(page).toHaveURL(new RegExp(`${created.address}$`, 'i'))

    await page.goto('/#/import-wallet')
    await page.getByLabel('Name (local only)').fill('Duplicate')
    await page.getByLabel('Wallet address').fill(created.address)
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await expectNotification(page, 'Wallet already exists')

    const messageText = `Sequence v${version} portable message ${Date.now()}`
    const messageSubdigest = await createMessage(page, created.address, messageText)
    await expect(page.getByText(messageText, { exact: true })).toBeVisible()
    await signMessage(page)
    await expect(page.getByRole('link', { name: 'ERC-6492' })).toBeVisible()
    const messageExport = await exportPayload(page)
    const messageJson = JSON.parse(messageExport)
    expect(messageJson.messages[0].version).toBe(version)
    expect(messageJson.signatures[messageSubdigest]).toHaveLength(1)

    const transactionSubdigest = await createRawTransaction(
      page,
      created.address,
      wallet.address,
      { data: '0x', value: 0n },
    )
    await expect(page.getByText('80002 (amoy)', { exact: true })).toBeVisible()
    await expect(page.getByText(created.address, { exact: true }).first()).toBeVisible()
    await signTransaction(page)
    const transactionExport = await exportPayload(page)
    const transactionJson = JSON.parse(transactionExport)
    expect(transactionJson.transactions[0].version).toBe(version)
    expect(transactionJson.signatures[transactionSubdigest]).toHaveLength(1)

    await page.goto(`/#/new-transaction/${created.address}`)
    await page.getByLabel('Network').selectOption({ label: 'All networks' })
    await expect(page.getByText(/Commit pending wallet updates \(0\)/)).toBeVisible({
      timeout: 30_000,
    })
    await page.getByLabel('To').fill(wallet.address)
    await page.getByLabel('Value (wei)').fill('0')
    await page.getByLabel('Data').fill('0x')
    await page.getByRole('button', { name: 'Submit', exact: true }).click()
    await expectNotification(page, 'Transaction created')
    await expect(page.getByText('0 (All networks)', { exact: true })).toBeVisible()

    const updateSubdigest = await createUpdate(page, created.address, { weight: 2 })
    await expect(page.getByText('Pending', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'New Configuration' })).toBeVisible()
    await signAndPublishUpdate(page)
    const updateExport = await exportPayload(page)
    const updateJson = JSON.parse(updateExport)
    expect(updateJson.updates[0].version).toBe(version)
    expect(updateJson.signatures[updateSubdigest]).toHaveLength(1)

    await page.goto(`/#/transactions/${created.address}`)
    await expect(page.getByRole('row').filter({ hasText: transactionSubdigest })).toBeVisible()
    await page.goto(`/#/messages/${created.address}`)
    await expect(page.getByRole('row').filter({ hasText: messageText })).toBeVisible()
    await page.goto(`/#/updates/${created.address}`)
    await expect(page.getByRole('heading', { name: /Pending Updates|Past Updates/, level: 5 })).toBeVisible({
      timeout: 30_000,
    })

    const portablePayload = combinePayloads([
      transactionExport,
      messageExport,
      updateExport,
    ])
    await clearPortableData(page)
    await page.reload()
    await importPayload(page, portablePayload)
    await expectNotification(page, 'Transactions imported')
    await expectNotification(page, 'Messages imported')
    await expectNotification(page, 'Updates imported')
    await expectNotification(page, 'Signatures imported')

    await page.goto(`/#/transaction/${transactionSubdigest}`)
    await expect(page.getByRole('heading', { name: 'Transaction Detail' })).toBeVisible()
    await expect(page.getByLabel('Active wallet')).toHaveValue(created.address)
    await expect(page.getByText('200%', { exact: true })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('cell', { name: 'Signed' })).toBeVisible()
    await page.goto(`/#/message/${messageSubdigest}`)
    await expect(page.getByRole('heading', { name: 'Message Detail' })).toBeVisible()
    await expect(page.getByText('true', { exact: true })).toBeVisible({ timeout: 45_000 })
    await page.goto(`/#/do-update/${updateSubdigest}`)
    await expect(page.getByRole('heading', { name: 'Update Detail' })).toBeVisible()
    await expect(page.getByText('200%', { exact: true })).toBeVisible({ timeout: 30_000 })
  })
}

test('rejects nested Sequence wallet signers', async ({ page, wallet }) => {
  await page.goto('/')
  await wallet.connect()
  const signerWallet = await createWallet(page, wallet.address, 3, { name: 'Nested signer' })

  await page.goto('/#/create-wallet')
  await page.getByLabel('Name (local only)').fill('Invalid nested wallet')
  await page.getByLabel('Threshold').fill('1')
  await page.getByLabel('Salt').fill(String(signerWallet.salt + 1))
  await page.getByLabel('Address').fill(signerWallet.address)
  await page.getByLabel('Weight').fill('1')
  await page.getByRole('button', { name: 'Create', exact: true }).click()

  const notification = await expectNotification(page, 'Failed to create wallet', false)
  await expect(notification).toContainText(/nesting is not implemented yet/i)
})
