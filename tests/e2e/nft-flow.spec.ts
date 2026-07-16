import { test, expect } from './fixtures/wallet'
import { createWallet, expectNotification, selectAmoy } from './helpers/app'

const ERC721 = '0x0000000000000000000000000000000000000721'
const ERC1155 = '0x0000000000000000000000000000000000001155'
const RECIPIENT = '0x0000000000000000000000000000000000000001'

function tokenBalance(
  contractType: 'ERC721' | 'ERC1155',
  contractAddress: string,
  tokenID: string,
  balance: string,
) {
  return {
    contractType,
    contractAddress,
    accountAddress: RECIPIENT,
    tokenID,
    balance,
    blockHash: `0x${'00'.repeat(32)}`,
    blockNumber: 1,
    chainId: 80002,
    uniqueCollectibles: '1',
    isSummary: false,
    contractInfo: {
      name: contractType === 'ERC721' ? 'Test 721' : 'Test 1155',
    },
    tokenMetadata: {
      tokenId: tokenID,
      name: `${contractType} #${tokenID}`,
      image: `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>`,
    },
  }
}

test('builds a mixed ERC-721 and ERC-1155 transfer from indexer results', async ({
  page,
  wallet,
}) => {
  const erc721 = tokenBalance('ERC721', ERC721, '7', '1')
  const erc1155 = tokenBalance('ERC1155', ERC1155, '8', '5')

  await page.route('https://amoy-indexer.sequence.app/**', async (route) => {
    const request = route.request().postDataJSON() as {
      contractAddress?: string
      tokenID?: string
    }
    const balances = request.tokenID
      ? [request.contractAddress === ERC721 ? erc721 : erc1155]
      : [erc721, erc1155]
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ page: { more: false }, balances }),
    })
  })

  const created = await createWallet(page, wallet.address, 3, { name: 'NFT composer' })
  await page.goto(`/#/new-transaction/${created.address}`)
  await selectAmoy(page)
  await expect(page.getByText(/Commit pending wallet updates \(0\)/)).toBeVisible({
    timeout: 30_000,
  })
  await page.getByRole('radio', { name: 'Send NFTs' }).check()
  await page.getByLabel('Recipient 1 Address').fill(RECIPIENT)

  const tokenSelect = page.locator('select').filter({
    has: page.locator(`option[value="${ERC721}"]`),
  })
  await expect(tokenSelect).toBeVisible()

  await tokenSelect.selectOption(ERC721)
  await page.getByPlaceholder('Token Id').fill('7')
  await page.getByRole('button', { name: 'Search Recipient 1 NFTs' }).click()
  await expect(page.getByText('ERC721 #7')).toBeVisible()
  await page.getByRole('button', { name: 'Add', exact: true }).click()

  await tokenSelect.selectOption(ERC1155)
  await page.getByPlaceholder('Token Id').fill('8')
  await page.getByRole('button', { name: 'Search Recipient 1 NFTs' }).click()
  await expect(page.getByText('ERC1155 #8')).toBeVisible()
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByRole('textbox', { name: 'Amount' }).last().fill('3')

  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  await expectNotification(page, 'Transaction created')
  await expect(page.getByRole('row').filter({ hasText: ERC721 })).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: ERC1155 })).toBeVisible()
})
