import { test, expect } from './fixtures/wallet'

const VALID_ADDRESS = '0x0000000000000000000000000000000000000001'

test.describe('application shell and navigation', () => {
  test('shows the empty home state, global actions, and disabled wallet actions', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: '🧙🏻 Sequence Enchanter' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'My wallets' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Connect Wallet/i })).toBeVisible()

    for (const label of [
      'Wallet',
      'New Transaction',
      'Transactions',
      'Update Signers',
      'Pending Updates',
      'Sign Message',
      'Messages',
    ]) {
      await expect(page.locator('a').filter({ hasText: new RegExp(`^${label}$`) })).toHaveAttribute(
        'data-disabled',
        'true',
      )
    }
  })

  test('navigates between top-level wallet management screens', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Create Wallet', { exact: true }).click()
    await expect(page).toHaveURL(/#\/?create-wallet$/)
    await expect(page.getByRole('heading', { name: 'Create wallet' })).toBeVisible()

    await page.getByText('Import Wallet', { exact: true }).click()
    await expect(page).toHaveURL(/#\/?import-wallet$/)
    await expect(page.getByRole('heading', { name: 'Import wallet' })).toBeVisible()

    await page.getByText('Home', { exact: true }).click()
    await expect(page).toHaveURL(/\/#\/?$/)
  })

  test('opens and closes the data import modal', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Import Data', { exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Import data' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Import', exact: true })).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('supports the mobile navigation drawer', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    const burger = page.locator('button.mantine-Burger-root')
    await expect(burger).toBeVisible()
    await burger.click()
    await expect(page.getByText('Create Wallet', { exact: true })).toBeVisible()
  })
})

test.describe('invalid and missing records', () => {
  for (const [path, heading, message] of [
    [`/#/wallet/not-an-address`, 'Wallet view', 'Invalid address'],
    [`/#/new-transaction/not-an-address`, 'Send Transaction', 'Invalid address'],
    [`/#/transactions/not-an-address`, 'Transactions', 'Invalid wallet address'],
    [`/#/update/not-an-address`, 'Update Signers', 'Invalid address'],
    [`/#/updates/not-an-address`, 'Pending Updates', 'Invalid wallet address'],
    [`/#/sign-message/not-an-address`, 'Sign Message', 'Invalid address'],
    [`/#/messages/not-an-address`, 'Messages', 'Invalid wallet address'],
  ] as const) {
    test(`${path} reports an invalid address`, async ({ page }) => {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: heading })).toBeVisible()
      await expect(page.locator('main')).toContainText(message)
    })
  }

  test('reports missing transaction, message, and update records', async ({ page }) => {
    const digest = `0x${'11'.repeat(32)}`

    await page.goto(`/#/transaction/${digest}`)
    await expect(page.getByText('Transaction not found.')).toBeVisible()

    await page.goto(`/#/message/${digest}`)
    await expect(page.getByText('Message not found')).toBeVisible()

    await page.goto(`/#/do-update/${digest}`)
    await expect(page.getByText(new RegExp(`Update ${digest} not found`))).toBeVisible({
      timeout: 30_000,
    })
  })

  test('empty lists are safe for a syntactically valid wallet address', async ({ page }) => {
    await page.goto(`/#/transactions/${VALID_ADDRESS}`)
    await expect(page.getByRole('heading', { name: 'Transactions', level: 3 })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Subdigest' })).toBeVisible()

    await page.goto(`/#/messages/${VALID_ADDRESS}`)
    await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Content' })).toBeVisible()
  })
})
