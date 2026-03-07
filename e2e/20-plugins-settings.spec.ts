import { test, expect, type Page } from '@playwright/test'
import { loginAs, mockProviderModels } from './helpers/auth'

async function openSettings(page: Page) {
  await page.locator('button:has(.lucide-settings-2)').click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
}

async function navigateToSection(page: Page, sectionName: string) {
  await page.getByRole('dialog').getByText(sectionName, { exact: true }).click()
}

test.describe.serial('Settings — Plugins', () => {
  test.beforeEach(async ({ page }) => {
    await mockProviderModels(page)
    await page.goto('/')
    await loginAs(page)
    await expect(page.locator('button:has(.lucide-settings-2)')).toBeVisible({ timeout: 10_000 })
  })

  test('should navigate to plugins section and show description', async ({ page }) => {
    await openSettings(page)
    await navigateToSection(page, 'Plugins')

    await expect(
      page.getByText('Manage plugins that extend KinBot with new tools, hooks, and integrations.')
    ).toBeVisible({ timeout: 5_000 })
  })

  test('should show empty state or plugin list', async ({ page }) => {
    await openSettings(page)
    await navigateToSection(page, 'Plugins')

    // Either we see the empty state or a list of plugins
    const dialog = page.getByRole('dialog')
    const emptyState = dialog.getByText('No plugins installed')
    const pluginSwitch = dialog.locator('button[role="switch"]').first()

    // One of these should be visible
    await expect(emptyState.or(pluginSwitch)).toBeVisible({ timeout: 5_000 })
  })

  test('should show reload button', async ({ page }) => {
    await openSettings(page)
    await navigateToSection(page, 'Plugins')

    await expect(
      page.getByRole('button', { name: /reload/i })
    ).toBeVisible({ timeout: 5_000 })
  })

  test('should show install plugin button and open install dialog', async ({ page }) => {
    await openSettings(page)
    await navigateToSection(page, 'Plugins')

    const installBtn = page.getByRole('button', { name: /install plugin/i })
    await expect(installBtn).toBeVisible({ timeout: 5_000 })

    await installBtn.click()

    // Install dialog should appear with source selection
    await expect(page.getByText('Install Plugin').nth(1)).toBeVisible({ timeout: 3_000 })
    await expect(page.getByText('Git Repository URL')).toBeVisible()
  })

  test('should switch install source between git and npm', async ({ page }) => {
    await openSettings(page)
    await navigateToSection(page, 'Plugins')

    await page.getByRole('button', { name: /install plugin/i }).click()
    await expect(page.getByText('Git Repository URL')).toBeVisible({ timeout: 3_000 })

    // Switch to npm source — the Select trigger is inside the install dialog
    const sourceSelect = page.locator('[data-slot="select-trigger"]').last()
    await sourceSelect.click()
    await page.getByRole('option', { name: /npm/i }).click()

    // Should now show npm package field instead of git URL
    await expect(page.getByText('npm Package Name')).toBeVisible()
  })

  test('should reload plugins', async ({ page }) => {
    await openSettings(page)
    await navigateToSection(page, 'Plugins')

    const reloadBtn = page.getByRole('button', { name: /reload/i })
    await expect(reloadBtn).toBeVisible({ timeout: 5_000 })

    await reloadBtn.click()

    // Should show success toast
    await expect(page.getByText('Plugins reloaded')).toBeVisible({ timeout: 5_000 })
  })

  test('should have install button disabled when git URL is empty', async ({ page }) => {
    await openSettings(page)
    await navigateToSection(page, 'Plugins')

    await page.getByRole('button', { name: /install plugin/i }).click()
    await expect(page.getByText('Git Repository URL')).toBeVisible({ timeout: 3_000 })

    // The install button in the dialog footer should be disabled
    const installBtn = page.getByRole('dialog').getByRole('button', { name: /install plugin/i })
    await expect(installBtn).toBeDisabled()
  })

  test('should enable install button when git URL is filled', async ({ page }) => {
    await openSettings(page)
    await navigateToSection(page, 'Plugins')

    await page.getByRole('button', { name: /install plugin/i }).click()
    await expect(page.getByText('Git Repository URL')).toBeVisible({ timeout: 3_000 })

    // Fill the git URL field
    await page.fill('#git-url', 'https://github.com/user/kinbot-plugin-test.git')

    // The install button should now be enabled
    const installBtn = page.getByRole('dialog').getByRole('button', { name: /install plugin/i })
    await expect(installBtn).toBeEnabled()
  })

  test('should have install button disabled when npm package is empty', async ({ page }) => {
    await openSettings(page)
    await navigateToSection(page, 'Plugins')

    await page.getByRole('button', { name: /install plugin/i }).click()
    await expect(page.getByText('Git Repository URL')).toBeVisible({ timeout: 3_000 })

    // Switch to npm
    const sourceSelect = page.locator('[data-slot="select-trigger"]').last()
    await sourceSelect.click()
    await page.getByRole('option', { name: /npm/i }).click()

    // Install button should be disabled with empty npm field
    const installBtn = page.getByRole('dialog').getByRole('button', { name: /install plugin/i })
    await expect(installBtn).toBeDisabled()

    // Fill the npm field
    await page.fill('#npm-package', 'kinbot-plugin-test')

    // Should now be enabled
    await expect(installBtn).toBeEnabled()
  })

  test('should close install dialog with cancel button', async ({ page }) => {
    await openSettings(page)
    await navigateToSection(page, 'Plugins')

    await page.getByRole('button', { name: /install plugin/i }).click()
    await expect(page.getByText('Git Repository URL')).toBeVisible({ timeout: 3_000 })

    // Click cancel
    await page.getByRole('button', { name: /cancel/i }).click()

    // The install dialog inner content should be gone
    await expect(page.getByText('Git Repository URL')).not.toBeVisible({ timeout: 3_000 })
  })

  test('should navigate to Browse Plugins (marketplace)', async ({ page }) => {
    await openSettings(page)
    await navigateToSection(page, 'Browse Plugins')

    await expect(
      page.getByText('Discover and install community plugins from the registry.')
    ).toBeVisible({ timeout: 5_000 })

    // Should show search input
    await expect(
      page.getByPlaceholder('Search plugins...')
    ).toBeVisible()
  })

  test('should show marketplace search input and refresh button', async ({ page }) => {
    await openSettings(page)
    await navigateToSection(page, 'Browse Plugins')

    const searchInput = page.getByPlaceholder('Search plugins...')
    await expect(searchInput).toBeVisible({ timeout: 5_000 })

    // Refresh button should be visible
    await expect(
      page.getByRole('dialog').locator('button:has(.lucide-refresh-cw)')
    ).toBeVisible()
  })
})
