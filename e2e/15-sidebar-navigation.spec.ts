import { test, expect, type Page } from '@playwright/test'
import { loginAs, mockProviderModels } from './helpers/auth'

/**
 * Sidebar navigation & layout tests.
 *
 * Covers:
 * - Sidebar structure (logo, sections, footer)
 * - Collapsible sections (Mini Apps, Tasks, Cron Jobs)
 * - Kins section with create button
 * - Footer elements (version badge, keyboard shortcuts, settings button)
 * - Responsive behavior (mobile viewport)
 */

test.describe.serial('Sidebar navigation & layout', () => {
  test.beforeEach(async ({ page }) => {
    await mockProviderModels(page)
    await page.goto('/')
    await expect(page.getByText('Sign in to your KinBot workspace')).toBeVisible({ timeout: 10_000 })
    await loginAs(page)
    await expect(page.getByText('Kins', { exact: true })).toBeVisible({ timeout: 10_000 })
  })

  test('should display KinBot logo in sidebar header', async ({ page }) => {
    const sidebar = page.locator('[data-slot="sidebar"]')
    await expect(sidebar).toBeVisible()

    // Logo image and text
    await expect(sidebar.locator('img[src*="kinbot"]')).toBeVisible()
    await expect(sidebar.getByText('KinBot')).toBeVisible()
  })

  test('should display Kins section with create button', async ({ page }) => {
    const sidebar = page.locator('[data-slot="sidebar"]')

    // Kins group label
    await expect(sidebar.getByText('Kins', { exact: true })).toBeVisible()

    // Create Kin button (Plus icon)
    const createButton = sidebar.locator('button:has(.lucide-plus)').first()
    await expect(createButton).toBeVisible()
  })

  test('should show Kin created during onboarding', async ({ page }) => {
    const sidebar = page.locator('[data-slot="sidebar"]')

    // Onboarding creates a default Kin — "Test Assistant" should appear in the sidebar
    await expect(sidebar.getByText('Test Assistant')).toBeVisible({ timeout: 5_000 })
  })

  test('should display Mini Apps section and toggle collapse', async ({ page }) => {
    const sidebar = page.locator('[data-slot="sidebar"]')

    // Mini-Apps section title
    const miniAppsToggle = sidebar.getByRole('button', { name: 'Mini-Apps' })
    await expect(miniAppsToggle).toBeVisible()

    // Click to collapse
    await miniAppsToggle.click()
    await page.waitForTimeout(300)

    // Click to expand again
    await miniAppsToggle.click()
    await page.waitForTimeout(300)

    // Section should still be visible
    await expect(miniAppsToggle).toBeVisible()
  })

  test('should display Mini Apps gallery button', async ({ page }) => {
    const sidebar = page.locator('[data-slot="sidebar"]')

    // Gallery button near Mini-Apps
    const galleryButton = sidebar.getByRole('button', { name: 'App Gallery' })
    await expect(galleryButton).toBeVisible()

    // Click should open gallery dialog
    await galleryButton.click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })

    // Close it
    const closeButton = page.getByRole('dialog').locator('button:has(.lucide-x)').first()
    if (await closeButton.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await closeButton.click()
    } else {
      await page.keyboard.press('Escape')
    }
  })

  test('should display Tasks section and toggle collapse', async ({ page }) => {
    const sidebar = page.locator('[data-slot="sidebar"]')

    // Tasks section
    const tasksToggle = sidebar.getByRole('button', { name: 'Tasks' })
    await expect(tasksToggle).toBeVisible()

    // Should show empty state or task list
    // Click to collapse
    await tasksToggle.click()
    await page.waitForTimeout(300)

    // Click to expand
    await tasksToggle.click()
    await page.waitForTimeout(300)

    await expect(tasksToggle).toBeVisible()
  })

  test('should display Cron Jobs section and toggle collapse', async ({ page }) => {
    const sidebar = page.locator('[data-slot="sidebar"]')

    // Scheduled Jobs section
    const cronToggle = sidebar.getByRole('button', { name: 'Scheduled Jobs' })
    await expect(cronToggle).toBeVisible()

    // Toggle collapse
    await cronToggle.click()
    await page.waitForTimeout(300)
    await cronToggle.click()
    await page.waitForTimeout(300)

    await expect(cronToggle).toBeVisible()
  })

  test('should display footer with version badge', async ({ page }) => {
    const sidebar = page.locator('[data-slot="sidebar"]')

    // Version badge (e.g. "v1.2.3")
    const versionBadge = sidebar.getByText(/^v\d+\.\d+/)
    await expect(versionBadge).toBeVisible({ timeout: 5_000 })
  })

  test('should open What\'s New dialog from version badge', async ({ page }) => {
    const sidebar = page.locator('[data-slot="sidebar"]')

    const versionBadge = sidebar.getByText(/^v\d+\.\d+/)
    await expect(versionBadge).toBeVisible({ timeout: 5_000 })
    await versionBadge.click()

    // What's New dialog
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })

    // Close
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 })
  })

  test('should have settings button in footer that opens settings dialog', async ({ page }) => {
    const sidebar = page.locator('[data-slot="sidebar"]')

    // Settings button (Settings2 icon = lucide-settings-2)
    const settingsButton = sidebar.locator('button:has(.lucide-settings-2)')
    await expect(settingsButton).toBeVisible()
    await settingsButton.click()

    // Settings dialog opens
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByRole('dialog').getByRole('button', { name: 'General' })).toBeVisible()

    // Close
    await page.getByRole('button', { name: 'Close' }).click()
  })

  test('should have keyboard shortcut hints in footer', async ({ page }) => {
    const sidebar = page.locator('[data-slot="sidebar"]')

    // Command palette shortcut (⌘K or Ctrl+K)
    const cmdK = sidebar.getByText('K', { exact: true })
    await expect(cmdK).toBeVisible()

    // Keyboard icon for shortcuts
    const kbButton = sidebar.locator('button:has(.lucide-keyboard)')
    await expect(kbButton).toBeVisible()
  })

  test('should navigate to home when clicking KinBot logo', async ({ page }) => {
    const sidebar = page.locator('[data-slot="sidebar"]')

    // Open settings first to move away from default view
    await sidebar.locator('button:has(.lucide-settings-2)').click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
    await page.getByRole('button', { name: 'Close' }).click()

    // Click logo — should navigate to /
    const logoButton = sidebar.locator('button').filter({ hasText: 'KinBot' }).first()
    await logoButton.click()

    // Should remain on main page with Kins visible
    await expect(sidebar.getByText('Kins', { exact: true })).toBeVisible()
  })
})

test.describe('Sidebar responsive behavior', () => {
  test('should hide sidebar on mobile viewport and show toggle', async ({ page }) => {
    await mockProviderModels(page)

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    await page.goto('/')
    await expect(page.getByText('Sign in to your KinBot workspace')).toBeVisible({ timeout: 10_000 })
    await loginAs(page)

    // On mobile, wait for the toggle sidebar button (sidebar is hidden by default)
    const sidebarTrigger = page.getByRole('button', { name: 'Toggle Sidebar' })
    await expect(sidebarTrigger).toBeVisible({ timeout: 10_000 })

    // Sidebar should not be visible initially
    const sidebar = page.locator('[data-slot="sidebar"]')

    // Click trigger to open sidebar
    await sidebarTrigger.click()
    await expect(sidebar.getByText('Kins', { exact: true })).toBeVisible({ timeout: 5_000 })
  })

  test('should show full sidebar on desktop viewport', async ({ page }) => {
    await mockProviderModels(page)

    // Desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 })

    await page.goto('/')
    await expect(page.getByText('Sign in to your KinBot workspace')).toBeVisible({ timeout: 10_000 })
    await loginAs(page)

    // Wait for app to load — sidebar should be directly visible on desktop
    const sidebar = page.locator('[data-slot="sidebar"]')
    await expect(sidebar.getByText('Kins', { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(sidebar.getByText('KinBot')).toBeVisible()
  })
})
