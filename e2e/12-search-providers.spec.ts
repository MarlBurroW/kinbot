import { test, expect, type Page } from '@playwright/test'
import { loginAs, mockProviderModels } from './helpers/auth'

/**
 * Open Settings dialog and navigate to the Search Providers section.
 */
async function openSearchProviderSettings(page: Page) {
  await page.locator('button:has(.lucide-settings-2)').click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })

  await page.getByRole('dialog').getByText('Search', { exact: true }).click()
  await expect(page.getByText('Manage web search provider connections')).toBeVisible({ timeout: 5_000 })
}

/**
 * Mock all search-provider-related API routes.
 */
async function mockSearchProviderApis(page: Page) {
  // Mock provider test endpoint (both for existing and new providers)
  await page.route('**/api/providers/*/test', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ valid: true }),
      })
    }
    return route.continue()
  })

  await page.route('**/api/providers/test', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ valid: true }),
      })
    }
    return route.continue()
  })
}

test.describe.serial('Search provider management', () => {
  test.beforeEach(async ({ page }) => {
    await mockProviderModels(page)
    await mockSearchProviderApis(page)

    await page.goto('/')
    await expect(page.getByText('Sign in to your KinBot workspace')).toBeVisible({ timeout: 10_000 })
    await loginAs(page)
    await expect(page.getByText('Kins', { exact: true })).toBeVisible({ timeout: 10_000 })
  })

  test('should show empty state when no search providers exist', async ({ page }) => {
    await openSearchProviderSettings(page)

    // Empty state message
    await expect(page.getByText('No search providers configured')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Connect a search provider so your Kins can look things up on the web.')).toBeVisible()
  })

  test('should add a Brave Search provider', async ({ page }) => {
    await openSearchProviderSettings(page)

    // Click "Add search provider" from empty state
    await page.getByRole('button', { name: 'Add search provider' }).first().click()

    // Form should appear — type defaults to first search provider (Brave Search)
    await expect(page.locator('#providerName')).toBeVisible({ timeout: 5_000 })

    // Fill name and API key
    await page.fill('#providerName', 'E2E Brave Search')
    await page.fill('#apiKey', 'BSAe2e-fake-key-12345')

    // Test connection
    await page.getByRole('button', { name: 'Test connection' }).click()

    // Wait for Add button to appear after successful test
    await expect(page.getByRole('button', { name: /Add provider/i })).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /Add provider/i }).click()

    // Provider should appear in list
    await expect(page.getByText('E2E Brave Search').first()).toBeVisible({ timeout: 5_000 })
  })

  test('should add a second search provider (Tavily)', async ({ page }) => {
    await openSearchProviderSettings(page)

    // Click "Add search provider" button (bottom full-width one, since we're no longer in empty state)
    await page.getByRole('button', { name: 'Add search provider' }).last().click()

    await expect(page.locator('#providerName')).toBeVisible({ timeout: 5_000 })

    // Select Tavily type from the provider type dropdown
    // The dialog has a Select for provider type — find it by looking for the trigger inside the dialog
    const dialog = page.getByRole('dialog')
    const typeSelector = dialog.locator('[data-slot="select-trigger"]').first()
    await typeSelector.click()
    await page.locator('[data-slot="select-item"]').filter({ hasText: 'Tavily' }).click()
    await page.waitForTimeout(300)

    await page.fill('#providerName', 'E2E Tavily')
    await page.fill('#apiKey', 'tvly-e2e-fake-key-12345')

    await page.getByRole('button', { name: 'Test connection' }).click()
    await expect(page.getByRole('button', { name: /Add provider/i })).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /Add provider/i }).click()

    await expect(page.getByText('E2E Tavily').first()).toBeVisible({ timeout: 5_000 })
  })

  test('should show default provider selector when providers exist', async ({ page }) => {
    await openSearchProviderSettings(page)

    // Default provider section should be visible
    await expect(page.getByText('Default provider')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Used by all Kins unless they override it individually.')).toBeVisible()
  })

  test('should change default provider', async ({ page }) => {
    await openSearchProviderSettings(page)

    // Find the default provider selector (ProviderSelector in the settings card)
    const defaultProviderCard = page.locator('.surface-card').filter({ hasText: 'Default provider' })
    const selector = defaultProviderCard.locator('[data-slot="select-trigger"]')
    await expect(selector).toBeVisible({ timeout: 5_000 })
    await selector.click()

    // Select E2E Brave Search
    await page.locator('[data-slot="select-item"]').filter({ hasText: 'E2E Brave Search' }).click()

    // Toast confirmation
    await expect(page.getByText('Default search provider updated')).toBeVisible({ timeout: 5_000 })
  })

  test('should test all providers', async ({ page }) => {
    await openSearchProviderSettings(page)

    // "Test All" button should be visible (we have 2 providers)
    const testAllButton = page.getByRole('button', { name: /Test all/i })
    await expect(testAllButton).toBeVisible({ timeout: 5_000 })
    await testAllButton.click()

    // Wait for the success toast
    await expect(page.getByText(/tested successfully/i).or(page.getByText(/passed/i))).toBeVisible({ timeout: 15_000 })
  })

  test('should edit a search provider name', async ({ page }) => {
    await openSearchProviderSettings(page)

    // Click edit on first provider
    const editButton = page.getByRole('dialog').locator('button:has(.lucide-pencil)').first()
    await expect(editButton).toBeVisible({ timeout: 5_000 })
    await editButton.click()

    // Edit form should open
    await expect(page.locator('#providerName')).toBeVisible({ timeout: 5_000 })

    await page.locator('#providerName').click({ clickCount: 3 })
    await page.locator('#providerName').fill('Renamed Brave Search')

    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText(/updated|saved/i).first()).toBeVisible({ timeout: 5_000 })
  })

  test('should handle failed provider test', async ({ page }) => {
    // Override mock to fail
    await page.route('**/api/providers/*/test', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ valid: false, error: 'Invalid API key' }),
        })
      }
      return route.continue()
    })

    await openSearchProviderSettings(page)

    // Click test on a provider (skip Test All button)
    const allRefreshButtons = page.getByRole('dialog').locator('button:has(.lucide-refresh-cw)')
    const count = await allRefreshButtons.count()
    if (count > 1) {
      await allRefreshButtons.nth(1).click()
    } else {
      await allRefreshButtons.first().click()
    }

    await expect(page.getByText('Invalid API key')).toBeVisible({ timeout: 5_000 })
  })

  test('should delete a search provider', async ({ page }) => {
    await openSearchProviderSettings(page)

    // Delete the last provider (Tavily)
    const deleteButton = page.getByRole('dialog').locator('button:has(.lucide-trash-2, .lucide-trash)').last()
    await expect(deleteButton).toBeVisible({ timeout: 5_000 })
    await deleteButton.click()

    // Confirmation
    await expect(page.getByText('Are you sure you want to delete this provider?')).toBeVisible({ timeout: 5_000 })
    await page.getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByText('Provider deleted')).toBeVisible({ timeout: 5_000 })
  })

  test('should delete remaining provider and return to empty state', async ({ page }) => {
    await openSearchProviderSettings(page)

    const deleteButton = page.getByRole('dialog').locator('button:has(.lucide-trash-2, .lucide-trash)').first()
    await expect(deleteButton).toBeVisible({ timeout: 5_000 })
    await deleteButton.click()

    await expect(page.getByText('Are you sure you want to delete this provider?')).toBeVisible({ timeout: 5_000 })
    await page.getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByText('Provider deleted')).toBeVisible({ timeout: 5_000 })

    // Should return to empty state
    await expect(page.getByText('No search providers configured')).toBeVisible({ timeout: 5_000 })
  })
})
