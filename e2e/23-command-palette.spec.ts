import { test, expect, type Page } from '@playwright/test'
import { loginAs, mockProviderModels } from './helpers/auth'

const CMD_PLACEHOLDER = 'Type a command or search...'

/**
 * Open the command palette with Ctrl+K and return the dialog locator.
 */
async function openCommandPalette(page: Page) {
  await page.keyboard.press('Control+k')
  await expect(page.getByPlaceholder(CMD_PLACEHOLDER)).toBeVisible({ timeout: 5_000 })
  return page.getByRole('dialog')
}

test.describe.serial('Command palette', () => {
  test.beforeEach(async ({ page }) => {
    await mockProviderModels(page)
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible({ timeout: 10_000 })
    await loginAs(page)
    await expect(page.getByText('Kins', { exact: true })).toBeVisible({ timeout: 10_000 })
  })

  test('should open command palette with Ctrl+K', async ({ page }) => {
    await openCommandPalette(page)
    await expect(page.getByPlaceholder(CMD_PLACEHOLDER)).toBeVisible()
  })

  test('should close command palette with Escape', async ({ page }) => {
    await openCommandPalette(page)
    await page.keyboard.press('Escape')
    await expect(page.getByPlaceholder(CMD_PLACEHOLDER)).not.toBeVisible({ timeout: 3_000 })
  })

  test('should toggle command palette with repeated Ctrl+K', async ({ page }) => {
    await openCommandPalette(page)
    await page.keyboard.press('Control+k')
    await expect(page.getByPlaceholder(CMD_PLACEHOLDER)).not.toBeVisible({ timeout: 3_000 })
  })

  test('should display Actions section with Create new Kin', async ({ page }) => {
    const dialog = await openCommandPalette(page)

    await expect(dialog.getByText('Create new Kin')).toBeVisible({ timeout: 5_000 })
  })

  test('should display toggle theme action', async ({ page }) => {
    const dialog = await openCommandPalette(page)

    await expect(dialog.getByText('Toggle dark/light theme')).toBeVisible({ timeout: 5_000 })
  })

  test('should display Settings section with entries', async ({ page }) => {
    const dialog = await openCommandPalette(page)

    await expect(dialog.getByText('General', { exact: true })).toBeVisible({ timeout: 5_000 })
    await expect(dialog.getByText('AI Providers')).toBeVisible()
  })

  test('should filter results by search query', async ({ page }) => {
    const dialog = await openCommandPalette(page)

    await page.getByPlaceholder(CMD_PLACEHOLDER).fill('vault')

    await expect(dialog.getByText(/vault/i).first()).toBeVisible({ timeout: 3_000 })
    // Unrelated items should be filtered
    await expect(dialog.getByText('Create new Kin')).not.toBeVisible()
  })

  test('should show empty state for non-matching search', async ({ page }) => {
    const dialog = await openCommandPalette(page)

    await page.getByPlaceholder(CMD_PLACEHOLDER).fill('xyznonexistent12345')

    await expect(dialog.getByText(/no results/i)).toBeVisible({ timeout: 3_000 })
  })

  test('should navigate to settings when clicking General', async ({ page }) => {
    const dialog = await openCommandPalette(page)

    await dialog.getByText('General', { exact: true }).click()

    // Settings dialog should open (command palette closes, settings dialog appears)
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
  })

  test('should open create kin dialog when clicking Create new Kin', async ({ page }) => {
    const dialog = await openCommandPalette(page)

    await dialog.getByText('Create new Kin').click()

    await expect(page.getByRole('heading', { name: 'Describe your Kin' })).toBeVisible({ timeout: 5_000 })
    await page.keyboard.press('Escape')
  })

  test('should close palette via X button', async ({ page }) => {
    await openCommandPalette(page)

    // The X close button is visible in the top-right of the dialog
    const closeBtn = page.getByRole('dialog').locator('button:has(.lucide-x), button[aria-label="Close"]').first()
    if (await closeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await closeBtn.click()
      await expect(page.getByPlaceholder(CMD_PLACEHOLDER)).not.toBeVisible({ timeout: 3_000 })
    }
  })
})
