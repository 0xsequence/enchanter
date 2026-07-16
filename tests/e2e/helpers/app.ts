import { expect, type Page } from '@playwright/test'

export type WalletVersion = 2 | 3

let saltCounter = 0

export function uniqueSalt(): number {
  saltCounter += 1
  return (Math.floor(Date.now() / 1000) + saltCounter * 997) % 2_147_483_647
}

export async function expectNotification(page: Page, title: string, dismiss = true) {
  const notification = page.getByText(title, { exact: true }).last()
  await expect(notification).toBeVisible({ timeout: 30_000 })
  const container = notification.locator('xpath=ancestor::*[@role="alert"][1]')
  if (dismiss) {
    const close = container.locator('button')
    if (await close.isVisible().catch(() => false)) {
      await close.evaluate((button: HTMLButtonElement) => button.click())
      await expect(container).toBeHidden()
    } else {
      await page.mouse.move(0, 0)
      await container.waitFor({ state: 'hidden', timeout: 10_000 })
    }
  }
  return container
}

export async function createWallet(
  page: Page,
  signer: string,
  version: WalletVersion,
  options: { name?: string; salt?: number; threshold?: number; weight?: number } = {},
) {
  const name = options.name || `E2E v${version} ${Date.now()}`
  const salt = options.salt ?? uniqueSalt()

  await page.goto('/#/create-wallet')
  await page.getByLabel('Name (local only)').fill(name)
  await page.getByLabel('Threshold').fill(String(options.threshold ?? 1))
  await page.getByLabel('Sequence protocol').selectOption(String(version))
  await page.getByLabel('Salt').fill(String(salt))
  await page.getByLabel('Address').first().fill(signer)
  await page.getByLabel('Weight').first().fill(String(options.weight ?? 1))
  await page.getByRole('button', { name: 'Create', exact: true }).click()

  const failure = page.locator('[data-notification-id]').filter({
    hasText: 'Failed to create wallet',
  }).last()
  const result = await Promise.race([
    page.waitForURL(/#\/wallet\/0x[0-9a-f]{40}$/i, { timeout: 45_000 }).then(() => 'created'),
    failure.waitFor({ state: 'visible', timeout: 45_000 }).then(() => 'failed'),
  ])
  if (result === 'failed') {
    throw new Error((await failure.textContent()) || 'Failed to create wallet')
  }
  await expectNotification(page, 'Wallet created')
  await expect(page.getByText(`Sequence v${version}`, { exact: true })).toBeVisible({
    timeout: 30_000,
  })

  const match = page.url().match(/#\/wallet\/(0x[0-9a-f]{40})$/i)
  if (!match) throw new Error(`Could not read wallet address from ${page.url()}`)
  return { address: match[1] as `0x${string}`, name, salt, version }
}

export async function selectAmoy(page: Page) {
  const network = page.getByLabel('Network')
  const labels = await network.locator('option').allTextContents()
  const label = labels.find((option) => option.toLowerCase().includes('amoy'))
  if (!label) throw new Error(`Polygon Amoy is not available; found ${labels.join(', ')}`)
  await network.selectOption({ label })
}

export async function createRawTransaction(
  page: Page,
  wallet: string,
  to: string,
  options: { value?: bigint; data?: string; commitUpdates?: boolean } = {},
) {
  await page.goto(`/#/new-transaction/${wallet}`)
  await selectAmoy(page)
  await expect(page.getByText(/Commit pending wallet updates \(\d+\)/)).toBeVisible({
    timeout: 30_000,
  })

  if (options.commitUpdates) {
    const commit = page.getByRole('switch', { name: /Commit pending wallet updates/ })
    await expect(commit).toBeEnabled({ timeout: 30_000 })
    if (!(await commit.isChecked())) await commit.check()
  }

  await page.getByLabel('To').first().fill(to)
  await page.getByLabel('Value (wei)').first().fill(String(options.value ?? 0n))
  await page.getByLabel('Data').first().fill(options.data ?? '0x')
  await page.getByRole('button', { name: 'Submit', exact: true }).click()

  await expectNotification(page, 'Transaction created')
  await expect(page).toHaveURL(/#\/transaction\/0x[0-9a-f]{64}$/i, { timeout: 30_000 })
  return page.url().split('/').at(-1) as `0x${string}`
}

export async function signTransaction(page: Page) {
  const sign = page.getByRole('button', { name: 'Sign transaction' })
  await expect(sign).toBeEnabled({ timeout: 30_000 })
  await sign.click()
  await expectNotification(page, 'Transaction signed')
  await expect(page.getByRole('cell', { name: '✅' })).toBeVisible({ timeout: 30_000 })
}

export async function executeTransaction(page: Page) {
  const execute = page.getByRole('button', { name: 'Execute transaction' })
  await expect(execute).toBeEnabled({ timeout: 30_000 })
  await execute.click()
  const failure = page.getByText('Failed to execute transaction', { exact: true }).last()
  const outcome = await Promise.race([
    page.getByText('Transaction executed', { exact: true }).last().waitFor({
      state: 'visible',
      timeout: 45_000,
    }).then(() => 'executed'),
    failure.waitFor({ state: 'visible', timeout: 45_000 }).then(() => 'failed'),
  ])
  if (outcome === 'failed') {
    const alert = failure.locator('xpath=ancestor::*[@role="alert"][1]')
    throw new Error((await alert.textContent()) || 'Failed to execute transaction')
  }
  const notification = await expectNotification(page, 'Transaction executed', false)
  const text = await notification.textContent()
  const hash = text?.match(/0x[0-9a-f]{64}/i)?.[0]
  if (!hash) throw new Error(`Execution transaction hash not found in: ${text}`)
  const close = notification.getByRole('button')
  if (await close.isVisible().catch(() => false)) {
    await close.evaluate((button: HTMLButtonElement) => button.click())
  } else {
    await page.mouse.move(0, 0)
    await notification.waitFor({ state: 'hidden', timeout: 10_000 })
  }
  return hash as `0x${string}`
}

export async function createMessage(page: Page, wallet: string, raw: string) {
  await page.goto(`/#/sign-message/${wallet}`)
  await page.getByLabel('Message').fill(raw)
  await selectAmoy(page)
  const submit = page.getByRole('button', { name: 'Submit' })
  await expect(submit).toBeEnabled({ timeout: 30_000 })
  await submit.click()
  await expect(page).toHaveURL(/#\/message\/0x[0-9a-f]{64}$/i, { timeout: 30_000 })
  return page.url().split('/').at(-1) as `0x${string}`
}

export async function signMessage(page: Page) {
  const sign = page.getByRole('button', { name: 'Sign message' })
  await expect(sign).toBeEnabled({ timeout: 30_000 })
  await sign.click()
  await expectNotification(page, 'Message signed')
  await expect(page.getByText('true', { exact: true })).toBeVisible({ timeout: 45_000 })
}

export async function deployWallet(page: Page) {
  const deploy = page.getByRole('button', { name: 'Deploy wallet' })
  await expect(deploy).toBeEnabled({ timeout: 30_000 })
  await deploy.click()
  const failure = page.getByText('Failed to deploy wallet', { exact: true }).last()
  const outcome = await Promise.race([
    page.getByText('Wallet deployed', { exact: true }).last().waitFor({
      state: 'visible',
      timeout: 45_000,
    }).then(() => 'deployed'),
    failure.waitFor({ state: 'visible', timeout: 45_000 }).then(() => 'failed'),
  ])
  if (outcome === 'failed') {
    const alert = failure.locator('xpath=ancestor::*[@role="alert"][1]')
    throw new Error((await alert.textContent()) || 'Failed to deploy wallet')
  }
  const notification = await expectNotification(page, 'Wallet deployed', false)
  const text = await notification.textContent()
  const hash = text?.match(/0x[0-9a-f]{64}/i)?.[0]
  if (!hash) throw new Error(`Deployment transaction hash not found in: ${text}`)
  const close = notification.getByRole('button')
  if (await close.isVisible().catch(() => false)) {
    await close.evaluate((button: HTMLButtonElement) => button.click())
  } else {
    await page.mouse.move(0, 0)
    await notification.waitFor({ state: 'hidden', timeout: 10_000 })
  }
  return hash as `0x${string}`
}

export async function createUpdate(
  page: Page,
  wallet: string,
  options: { threshold?: number; weight?: number } = {},
) {
  await page.goto(`/#/update/${wallet}`)
  const threshold = page.getByLabel('Threshold')
  await expect(threshold).toBeVisible({ timeout: 30_000 })
  await threshold.fill(String(options.threshold ?? 1))
  await page.getByLabel('Weight').first().fill(String(options.weight ?? 2))
  await page.getByRole('button', { name: 'Update', exact: true }).click()
  const failure = page.locator('[data-notification-id]').filter({
    hasText: 'Failed to create update',
  }).last()
  const result = await Promise.race([
    page.waitForURL(/#\/do-update\/0x[0-9a-f]{64}$/i, { timeout: 45_000 }).then(() => 'created'),
    failure.waitFor({ state: 'visible', timeout: 45_000 }).then(() => 'failed'),
  ])
  if (result === 'failed') {
    throw new Error((await failure.textContent()) || 'Failed to create update')
  }
  await expectNotification(page, 'Update created')
  return page.url().split('/').at(-1) as `0x${string}`
}

export async function signAndPublishUpdate(page: Page) {
  const sign = page.getByRole('button', { name: 'Sign change' })
  await expect(sign).toBeEnabled({ timeout: 30_000 })
  await sign.click()
  await expectNotification(page, 'Update signed')

  const execute = page.getByRole('button', { name: 'Execute change' })
  await expect(execute).toBeEnabled({ timeout: 30_000 })
  await execute.click()
  await expectNotification(page, 'Update executed')
}

export async function exportPayload(page: Page) {
  await page.getByRole('button', { name: 'Export data' }).click()
  const dialog = page.getByRole('dialog', { name: 'Export data' })
  await expect(dialog).toBeVisible()
  const content = await dialog.getByRole('textbox').inputValue()
  await dialog.getByRole('button', { name: 'Copy' }).click()
  await expectNotification(page, 'Copied to clipboard')
  await page.keyboard.press('Escape')
  return content
}

export async function importPayload(page: Page, payload: string) {
  await page.getByText('Import Data', { exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Import data' })
  await dialog.getByRole('textbox').fill(payload)
  await dialog.getByRole('button', { name: 'Import', exact: true }).click()
}
