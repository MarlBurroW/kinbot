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
    await openProviderSettings(page)

    // Find a per-provider test button (icon-only RefreshCw button).
    // The "Test All" button also has RefreshCw but includes text; per-provider buttons are icon-only.
    const allRefreshButtons = page.getByRole('dialog').locator('button:has(.lucide-refresh-cw)')
    let testButton = allRefreshButtons.first()
    const count = await allRefreshButtons.count()
    // If multiple RefreshCw buttons exist (Test All + per-provider), skip the first one (Test All)
    if (count > 1) {
      testButton = allRefreshButtons.nth(1)
    }
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

    // Change the name — triple-click to select all, then type over it
    await page.locator('#providerName').click({ clickCount: 3 })
    await page.locator('#providerName').fill('Renamed E2E Provider')

    // When only the name changed (no config change), Save button should appear directly
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Save' }).click()

    // Should see success toast
    await expect(page.getByText(/updated|saved/i).first()).toBeVisible({ timeout: 5_000 })
  })

  test('should delete a provider with confirmation', async ({ page }) => {
    await openProviderSettings(page)

    // Click delete button (Trash icon) on the second provider (Anthropic / LLM only).
    // The first provider (OpenAI) is the sole embedding provider and cannot be deleted.
    const deleteButton = page.getByRole('dialog').locator('button:has(.lucide-trash-2, .lucide-trash)').last()
    await expect(deleteButton).toBeVisible({ timeout: 5_000 })
    await deleteButton.click()

    // Confirmation dialog should appear
    await expect(page.getByText('Are you sure you want to delete this provider?')).toBeVisible({ timeout: 5_000 })

    // Confirm deletion (button uses common.delete = "Delete")
    await page.getByRole('button', { name: 'Delete' }).click()

    // Should show deletion toast
    await expect(page.getByText('Provider deleted')).toBeVisible({ timeout: 5_000 })
  })

  test('should test all providers at once', async ({ page }) => {
    await openProviderSettings(page)

    // The "Test All" button should be visible when there are multiple providers
    const testAllButton = page.getByRole('button', { name: /test all/i })
    const testAllVisible = await testAllButton.isVisible().catch(() => false)

    if (testAllVisible) {
      await testAllButton.click()

      // Should show progress or results
      await expect(page.getByText(/passed/i).first()).toBeVisible({ timeout: 15_000 })
    }
  })

  test('should cancel adding a provider', async ({ page }) => {
    // Mock the test endpoint for provider creation flow
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

    // Wait for the form to appear
    await expect(page.locator('#providerName')).toBeVisible({ timeout: 5_000 })

    // Fill some data
    await page.fill('#providerName', 'Should Not Be Added')
    await page.fill('#apiKey', 'sk-cancel-test')

    // Cancel by pressing Escape
    await page.keyboard.press('Escape')

    // The form should close
    await expect(page.locator('#providerName')).not.toBeVisible({ timeout: 3_000 })

    // The provider should NOT appear in the list
    await expect(page.getByText('Should Not Be Added')).not.toBeVisible()
  })

  test('should switch provider type in the add form', async ({ page }) => {
    await openProviderSettings(page)

    // Click "Add provider"
    await page.getByRole('button', { name: 'Add provider' }).click()
    await expect(page.locator('#apiKey')).toBeVisible({ timeout: 5_000 })

    // The provider type select (combobox) should be visible in the form
    const typeSelect = page.getByRole('combobox').first()
    await expect(typeSelect).toBeVisible({ timeout: 5_000 })

    // Click to open the select dropdown
    await typeSelect.click({ force: true })

    // Should see provider type options (at least Anthropic and OpenAI)
    await expect(page.getByRole('option', { name: /OpenAI/i })).toBeVisible({ timeout: 3_000 })

    // Select OpenAI
    await page.getByRole('option', { name: /OpenAI/i }).click()

    // The form should still be visible with the API key field
    await expect(page.locator('#apiKey')).toBeVisible()

    // Close without saving
    await page.keyboard.press('Escape')
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

    // Click test on a provider (skip "Test All" button if present)
    const allRefreshButtons = page.getByRole('dialog').locator('button:has(.lucide-refresh-cw)')
    const count = await allRefreshButtons.count()
    if (count > 0) {
      const testButton = count > 1 ? allRefreshButtons.nth(1) : allRefreshButtons.first()
      await testButton.click()

      // Should show failure toast (displays the error message from the mock response)
      await expect(page.getByText('Invalid API key')).toBeVisible({ timeout: 5_000 })
    }
  })
})
