import { test, expect, type Page } from '@playwright/test'
import { loginAs, mockProviderModels } from './helpers/auth'

/**
 * Open the Settings dialog and navigate to the AI Providers section.
 */
async function openProviderSettings(page: Page) {
  // Click the settings icon button in the sidebar footer
  await page.locator('button:has(.lucide-settings-2)').click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })

  // Click the "AI Providers" menu item
  await page.getByRole('dialog').getByText('AI Providers', { exact: true }).click()
  await expect(page.getByText('Manage your AI provider connections')).toBeVisible({ timeout: 5_000 })
}

test.describe.serial('Provider management', () => {
  test.beforeEach(async ({ page }) => {
    await mockProviderModels(page)

    // Mock provider test-connection to always succeed (server has E2E_SKIP_PROVIDER_TEST=true too)
    await page.route('**/api/providers/*/test', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ valid: true }),
        })
      }
      return route.continue()
    })

    // Login
    await page.goto('/')
    await expect(page.getByText('Sign in to your KinBot workspace')).toBeVisible({ timeout: 10_000 })
    await loginAs(page)
    await expect(page.getByText('Kins', { exact: true })).toBeVisible({ timeout: 10_000 })
  })

  test('should open settings and see AI Providers section', async ({ page }) => {
    await openProviderSettings(page)

    // Should see the description and add button
    await expect(page.getByRole('button', { name: 'Add provider' })).toBeVisible()
  })

  test('should add a new provider via the form', async ({ page }) => {
    // Also mock the test endpoint for new provider creation flow (POST /api/providers/test)
    await page.route('**/api/providers/test', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ valid: true }),
        })
      }
      return route.continue()
    })

    await openProviderSettings(page)

    // Click "Add provider"
    await page.getByRole('button', { name: 'Add provider' }).click()

    // Wait for the add provider form to appear
    await expect(page.locator('#providerName')).toBeVisible({ timeout: 5_000 })

    // Fill provider name
    await page.fill('#providerName', 'E2E Test Provider')

    // Fill API key
    await page.fill('#apiKey', 'sk-e2e-fake-key-12345')

    // Click "Test connection" button
    await page.getByRole('button', { name: 'Test connection' }).click()

    // Wait for test to pass — the button should change to "Add provider"
    await expect(page.getByRole('button', { name: /Add provider/i })).toBeVisible({ timeout: 10_000 })

    // Click "Add provider"
    await page.getByRole('button', { name: /Add provider/i }).click()

    // Toast should confirm success, and provider should appear in the list
    await expect(page.getByText('E2E Test Provider').first()).toBeVisible({ timeout: 5_000 })
  })

  test('should test an existing provider connection', async ({ page }) => {
    // Also mock the test endpoint explicitly for any provider ID
    await page.route(/\/api\/providers\/[a-f0-9-]+\/test$/, (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ valid: true }),
        })
      }
      return route.continue()
    })

    await openProviderSettings(page)

    // Find test buttons (RefreshCw icon)
    const testButton = page.getByRole('dialog').locator('button:has(.lucide-refresh-cw)').first()
    await expect(testButton).toBeVisible({ timeout: 5_000 })
    await testButton.click()

    // Should show success toast
    await expect(page.getByText('Connection successful')).toBeVisible({ timeout: 10_000 })
  })

  test('should edit a provider name', async ({ page }) => {
    await openProviderSettings(page)

    // Click edit button (Pencil icon) on first provider
    const editButton = page.getByRole('dialog').locator('button:has(.lucide-pencil)').first()
    await expect(editButton).toBeVisible({ timeout: 5_000 })
    await editButton.click()

    // The edit form dialog should open
    await expect(page.locator('#providerName')).toBeVisible({ timeout: 5_000 })

    // Change the name
    await page.locator('#providerName').clear()
    await page.fill('#providerName', 'Renamed E2E Provider')

    // When only the name changed (no config change), Save button should appear directly
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible({ timeout: 5_000 })
    await page.getByRole('button', { name: 'Save' }).click()

    // Should see success toast
    await expect(page.getByText(/updated|saved/i).first()).toBeVisible({ timeout: 5_000 })
  })

  test('should delete a provider with confirmation', async ({ page }) => {
    await openProviderSettings(page)

    // Click delete button (Trash icon) on first provider
    const deleteButton = page.getByRole('dialog').locator('button:has(.lucide-trash-2, .lucide-trash)').first()
    await expect(deleteButton).toBeVisible({ timeout: 5_000 })
    await deleteButton.click()

    // Confirmation dialog should appear
    await expect(page.getByText('Are you sure you want to delete this provider?')).toBeVisible({ timeout: 5_000 })

    // Confirm
    await page.getByRole('button', { name: 'Confirm' }).click()

    // Should show deletion toast
    await expect(page.getByText('Provider deleted')).toBeVisible({ timeout: 5_000 })
  })

  test('should handle failed provider test gracefully', async ({ page }) => {
    // Override the mock to return failure
    await page.route('**/api/providers/*/test', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ valid: false, error: 'Invalid API key' }),
        })
      }
      return route.continue()
    })

    await openProviderSettings(page)

    // Click test on the first provider
    const testButton = page.getByRole('dialog').locator('button:has(.lucide-refresh-cw)').first()
    if (await testButton.isVisible()) {
      await testButton.click()

      // Should show failure toast
      await expect(page.getByText('Connection failed')).toBeVisible({ timeout: 5_000 })
    }
  })
})
