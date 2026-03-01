import { test, expect, type Page } from '@playwright/test'
import { loginAs, mockProviderModels } from './helpers/auth'

/**
 * Open Settings dialog (defaults to General section).
 */
async function openSettings(page: Page) {
  await page.locator('button:has(.lucide-settings-2)').click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
}

/**
 * Navigate to a specific settings section by clicking its sidebar label.
 */
async function navigateToSection(page: Page, sectionName: string) {
  await page.getByRole('dialog').getByText(sectionName, { exact: true }).click()
}

test.describe.serial('Settings — General & Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await mockProviderModels(page)
    await page.goto('/')
    await loginAs(page)
    // Wait for main UI to load
    await expect(page.locator('button:has(.lucide-settings-2)')).toBeVisible({ timeout: 10_000 })
  })

  test('should open settings dialog on General tab by default', async ({ page }) => {
    await openSettings(page)

    // General section should be visible — check for the description text
    await expect(
      page.getByText('Platform-wide settings that apply to all Kins.')
    ).toBeVisible({ timeout: 5_000 })

    // Should show the global prompt label
    await expect(page.getByText('Global prompt')).toBeVisible()

    // Should show the Save button (disabled by default since no changes)
    const saveButton = page.getByRole('button', { name: /save/i })
    await expect(saveButton).toBeVisible()
    await expect(saveButton).toBeDisabled()
  })

  test('should edit and save the global prompt', async ({ page }) => {
    await openSettings(page)

    // Wait for loading to finish — Save button should appear
    const saveButton = page.getByRole('button', { name: /save/i })
    await expect(saveButton).toBeVisible({ timeout: 5_000 })

    // The MarkdownEditor uses a CodeMirror editor — must type via keyboard (fill() bypasses CM change detection)
    const editor = page.locator('.cm-editor .cm-content')
    await expect(editor).toBeVisible({ timeout: 5_000 })

    // Clear and type new content via keyboard
    await editor.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Backspace')
    await page.keyboard.type('You are a helpful test assistant.')

    // Save button should now be enabled
    await expect(saveButton).toBeEnabled({ timeout: 3_000 })
    await saveButton.click()

    // Should show success toast
    await expect(page.getByText('Global prompt updated').first()).toBeVisible({ timeout: 5_000 })

    // Save button should be disabled again after saving
    await expect(saveButton).toBeDisabled({ timeout: 3_000 })
  })

  test('should persist global prompt after reopening settings', async ({ page }) => {
    // First, set a known prompt value
    await openSettings(page)
    const editor = page.locator('.cm-editor .cm-content')
    await expect(editor).toBeVisible({ timeout: 5_000 })

    await editor.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Backspace')
    await page.keyboard.type('Persistent prompt check')

    const saveButton = page.getByRole('button', { name: /save/i })
    await expect(saveButton).toBeEnabled({ timeout: 3_000 })
    await saveButton.click()
    await expect(saveButton).toBeDisabled({ timeout: 5_000 })

    // Close and reopen settings
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 })

    await openSettings(page)
    const editorAfter = page.locator('.cm-editor .cm-content')
    await expect(editorAfter).toBeVisible({ timeout: 5_000 })

    // Verify the prompt persisted
    await expect(editorAfter).toContainText('Persistent prompt check')
  })

  test('should show token count estimate', async ({ page }) => {
    await openSettings(page)

    // Should display a token count
    await expect(page.getByText(/tokens/i)).toBeVisible({ timeout: 5_000 })
  })

  test('should navigate between settings sections', async ({ page }) => {
    await openSettings(page)

    // Navigate to AI Providers
    await navigateToSection(page, 'AI Providers')
    await expect(page.getByText('Manage your AI provider connections').first()).toBeVisible({ timeout: 5_000 })

    // Navigate to Vault
    await navigateToSection(page, 'Vault')
    await expect(page.getByText('Manage encrypted entries accessible by all Kins.').first()).toBeVisible({ timeout: 5_000 })

    // Navigate to Users
    await navigateToSection(page, 'Users')
    await expect(page.getByText('Manage platform users and send invitations.').first()).toBeVisible({ timeout: 5_000 })

    // Navigate back to General
    await navigateToSection(page, 'General')
    await expect(page.getByText('Platform-wide settings that apply to all Kins.').first()).toBeVisible({ timeout: 5_000 })
  })

  test('should display system info in settings footer', async ({ page }) => {
    await openSettings(page)

    // Footer should show KinBot version
    await expect(page.getByText(/kinbot v/i)).toBeVisible({ timeout: 5_000 })
  })

  test('should close settings with Close button', async ({ page }) => {
    await openSettings(page)
    await expect(page.getByRole('dialog')).toBeVisible()

    // Click the Close button (X icon in the dialog)
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 })
  })
})
