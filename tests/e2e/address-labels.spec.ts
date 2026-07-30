import { test, expect } from './fixtures/wallet'
import { clearAddressLabels, clearWallets, createWallet } from './helpers/app'

test.describe('local address labels', () => {
  test('persists, edits, and removes a signer label without replacing its address', async ({ page, wallet }) => {
    await page.goto('/')
    await clearWallets(page)
    await clearAddressLabels(page)

    await createWallet(page, wallet.address, 3)

    const signerRow = page.getByRole('row').filter({ hasText: wallet.address })
    const fallback = (await signerRow.getByRole('cell').first().textContent())?.trim()
    expect(fallback).toBeTruthy()
    await expect(signerRow.getByText(wallet.address, { exact: true })).toBeVisible()

    await signerRow.getByRole('button', { name: `Add label for ${wallet.address}` }).click()
    const labelInput = signerRow.getByLabel(`Label for ${wallet.address}`)
    await expect(labelInput).toBeFocused()
    await labelInput.fill('  Primary signer  ')
    await signerRow.getByRole('button', { name: 'Save label' }).click()
    await expect(signerRow.getByText('Primary signer', { exact: true })).toBeVisible()
    await expect(signerRow.getByText(wallet.address, { exact: true })).toBeVisible()

    await expect.poll(async () => page.evaluate(async (address) => {
      const request = indexedDB.open('sequence-enchanter')
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const transaction = database.transaction(['addressLabels'], 'readonly')
      const stored = await new Promise<{ address: string; label: string } | undefined>((resolve, reject) => {
        const get = transaction.objectStore('addressLabels').get(address.toLowerCase())
        get.onsuccess = () => resolve(get.result)
        get.onerror = () => reject(get.error)
      })
      database.close()
      return stored
    }, wallet.address)).toEqual({ address: wallet.address.toLowerCase(), label: 'Primary signer' })

    await page.reload()
    await expect(signerRow.getByText('Primary signer', { exact: true })).toBeVisible()
    await expect(signerRow.getByText(wallet.address, { exact: true })).toBeVisible()

    await signerRow.getByRole('button', { name: `Edit label for ${wallet.address}` }).click()
    await expect(labelInput).toHaveValue('Primary signer')
    await labelInput.fill('Backup signer')
    await labelInput.press('Enter')
    await expect(signerRow.getByText('Backup signer', { exact: true })).toBeVisible()

    await signerRow.getByRole('button', { name: `Edit label for ${wallet.address}` }).click()
    await labelInput.fill('')
    await labelInput.press('Enter')
    await expect(signerRow.getByRole('button', { name: `Add label for ${wallet.address}` })).toBeVisible()
    await expect(signerRow.getByRole('cell').first()).toHaveText(fallback || '')
    await expect(signerRow.getByText(wallet.address, { exact: true })).toBeVisible()
  })
})
