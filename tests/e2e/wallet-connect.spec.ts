import { test, expect } from './fixtures/wallet'
import { createRawTransaction, createWallet, signTransaction } from './helpers/app'

test('connects the isolated E2E signer without a browser extension', async ({ page, wallet }) => {
  await page.goto('/')
  await wallet.connect()
  await expect(page.getByRole('button', { name: /^0x[0-9a-f]{4}/i })).toBeVisible()
})

test('switches the wallet to the transaction network before signing', async ({ page, wallet }) => {
  test.setTimeout(120_000)
  const created = await createWallet(page, wallet.address, 3)
  await createRawTransaction(page, created.address, '0x2222222222222222222222222222222222222222')
  await wallet.connect()

  // Park the signer on another chain; signing must hop back to Amoy first
  // (the fixture wallet rejects signature requests on any other chain)
  await page.evaluate(() =>
    (window as unknown as {
      ethereum: { request: (args: unknown) => Promise<unknown> }
    }).ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x1' }],
    })
  )

  await signTransaction(page)
})
