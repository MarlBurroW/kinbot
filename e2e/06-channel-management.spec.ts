import { test, expect, type Page } from '@playwright/test'
import { loginAs, mockProviderModels } from './helpers/auth'

/**
 * Open Settings dialog and navigate to the Channels section.
 */
async function openChannelSettings(page: Page) {
  await page.locator('button:has(.lucide-settings-2)').click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })

  await page.getByRole('dialog').getByText('Channels', { exact: true }).click()
  await expect(page.getByText('Connect your Kins to external messaging platforms')).toBeVisible({ timeout: 5_000 })
}

/**
 * Open the "Add channel" form from the channels settings.
 * Returns once the form dialog is visible.
 */
async function openAddChannelForm(page: Page) {
  const addButton = page.getByRole('button', { name: /add channel/i })
  await addButton.first().click()

  // Wait for the form to appear — look for the bot token field which is unique to the add form
  await expect(page.getByPlaceholder('Paste your bot token here')).toBeVisible({ timeout: 5_000 })
}

/**
 * Fill and submit the add channel form.
 */
async function createChannel(page: Page, name: string, token: string, platform?: string) {
  await openAddChannelForm(page)

  // Fill name
  await page.getByPlaceholder('My Telegram bot').fill(name)

  // Select Kin
  const kinCombobox = page.locator('[role="combobox"]').filter({ hasText: /select a kin/i })
  if (await kinCombobox.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await kinCombobox.click()
    await page.getByRole('option').first().click()
  }

  // Change platform if needed
  if (platform) {
    // Click the platform selector (shows "Telegram" by default)
    const platformTrigger = page.locator('button[role="combobox"]').filter({ hasText: /telegram/i })
    await platformTrigger.click()
    await page.getByRole('option', { name: new RegExp(platform, 'i') }).click()
  }

  // Fill bot token
  await page.getByPlaceholder('Paste your bot token here').fill(token)

  // Save
  await page.getByRole('button', { name: /save/i }).click()

  // Wait for channel to appear in the list
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 10_000 })
}

/**
 * Mock channel-related API routes.
 */
async function mockChannelApis(page: Page) {
  await page.route('**/api/channels/*/test', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ valid: true, botInfo: { name: 'E2E Test Bot', username: 'e2e_test_bot' } }),
      })
    }
    return route.continue()
  })
}

test.describe.serial('Channel management', () => {
  test.beforeEach(async ({ page }) => {
    await mockProviderModels(page)
    await mockChannelApis(page)

    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible({ timeout: 10_000 })
    await loginAs(page)
    await expect(page.getByText('Kins', { exact: true })).toBeVisible({ timeout: 10_000 })
  })

  test('should open settings and see Channels section', async ({ page }) => {
    await openChannelSettings(page)

    await expect(page.getByText('Connect your Kins to external messaging platforms')).toBeVisible()
  })

  test('should create a new Telegram channel', async ({ page }) => {
    await openChannelSettings(page)
    await createChannel(page, 'Test Telegram Channel', '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11')

    // Verify it appears with correct platform badge
    await expect(page.getByText('telegram', { exact: true }).first()).toBeVisible()
  })

  test('should edit a channel name', async ({ page }) => {
    await openChannelSettings(page)
    await expect(page.getByText('Test Telegram Channel')).toBeVisible({ timeout: 10_000 })

    // Click pencil edit button
    const channelCard = page.locator('.surface-card', { hasText: 'Test Telegram Channel' })
    await channelCard.locator('button:has(.lucide-pencil)').click()

    // Wait for edit form
    await expect(page.getByText('Edit', { exact: true })).toBeVisible({ timeout: 5_000 })

    // Change name
    const nameInput = page.getByPlaceholder('My Telegram bot')
    await nameInput.clear()
    await nameInput.fill('Renamed Telegram Channel')

    await page.getByRole('button', { name: /save/i }).click()

    await expect(page.getByText('Renamed Telegram Channel')).toBeVisible({ timeout: 10_000 })
  })

  test('should test channel connection', async ({ page }) => {
    await openChannelSettings(page)
    await expect(page.getByText('Renamed Telegram Channel')).toBeVisible({ timeout: 10_000 })

    // Click plug/test button
    const channelCard = page.locator('.surface-card', { hasText: 'Renamed Telegram Channel' })
    await channelCard.locator('button:has(.lucide-plug)').click()

    // Should show success toast with bot info
    await expect(
      page.getByText(/e2e_test_bot/i).or(page.getByText(/success/i))
    ).toBeVisible({ timeout: 5_000 })
  })

  test('should delete a channel with confirmation', async ({ page }) => {
    await openChannelSettings(page)
    await expect(page.getByText('Renamed Telegram Channel')).toBeVisible({ timeout: 10_000 })

    const channelCard = page.locator('.surface-card', { hasText: 'Renamed Telegram Channel' })
    const deleteBtn = channelCard.locator('button:has(.lucide-trash-2), button:has(.lucide-trash)')
    await deleteBtn.click()

    // ConfirmDeleteButton may show a popover/dialog confirmation
    const confirmBtn = page.getByRole('button', { name: /confirm|delete|yes/i })
    if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmBtn.click()
    }

    await expect(page.getByText('Renamed Telegram Channel')).not.toBeVisible({ timeout: 10_000 })
  })

  test('should create a Discord channel with platform selector', async ({ page }) => {
    await openChannelSettings(page)
    await createChannel(
      page,
      'Test Discord Channel',
      'MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.fake-discord-token',
      'Discord',
    )

    await expect(page.getByText('discord', { exact: true }).first()).toBeVisible()
  })

  test('should clean up: delete Discord channel', async ({ page }) => {
    await openChannelSettings(page)
    await expect(page.getByText('Test Discord Channel')).toBeVisible({ timeout: 10_000 })

    const channelCard = page.locator('.surface-card', { hasText: 'Test Discord Channel' })
    const deleteBtn = channelCard.locator('button:has(.lucide-trash-2), button:has(.lucide-trash)')
    await deleteBtn.click()

    const confirmBtn = page.getByRole('button', { name: /confirm|delete|yes/i })
    if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmBtn.click()
    }

    await expect(page.getByText('Test Discord Channel')).not.toBeVisible({ timeout: 10_000 })
  })
})
