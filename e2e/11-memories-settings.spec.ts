import { test, expect, type Page } from '@playwright/test'
import { loginAs, mockProviderModels } from './helpers/auth'

/**
 * Open Settings dialog and navigate to the Memories section.
 */
async function openMemoriesSettings(page: Page) {
  await page.locator('button:has(.lucide-settings-2)').click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
  await page.getByRole('dialog').getByText('Memories', { exact: true }).click()
  await expect(page.getByText('View and manage all Kin memories.')).toBeVisible({ timeout: 5_000 })
}

/**
 * Ensure a Kin exists (needed for creating memories).
 */
async function ensureKinExists(page: Page) {
  // Navigate to home, check if a Kin already exists in sidebar
  const kinCard = page.locator('[data-slot="sidebar"] .surface-card').first()
  if (await kinCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
    return // Kin already exists
  }

  // Create a Kin via the wizard
  const createButton = page.getByRole('button', { name: /create/i }).first()
  if (await createButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await createButton.click()
  }

  // Fill wizard form
  const nameInput = page.locator('#kin-name')
  if (await nameInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await nameInput.fill('Memory Test Kin')
    // Click through wizard to create
    const nextBtn = page.getByRole('button', { name: /create|next|save/i }).last()
    await nextBtn.click()
    await page.waitForTimeout(1_000)
  }
}

/**
 * Mock the models endpoint for memory model pickers.
 */
async function mockModels(page: Page) {
  await mockProviderModels(page)
  await page.route('**/api/settings/models', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ extractionModel: null, embeddingModel: null }),
      })
    }
    return route.continue()
  })
  await page.route('**/api/settings/extraction-model', (route) => {
    if (route.request().method() === 'PUT') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
    }
    return route.continue()
  })
  await page.route('**/api/settings/embedding-model', (route) => {
    if (route.request().method() === 'PUT') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
    }
    return route.continue()
  })
}

test.describe.serial('Settings — Memories', () => {
  test.beforeEach(async ({ page }) => {
    await mockModels(page)
    await page.goto('/')
    await loginAs(page)
    await expect(page.locator('button:has(.lucide-settings-2)')).toBeVisible({ timeout: 10_000 })
  })

  test('should navigate to Memories settings section', async ({ page }) => {
    await openMemoriesSettings(page)

    // Should show model configuration section
    await expect(page.getByText('Model Configuration')).toBeVisible()
    await expect(page.getByText('Models used for memory extraction and semantic search.')).toBeVisible()

    // Should show extraction model label
    await expect(page.getByText('Extraction Model')).toBeVisible()

    // Should show embedding model label
    await expect(page.getByText('Embedding Model', { exact: true })).toBeVisible()

    // Should show empty state for memories (no memories yet)
    await expect(page.getByText('No memories yet')).toBeVisible({ timeout: 10_000 })

    // Should show "Add memory" button (empty state has one, plus bottom button)
    await expect(page.getByRole('button', { name: 'Add memory' }).first()).toBeVisible()
  })

  test('should open add memory dialog', async ({ page }) => {
    await openMemoriesSettings(page)

    // Click the "Add memory" button
    await page.getByRole('button', { name: 'Add memory' }).first().click()

    // Dialog should open — check for the content textarea
    await expect(page.getByPlaceholder('Enter the memory content...')).toBeVisible({ timeout: 5_000 })

    // Should show form fields
    await expect(page.getByText('Content')).toBeVisible()
    await expect(page.getByText('Category')).toBeVisible()
    await expect(page.getByText('Subject')).toBeVisible()

    // Content placeholder
    await expect(page.getByPlaceholder('Enter the memory content...')).toBeVisible()

    // Cancel button should close the dialog
    await page.getByRole('button', { name: 'Cancel' }).click()
    // The content textarea should disappear when the form dialog closes
    await expect(page.getByPlaceholder('Enter the memory content...')).not.toBeVisible({ timeout: 3_000 })
  })

  test('should create a memory entry', async ({ page }) => {
    await openMemoriesSettings(page)

    // Open add dialog
    await page.getByRole('button', { name: 'Add memory' }).first().click()
    await expect(page.getByPlaceholder('Enter the memory content...')).toBeVisible({ timeout: 5_000 })

    // Select a Kin if the Kin picker is visible
    const kinPicker = page.locator('[data-slot="select-trigger"]').filter({ hasText: /select a kin/i })
    if (await kinPicker.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await kinPicker.click()
      await page.locator('[data-slot="select-item"]').first().click()
    }

    // Fill content
    await page.getByPlaceholder('Enter the memory content...').fill('The user prefers dark mode for all applications.')

    // Category should default to "Fact" — change to "Preference"
    const categoryTrigger = page.locator('[data-slot="select-trigger"]').filter({ hasText: 'Fact' })
    await categoryTrigger.click()
    await page.locator('[data-slot="select-item"]').filter({ hasText: 'Preference' }).click()

    // Fill subject
    await page.getByPlaceholder('Contact or context (optional)').fill('UI Settings')

    // Save
    await page.getByRole('button', { name: 'Save' }).click()

    // Should show success toast
    await expect(page.getByText('Memory added').first()).toBeVisible({ timeout: 5_000 })

    // Memory should appear in the list
    await expect(page.getByText('The user prefers dark mode for all applications.')).toBeVisible({ timeout: 5_000 })

    // Should show category badge
    await expect(page.getByText('Preference').first()).toBeVisible()

    // Should show subject badge
    await expect(page.getByText('UI Settings')).toBeVisible()
  })

  test('should create a second memory', async ({ page }) => {
    await openMemoriesSettings(page)

    // Wait for existing memory to load
    await expect(page.getByText('The user prefers dark mode for all applications.')).toBeVisible({ timeout: 5_000 })

    // Open add dialog via bottom button
    await page.getByRole('button', { name: 'Add memory' }).click()
    await expect(page.getByPlaceholder('Enter the memory content...')).toBeVisible({ timeout: 5_000 })

    // Select Kin if picker visible
    const kinPicker = page.locator('[data-slot="select-trigger"]').filter({ hasText: /select a kin/i })
    if (await kinPicker.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await kinPicker.click()
      await page.locator('[data-slot="select-item"]').first().click()
    }

    // Fill content — keep default "Fact" category
    await page.getByPlaceholder('Enter the memory content...').fill('Project deadline is March 15, 2026.')

    // Save
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Memory added').first()).toBeVisible({ timeout: 5_000 })

    // Both memories should be visible
    await expect(page.getByText('The user prefers dark mode for all applications.')).toBeVisible()
    await expect(page.getByText('Project deadline is March 15, 2026.')).toBeVisible()

    // Count should show "2 memories"
    await expect(page.getByText('2 memories')).toBeVisible()
  })

  test('should filter memories by search', async ({ page }) => {
    await openMemoriesSettings(page)

    // Wait for memories to load
    await expect(page.getByText('2 memories')).toBeVisible({ timeout: 5_000 })

    // Search for "dark mode"
    await page.getByPlaceholder('Search memories...').fill('dark mode')

    // Should show only the matching memory
    await expect(page.getByText('The user prefers dark mode for all applications.')).toBeVisible()
    await expect(page.getByText('Project deadline is March 15, 2026.')).not.toBeVisible()
    await expect(page.getByText('1 memories')).toBeVisible()

    // Clear search
    await page.getByPlaceholder('Search memories...').clear()
    await expect(page.getByText('2 memories')).toBeVisible({ timeout: 3_000 })
  })

  test('should filter memories by category', async ({ page }) => {
    await openMemoriesSettings(page)
    await expect(page.getByText('2 memories')).toBeVisible({ timeout: 5_000 })

    // Open category filter (the first Select trigger that shows "All categories")
    const categoryFilter = page.locator('[data-slot="select-trigger"]').filter({ hasText: 'All categories' })
    await categoryFilter.click()
    await page.locator('[data-slot="select-item"]').filter({ hasText: 'Preference' }).click()

    // Should show only Preference memories
    await expect(page.getByText('The user prefers dark mode for all applications.')).toBeVisible()
    await expect(page.getByText('Project deadline is March 15, 2026.')).not.toBeVisible()
    await expect(page.getByText('1 memories')).toBeVisible()

    // Reset to "All categories"
    await page.locator('[data-slot="select-trigger"]').filter({ hasText: 'Preference' }).click()
    await page.locator('[data-slot="select-item"]').filter({ hasText: 'All categories' }).click()
    await expect(page.getByText('2 memories')).toBeVisible({ timeout: 3_000 })
  })

  test('should edit a memory', async ({ page }) => {
    await openMemoriesSettings(page)
    await expect(page.getByText('2 memories')).toBeVisible({ timeout: 5_000 })

    // Click edit on the first memory card (pencil icon)
    const firstCard = page.locator('.surface-card').filter({ hasText: 'dark mode' })
    await firstCard.locator('button:has(.lucide-pencil)').click()

    // Edit dialog should open with "Edit memory" title
    await expect(page.getByRole('dialog').filter({ hasText: 'Edit memory' })).toBeVisible({ timeout: 5_000 })

    // Content should be pre-filled
    const contentField = page.getByPlaceholder('Enter the memory content...')
    await expect(contentField).toHaveValue('The user prefers dark mode for all applications.')

    // Modify content
    await contentField.clear()
    await contentField.fill('The user strongly prefers dark mode in all apps and websites.')

    // Save
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Memory updated').first()).toBeVisible({ timeout: 5_000 })

    // Updated content should be visible
    await expect(page.getByText('The user strongly prefers dark mode in all apps and websites.')).toBeVisible({ timeout: 5_000 })
  })

  test('should delete a memory with confirmation', async ({ page }) => {
    await openMemoriesSettings(page)
    await expect(page.getByText('2 memories')).toBeVisible({ timeout: 5_000 })

    // Click delete on the deadline memory card (trash icon)
    const deadlineCard = page.locator('.surface-card').filter({ hasText: 'deadline' })
    await deadlineCard.locator('button:has(.lucide-trash-2)').click()

    // AlertDialog confirmation should appear
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 3_000 })
    await expect(page.getByText('This will permanently delete this memory.')).toBeVisible()

    // Confirm deletion
    await page.getByRole('alertdialog').getByRole('button', { name: /delete/i }).click()

    // Should show 1 memory now (toast may auto-dismiss, so check state instead)
    await expect(page.getByText('1 memories')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Project deadline is March 15, 2026.')).not.toBeVisible()
  })

  test('should delete the last memory and show empty state', async ({ page }) => {
    await openMemoriesSettings(page)
    await expect(page.getByText('1 memories')).toBeVisible({ timeout: 10_000 })

    // Delete the remaining memory
    const card = page.locator('.surface-card').filter({ hasText: 'dark mode' })
    await card.locator('button:has(.lucide-trash-2)').click()

    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 3_000 })
    await page.getByRole('alertdialog').getByRole('button', { name: /delete/i }).click()

    // Empty state should return
    await expect(page.getByText('No memories yet')).toBeVisible({ timeout: 10_000 })
  })
})
