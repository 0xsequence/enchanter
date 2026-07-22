import { test, expect } from './fixtures/wallet'
import {
  createMessage,
  createRawTransaction,
  createUpdate,
  createWallet,
  deployWallet,
  executeTransaction,
  signAndPublishUpdate,
  signMessage,
  signTransaction,
} from './helpers/app'

test.describe.configure({ mode: 'serial', timeout: 300_000 })

for (const version of [2, 3] as const) {
  test(`@funded deploys and executes a real Sequence v${version} wallet on Polygon Amoy`, async ({
    page,
    wallet,
  }) => {
    test.skip(!wallet.funded, 'Set E2E_PRIVATE_KEY to a funded Polygon Amoy test key')

    await page.goto('/')
    await wallet.connect()
    const created = await createWallet(page, wallet.address, version, {
      name: `Funded Amoy v${version}`,
    })

    const message = `Undeployed Sequence v${version} message ${Date.now()}`
    await createMessage(page, created.address, message)
    await signMessage(page)
    await expect(page.getByRole('link', { name: 'ERC-6492' })).toBeVisible()

    const deploymentHash = await deployWallet(page)
    await wallet.waitForTransaction(deploymentHash)
    await expect.poll(() => wallet.codeAt(created.address), { timeout: 60_000 }).not.toBe('0x')

    await page.reload()
    await expect(page.getByRole('link', { name: 'ERC-1271' })).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText('true', { exact: true })).toBeVisible({ timeout: 60_000 })

    const initialWalletFunds = 100_000n
    await wallet.fund(created.address, initialWalletFunds)
    await expect.poll(() => wallet.balanceOf(created.address), { timeout: 60_000 }).toBe(
      initialWalletFunds,
    )

    await createRawTransaction(page, created.address, wallet.address, { value: 1n })
    await signTransaction(page)
    const executionHash = await executeTransaction(page)
    await wallet.waitForTransaction(executionHash)
    await expect.poll(() => wallet.balanceOf(created.address), { timeout: 60_000 }).toBe(
      initialWalletFunds - 1n,
    )
    // The status must flip on its own: execution waits for the receipt and
    // records it without requiring a manual refresh
    await expect(page.getByText('Executed', { exact: true })).toBeVisible({ timeout: 60_000 })

    await createUpdate(page, created.address, { weight: 2 })
    await signAndPublishUpdate(page)

    await createRawTransaction(page, created.address, wallet.address, {
      commitUpdates: true,
      value: 1n,
    })
    await signTransaction(page)
    const updateExecutionHash = await executeTransaction(page)
    await wallet.waitForTransaction(updateExecutionHash)
    await expect.poll(() => wallet.balanceOf(created.address), { timeout: 60_000 }).toBe(
      initialWalletFunds - 2n,
    )

    await page.goto(`/#/updates/${created.address}`)
    await expect(page.getByRole('heading', { name: 'Past Updates', level: 5 })).toBeVisible({
      timeout: 60_000,
    })
    await page.goto(`/#/wallet/${created.address}`)
    await expect(page.getByText(`Sequence v${version}`, { exact: true })).toBeVisible()
    await expect(page.getByRole('row').filter({ hasText: wallet.address })).toContainText('2')
  })
}
