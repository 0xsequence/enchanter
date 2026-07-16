import { test, expect } from './fixtures/wallet'
import { selectAmoy } from './helpers/app'

const VALID_ADDRESS = '0x0000000000000000000000000000000000000001'

test.describe('create-wallet validation and editing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/create-wallet')
  })

  test('requires a name, threshold, signer address, and valid weight', async ({ page }) => {
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByText('Name is required')).toBeVisible()
    await expect(page.getByText('Threshold should be greater than 0')).toBeVisible()
    await expect(page.getByText('Address is required')).toBeVisible()
  })

  test('enforces the name and address rules and clamps numeric bounds', async ({ page }) => {
    await page.getByLabel('Name (local only)').fill('x'.repeat(1025))
    await page.getByLabel('Threshold').fill('65536')
    await page.getByLabel('Salt').fill('2147483648')
    await page.getByLabel('Address').fill('not-an-address')
    await page.getByLabel('Weight').fill('256')
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    await expect(page.getByText('Name should be less than 1024 characters')).toBeVisible()
    await expect(page.getByText('Invalid address')).toBeVisible()
    await expect(page.getByLabel('Threshold')).toHaveValue('65535')
    await expect(page.getByLabel('Salt')).toHaveValue('2147483647')
    await expect(page.getByLabel('Weight')).toHaveValue('255')
  })

  test('rejects signer weights whose sum is below the threshold', async ({ page }) => {
    await page.getByLabel('Name (local only)').fill('Underweight wallet')
    await page.getByLabel('Threshold').fill('2')
    await page.getByLabel('Address').fill(VALID_ADDRESS)
    await page.getByLabel('Weight').fill('1')
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    await expect(page.getByText('Invalid configuration', { exact: true })).toBeVisible()
    await expect(page.getByText(/Sum of signers weights/)).toBeVisible()
  })

  test('adds and removes multiple signer rows', async ({ page }) => {
    await expect(page.getByLabel('Address')).toHaveCount(1)
    await page.getByRole('button', { name: 'Add signer' }).click()
    await expect(page.getByLabel('Address')).toHaveCount(2)
    await page.locator('.mantine-ActionIcon-root').last().click()
    await expect(page.getByLabel('Address')).toHaveCount(1)
  })

  test('defaults to v3 while retaining the v2 choice', async ({ page }) => {
    const protocol = page.getByLabel('Sequence protocol')
    await expect(protocol).toHaveValue('3')
    await expect(protocol.locator('option')).toHaveText(['Sequence v3', 'Sequence v2'])
    await protocol.selectOption('2')
    await expect(protocol).toHaveValue('2')
  })
})

test.describe('import validation and import payload errors', () => {
  test('requires a local name and a valid wallet address', async ({ page }) => {
    await page.goto('/#/import-wallet')
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await expect(page.getByText('Name is required')).toBeVisible()
    await expect(page.getByText('Wallet is required')).toBeVisible()

    await page.getByLabel('Wallet address').fill('wrong')
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await expect(page.getByText('Invalid wallet address')).toBeVisible()
  })

  test('reports invalid JSON, invalid payloads, and empty valid payloads', async ({ page }) => {
    await page.goto('/')

    for (const [payload, expected] of [
      ['not json', 'Import failed'],
      [JSON.stringify({ transactions: 'wrong' }), 'Import failed'],
      [JSON.stringify({}), 'No data imported'],
    ]) {
      await page.getByText('Import Data', { exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Import data' })
      await dialog.getByRole('textbox').fill(payload)
      await dialog.getByRole('button', { name: 'Import', exact: true }).click()
      await expect(page.getByText(expected, { exact: true }).last()).toBeVisible()
      if (await dialog.isVisible()) await page.keyboard.press('Escape')
    }
  })

  test('loads import JSON from a file', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Import Data', { exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Import data' })
    await dialog.locator('input[type=file]').setInputFiles({
      name: 'empty.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{}'),
    })
    await expect(dialog.getByRole('textbox')).toHaveValue('{}')
  })
})

test.describe('transaction composer validation and editing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/#/new-transaction/${VALID_ADDRESS}`)
  })

  test('validates network, destination, value, and calldata', async ({ page }) => {
    await page.getByRole('button', { name: 'Submit', exact: true }).click()
    await expect(page.getByText('Network is required')).toBeVisible()
    await expect(page.getByText('To is required')).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`${VALID_ADDRESS}$`))

    await selectAmoy(page)
    await page.getByLabel('To').fill('wrong')
    await page.getByLabel('Value (wei)').fill('not-a-number')
    await page.getByLabel('Data').fill('not-hex')
    await page.getByRole('button', { name: 'Submit', exact: true }).click()
    await expect(page.getByText('Invalid address')).toBeVisible()
    await expect(page.getByText('Value should be a number')).toBeVisible()
    await expect(page.getByText('Data should be a hex string')).toBeVisible()
  })

  test('adds and removes raw transaction rows', async ({ page }) => {
    await expect(page.getByLabel('To')).toHaveCount(1)
    await page.getByRole('button', { name: 'Add transaction' }).click()
    await expect(page.getByLabel('To')).toHaveCount(2)
    await page.locator('.mantine-ActionIcon-root').last().click()
    await expect(page.getByLabel('To')).toHaveCount(1)
  })

  test('encodes ABI arguments and surfaces malformed selectors', async ({ page }) => {
    await page.getByText('Use ABI Encoder', { exact: true }).click()
    const selector = page.getByLabel('Function selector')
    await selector.fill('transfer(address to,uint256 amount)')
    await expect(page.getByLabel('address (to)')).toBeVisible()
    await expect(page.getByLabel('uint256 (amount)')).toBeVisible()
    await page.getByLabel('address (to)').fill(VALID_ADDRESS)
    await page.getByLabel('uint256 (amount)').fill('1')
    await expect(page.getByLabel('Data')).toHaveValue(/^0x[0-9a-f]+$/i)

    await selector.fill('this is not ABI')
    await expect(selector).toHaveAttribute('aria-invalid', 'true', { timeout: 10_000 })
  })

  test('switches to the NFT recipient editor and manages recipients', async ({ page }) => {
    await selectAmoy(page)
    await page.getByRole('radio', { name: 'Send NFTs' }).check()
    await expect(page.getByLabel('Recipient 1 Address')).toBeVisible()
    await page.getByRole('button', { name: 'Add recipient' }).click()
    await expect(page.getByLabel('Recipient 2 Address')).toBeVisible()
    await page.getByRole('button', { name: 'Remove Recipient 2' }).click()
    await expect(page.getByLabel('Recipient 2 Address')).toBeHidden()
  })
})
