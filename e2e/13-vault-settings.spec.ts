import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

/** Open settings dialog and navigate to Vault section */
async function openVaultSettings(page: import('@playwright/test').Page) {
  await page.locator('button:has(.lucide-settings-2)').click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
  await page.getByRole('dialog').getByText('Vault', { exact: true }).click()
  await expect(page.getByText('Manage encrypted entries')).toBeVisible({ timeout: 5_000 })
}

test.describe.serial('Vault settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await loginAs(page)
    await expect(page.locator('button:has(.lucide-settings-2)')).toBeVisible({ timeout: 10_000 })
  })

  test('should navigate to Vault settings and see empty state', async ({ page }) => {
    await openVaultSettings(page)

    await expect(page.getByText('No entries configured')).toBeVisible()
    await expect(page.getByText('Store API keys, credentials, cards, notes and files securely.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add entry' }).first()).toBeVisible()

    // Type filter tabs
    await expect(page.getByText('All', { exact: true })).toBeVisible()
    await expect(page.getByText('Favorites', { exact: true })).toBeVisible()
  })

  test('should create a text vault entry', async ({ page }) => {
    await openVaultSettings(page)

    await page.getByRole('button', { name: 'Add entry' }).first().click()
    await expect(page.getByText('Store an encrypted entry')).toBeVisible({ timeout: 5_000 })

    await page.fill('#vault-key', 'MY_API_KEY')
    await page.fill('#vault-field-value', 'super-secret-value-123')
    await page.fill('#vault-description', 'Test API key for E2E')

    // Click Add entry in dialog
    const dialog = page.locator('[role="dialog"]')
    await dialog.getByRole('button', { name: 'Add entry' }).click()

    await expect(page.getByText('Entry added')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('MY_API_KEY')).toBeVisible()
    await expect(page.getByText('Test API key for E2E')).toBeVisible()
  })

  test('should create a credential entry', async ({ page }) => {
    await openVaultSettings(page)

    await page.getByRole('button', { name: 'Add entry' }).last().click()
    await expect(page.getByText('Store an encrypted entry')).toBeVisible({ timeout: 5_000 })

    // Change type to Credential
    const entryDialog = page.locator('[role="dialog"]').last()
    await entryDialog.locator('[data-slot="select-trigger"]').click()
    await page.locator('[data-slot="select-item"]').filter({ hasText: /credential/i }).click()
    await page.waitForTimeout(300)

    await page.fill('#vault-key', 'GITHUB_LOGIN')
    await page.fill('#vault-field-url', 'https://github.com')
    await page.fill('#vault-field-username', 'testuser')
    await page.fill('#vault-field-password', 'gh-password-123')

    const dialog = page.locator('[role="dialog"]')
    await dialog.getByRole('button', { name: 'Add entry' }).click()

    await expect(page.getByText('Entry added')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('GITHUB_LOGIN')).toBeVisible()
  })

  test('should create a note entry', async ({ page }) => {
    await openVaultSettings(page)

    await page.getByRole('button', { name: 'Add entry' }).last().click()
    await expect(page.getByText('Store an encrypted entry')).toBeVisible({ timeout: 5_000 })

    const entryDialog = page.locator('[role="dialog"]').last()
    await entryDialog.locator('[data-slot="select-trigger"]').click()
    await page.locator('[data-slot="select-item"]').filter({ hasText: /note/i }).click()
    await page.waitForTimeout(300)

    await page.fill('#vault-key', 'DEPLOYMENT_NOTES')
    await page.fill('#vault-field-content', 'Remember to update env vars before deploying.')

    const dialog = page.locator('[role="dialog"]')
    await dialog.getByRole('button', { name: 'Add entry' }).click()

    await expect(page.getByText('Entry added')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('DEPLOYMENT_NOTES')).toBeVisible()
  })

  test('should filter entries by type tab', async ({ page }) => {
    await openVaultSettings(page)

    // All tab should show 3 entries
    await expect(page.getByText('MY_API_KEY')).toBeVisible()
    await expect(page.getByText('GITHUB_LOGIN')).toBeVisible()
    await expect(page.getByText('DEPLOYMENT_NOTES')).toBeVisible()

    // Click Credential tab
    const credentialTab = page.locator('button').filter({ hasText: /^Credential$/ })
    await credentialTab.click()
    await expect(page.getByText('GITHUB_LOGIN')).toBeVisible()
    await expect(page.getByText('MY_API_KEY')).not.toBeVisible()
    await expect(page.getByText('DEPLOYMENT_NOTES')).not.toBeVisible()

    // Click Note tab
    const noteTab = page.locator('button').filter({ hasText: /^Note$/ })
    await noteTab.click()
    await expect(page.getByText('DEPLOYMENT_NOTES')).toBeVisible()
    await expect(page.getByText('GITHUB_LOGIN')).not.toBeVisible()

    // Back to All
    await page.getByText('All', { exact: true }).click()
    await expect(page.getByText('MY_API_KEY')).toBeVisible()
    await expect(page.getByText('GITHUB_LOGIN')).toBeVisible()
    await expect(page.getByText('DEPLOYMENT_NOTES')).toBeVisible()
  })

  test('should toggle favorite on an entry', async ({ page }) => {
    await openVaultSettings(page)

    // Hover over MY_API_KEY card and click star
    const card = page.locator('.surface-card').filter({ hasText: 'MY_API_KEY' })
    await card.hover()
    await card.locator('button:has(.lucide-star)').click()

    // Switch to Favorites tab
    await page.getByText('Favorites', { exact: true }).click()
    await expect(page.getByText('MY_API_KEY')).toBeVisible()
    await expect(page.getByText('GITHUB_LOGIN')).not.toBeVisible()

    // Back to All
    await page.getByText('All', { exact: true }).click()
  })

  test('should edit a vault entry description', async ({ page }) => {
    await openVaultSettings(page)

    const card = page.locator('.surface-card').filter({ hasText: 'MY_API_KEY' })
    await card.hover()
    await card.locator('button:has(.lucide-pencil)').click()

    await expect(page.getByText('Update value or description')).toBeVisible({ timeout: 5_000 })

    // Key should be disabled
    await expect(page.locator('#vault-key')).toBeDisabled()

    // Update description
    await page.fill('#vault-description', 'Updated API key description')

    const dialog = page.locator('[role="dialog"]')
    await dialog.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Entry updated')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Updated API key description')).toBeVisible()
  })

  test('should delete an entry with confirmation', async ({ page }) => {
    await openVaultSettings(page)

    // Delete DEPLOYMENT_NOTES
    const card = page.locator('.surface-card').filter({ hasText: 'DEPLOYMENT_NOTES' })
    await card.hover()
    await card.locator('button:has(.lucide-trash-2)').click()

    // ConfirmDeleteButton shows a confirmation UI
    await page.waitForTimeout(300)
    // Look for a Delete confirm button in alertdialog or popover
    const deleteConfirm = page.getByRole('button', { name: /^delete$/i }).last()
    await deleteConfirm.click()

    await expect(page.getByText('Entry deleted')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('DEPLOYMENT_NOTES')).not.toBeVisible()
  })

  test('should delete remaining entries for cleanup', async ({ page }) => {
    await openVaultSettings(page)

    // Delete GITHUB_LOGIN
    const card1 = page.locator('.surface-card').filter({ hasText: 'GITHUB_LOGIN' })
    await card1.hover()
    await card1.locator('button:has(.lucide-trash-2)').click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /^delete$/i }).last().click()
    await expect(page.getByText('Entry deleted')).toBeVisible({ timeout: 5_000 })

    // Wait for toast to disappear
    await page.waitForTimeout(1000)

    // Delete MY_API_KEY
    const card2 = page.locator('.surface-card').filter({ hasText: 'MY_API_KEY' })
    await card2.hover()
    await card2.locator('button:has(.lucide-trash-2)').click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /^delete$/i }).last().click()
    await expect(page.getByText('Entry deleted')).toBeVisible({ timeout: 5_000 })

    // Should be back to empty state
    await expect(page.getByText('No entries configured')).toBeVisible()
  })
})
