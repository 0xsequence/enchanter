import { test, expect } from './fixtures/wallet'

test('connects the isolated E2E signer without a browser extension', async ({ page, wallet }) => {
  await page.goto('/')
  await wallet.connect()
  await expect(page.getByRole('button', { name: /^0x[0-9a-f]{4}/i })).toBeVisible()
})
