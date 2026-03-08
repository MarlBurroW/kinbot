import { test, expect, type Page } from '@playwright/test'
import { loginAs, mockProviderModels } from './helpers/auth'

/**
 * Get the current theme class applied to <html> element.
 */
async function getHtmlThemeClass(page: Page): Promise<string> {
  return page.evaluate(() => document.documentElement.classList.contains('dark') ? 'dark' : 'light')
}

/**
 * Open the theme toggle dropdown (Sun/Moon icon button in the header).
 */
async function openThemeDropdown(page: Page) {
  const themeBtn = page.locator('header button:has(.lucide-sun), header button:has(.lucide-moon)').first()
  await expect(themeBtn).toBeVisible({ timeout: 5_000 })
  await themeBtn.click()
  // Wait for the dropdown menu to appear
  await expect(page.getByRole('menuitem').first()).toBeVisible({ timeout: 3_000 })
}

test.describe('Theme and appearance', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await mockProviderModels(page)
    await page.goto('/')
    // Handle both fresh login and already-authenticated states
    const signIn = page.getByRole('button', { name: 'Sign in' })
    const kins = page.getByText('Kins', { exact: true })
    await expect(signIn.or(kins)).toBeVisible({ timeout: 10_000 })
    if (await signIn.isVisible().catch(() => false)) {
      await loginAs(page)
    }
    await expect(kins).toBeVisible({ timeout: 10_000 })
  })

  test('should display theme toggle button in header', async ({ page }) => {
    const themeBtn = page.locator('header button:has(.lucide-sun), header button:has(.lucide-moon)')
    await expect(themeBtn.first()).toBeVisible({ timeout: 5_000 })
  })

  test('should open theme dropdown with light, dark, system options', async ({ page }) => {
    await openThemeDropdown(page)

    await expect(page.getByRole('menuitem', { name: /light/i })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /dark/i })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /system/i })).toBeVisible()
  })

  test('should show reduce contrast option in theme dropdown', async ({ page }) => {
    await openThemeDropdown(page)

    await expect(page.getByRole('menuitem', { name: /reduce contrast/i })).toBeVisible()
  })

  test('should switch to dark theme', async ({ page }) => {
    await openThemeDropdown(page)
    await page.getByRole('menuitem', { name: /dark/i }).click()

    // HTML element should have 'dark' class
    const theme = await getHtmlThemeClass(page)
    expect(theme).toBe('dark')

    // Theme button should now show moon icon
    await expect(page.locator('header button:has(.lucide-moon)').first()).toBeVisible()
  })

  test('should switch to light theme', async ({ page }) => {
    // First ensure we're in dark mode
    await openThemeDropdown(page)
    await page.getByRole('menuitem', { name: /dark/i }).click()
    await expect(page.locator('header button:has(.lucide-moon)').first()).toBeVisible()

    // Wait for dropdown to fully close before reopening
    await expect(page.getByRole('menuitem').first()).not.toBeVisible({ timeout: 3_000 })

    // Now switch to light
    await openThemeDropdown(page)
    await page.getByRole('menuitem', { name: /light/i }).click()

    const theme = await getHtmlThemeClass(page)
    expect(theme).toBe('light')

    // Theme button should now show sun icon
    await expect(page.locator('header button:has(.lucide-sun)').first()).toBeVisible()
  })

  test('should toggle theme via command palette', async ({ page }) => {
    // Get initial theme
    const initialTheme = await getHtmlThemeClass(page)

    // Open command palette with Ctrl+K
    await page.keyboard.press('Control+k')
    await expect(page.getByPlaceholder('Type a command or search...')).toBeVisible({ timeout: 5_000 })

    // Click "Toggle dark/light theme"
    await page.getByText('Toggle dark/light theme').click()

    // Theme should have changed
    const newTheme = await getHtmlThemeClass(page)
    expect(newTheme).not.toBe(initialTheme)
  })

  test('should persist theme after page reload', async ({ page }) => {
    // Switch to dark mode
    await openThemeDropdown(page)
    await page.getByRole('menuitem', { name: /dark/i }).click()
    await expect(page.locator('header button:has(.lucide-moon)').first()).toBeVisible()

    // Reload page
    await page.reload()
    await expect(page.getByText('Kins', { exact: true })).toBeVisible({ timeout: 10_000 })

    // Should still be dark
    const theme = await getHtmlThemeClass(page)
    expect(theme).toBe('dark')
  })

  test('should toggle reduce contrast mode', async ({ page }) => {
    // Get initial contrast state
    const initialContrast = await page.evaluate(() =>
      document.documentElement.getAttribute('data-contrast')
    )

    await openThemeDropdown(page)
    await page.getByRole('menuitem', { name: /reduce contrast/i }).click()

    // Wait for the attribute to update
    await page.waitForTimeout(500)

    // Contrast attribute should have toggled
    const newContrast = await page.evaluate(() =>
      document.documentElement.getAttribute('data-contrast')
    )
    expect(newContrast).not.toBe(initialContrast)
  })

  test('should close theme dropdown with Escape', async ({ page }) => {
    await openThemeDropdown(page)
    await page.keyboard.press('Escape')

    // Dropdown should be closed
    await expect(page.getByRole('menuitem', { name: /light/i })).not.toBeVisible({ timeout: 2_000 })
  })

  test('should restore light theme for subsequent tests', async ({ page }) => {
    await openThemeDropdown(page)
    await page.getByRole('menuitem', { name: /light/i }).click()

    const theme = await getHtmlThemeClass(page)
    expect(theme).toBe('light')
  })
})
