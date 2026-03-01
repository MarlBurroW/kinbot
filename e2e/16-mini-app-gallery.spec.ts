import { test, expect, type Page } from '@playwright/test'
import { loginAs } from './helpers/auth'

// ─── Mock data ──────────────────────────────────────────────────────────────

const MOCK_GALLERY_APPS = [
  {
    id: 'app-1',
    kinId: 'kin-other-1',
    kinName: 'Weather Bot',
    kinAvatarUrl: null,
    name: 'Weather Dashboard',
    slug: 'weather-dashboard',
    description: 'Real-time weather forecast widget',
    icon: '🌤️',
    entryFile: 'index.html',
    hasBackend: true,
    isActive: true,
    version: 3,
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now(),
  },
  {
    id: 'app-2',
    kinId: 'kin-other-2',
    kinName: 'Productivity Kin',
    kinAvatarUrl: null,
    name: 'Todo Tracker',
    slug: 'todo-tracker',
    description: 'Simple task management app',
    icon: '✅',
    entryFile: 'index.html',
    hasBackend: false,
    isActive: true,
    version: 1,
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: 'app-3',
    kinId: 'kin-other-3',
    kinName: 'Focus Kin',
    kinAvatarUrl: null,
    name: 'Pomodoro Timer',
    slug: 'pomodoro-timer',
    description: 'Focus timer with break reminders',
    icon: '🍅',
    entryFile: 'index.html',
    hasBackend: false,
    isActive: true,
    version: 2,
    createdAt: Date.now() - 259200000,
    updatedAt: Date.now() - 172800000,
  },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

async function mockGalleryApis(page: Page, apps = MOCK_GALLERY_APPS) {
  await page.route('**/api/mini-apps/gallery/browse', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ apps }),
      })
    }
    return route.continue()
  })

  await page.route('**/api/mini-apps/*/clone', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          app: {
            ...apps[0],
            id: 'cloned-app-1',
            kinId: 'target-kin',
          },
        }),
      })
    }
    return route.continue()
  })
}

async function mockGalleryEmpty(page: Page) {
  await page.route('**/api/mini-apps/gallery/browse', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ apps: [] }),
      })
    }
    return route.continue()
  })
}

async function mockGalleryError(page: Page) {
  await page.route('**/api/mini-apps/gallery/browse', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      })
    }
    return route.continue()
  })
}

async function openGallery(page: Page) {
  // The gallery button is the Store icon next to "Mini-Apps" section header
  const galleryButton = page.locator('button[title="App Gallery"]')
  await galleryButton.waitFor({ state: 'visible', timeout: 5000 })
  await galleryButton.click()
  // Wait for dialog to appear
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test.describe.serial('Mini App Gallery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await loginAs(page)
    await page.waitForSelector('[data-sidebar="sidebar"]', { timeout: 10000 })
  })

  test('should open gallery dialog from sidebar button', async ({ page }) => {
    await mockGalleryApis(page)
    await openGallery(page)

    // Verify dialog title and description
    await expect(page.getByRole('heading', { name: 'App Gallery' })).toBeVisible()
    await expect(page.getByText('Browse and clone mini-apps from other Kins.')).toBeVisible()
  })

  test('should display gallery apps with correct details', async ({ page }) => {
    await mockGalleryApis(page)
    await openGallery(page)

    // Wait for apps to load (spinner disappears)
    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(300)

    // Verify all 3 apps appear
    await expect(page.getByText('Weather Dashboard')).toBeVisible()
    await expect(page.getByText('Todo Tracker')).toBeVisible()
    await expect(page.getByText('Pomodoro Timer')).toBeVisible()

    // Verify descriptions
    await expect(page.getByText('Real-time weather forecast widget')).toBeVisible()
    await expect(page.getByText('Simple task management app')).toBeVisible()

    // Verify kin names
    await expect(page.getByText('Weather Bot')).toBeVisible()
    await expect(page.getByText('Productivity Kin')).toBeVisible()
    await expect(page.getByText('Focus Kin')).toBeVisible()

    // Verify version numbers
    await expect(page.getByText('v3')).toBeVisible()
    await expect(page.getByText('v1')).toBeVisible()

    // Verify API badge on Weather Dashboard (hasBackend: true)
    await expect(page.getByText('API', { exact: true })).toBeVisible()
  })

  test('should show empty state when no apps exist', async ({ page }) => {
    await mockGalleryEmpty(page)
    await openGallery(page)

    // Wait for loading to finish
    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(300)

    await expect(page.getByText('No apps available yet')).toBeVisible()
  })

  test('should filter apps by search query', async ({ page }) => {
    await mockGalleryApis(page)
    await openGallery(page)

    // Wait for apps to load
    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(300)

    // Search for "weather"
    const searchInput = page.getByPlaceholder('Search apps...')
    await searchInput.fill('weather')
    await page.waitForTimeout(200)

    // Only Weather Dashboard should be visible
    await expect(page.getByText('Weather Dashboard')).toBeVisible()
    await expect(page.getByText('Todo Tracker')).not.toBeVisible()
    await expect(page.getByText('Pomodoro Timer')).not.toBeVisible()
  })

  test('should filter apps by description text', async ({ page }) => {
    await mockGalleryApis(page)
    await openGallery(page)

    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(300)

    const searchInput = page.getByPlaceholder('Search apps...')
    await searchInput.fill('task management')
    await page.waitForTimeout(200)

    await expect(page.getByText('Todo Tracker')).toBeVisible()
    await expect(page.getByText('Weather Dashboard')).not.toBeVisible()
    await expect(page.getByText('Pomodoro Timer')).not.toBeVisible()
  })

  test('should filter apps by kin name', async ({ page }) => {
    await mockGalleryApis(page)
    await openGallery(page)

    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(300)

    const searchInput = page.getByPlaceholder('Search apps...')
    await searchInput.fill('Productivity')
    await page.waitForTimeout(200)

    await expect(page.getByText('Todo Tracker')).toBeVisible()
    await expect(page.getByText('Weather Dashboard')).not.toBeVisible()
  })

  test('should show no results message for unmatched search', async ({ page }) => {
    await mockGalleryApis(page)
    await openGallery(page)

    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(300)

    const searchInput = page.getByPlaceholder('Search apps...')
    await searchInput.fill('xyznonexistent')
    await page.waitForTimeout(200)

    await expect(page.getByText('No apps match your search')).toBeVisible()
  })

  test('should clear search and show all apps again', async ({ page }) => {
    await mockGalleryApis(page)
    await openGallery(page)

    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(300)

    const searchInput = page.getByPlaceholder('Search apps...')

    // Filter first
    await searchInput.fill('weather')
    await page.waitForTimeout(200)
    await expect(page.getByText('Todo Tracker')).not.toBeVisible()

    // Clear search
    await searchInput.clear()
    await page.waitForTimeout(200)

    // All apps should be visible again
    await expect(page.getByText('Weather Dashboard')).toBeVisible()
    await expect(page.getByText('Todo Tracker')).toBeVisible()
    await expect(page.getByText('Pomodoro Timer')).toBeVisible()
  })

  test('should have clone buttons for each app', async ({ page }) => {
    await mockGalleryApis(page)
    await openGallery(page)

    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(300)

    // Each app should have a Clone button
    const cloneButtons = page.getByRole('button', { name: 'Clone' })
    expect(await cloneButtons.count()).toBe(3)
  })

  test('should have a Kin selector for clone target', async ({ page }) => {
    await mockGalleryApis(page)
    await openGallery(page)

    // The KinSelector should be present with "Clone to..." placeholder
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog.locator('[data-slot="select-trigger"]').first()).toBeVisible()
  })

  test('should handle gallery fetch error gracefully', async ({ page }) => {
    await mockGalleryError(page)
    await openGallery(page)

    // Wait for loading to complete
    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(500)

    // Should show error toast
    await expect(page.getByText('Failed to load gallery')).toBeVisible({ timeout: 5000 })
  })

  test('should close gallery dialog', async ({ page }) => {
    await mockGalleryApis(page)
    await openGallery(page)

    await expect(page.getByRole('heading', { name: 'App Gallery' })).toBeVisible()

    // Close dialog via close button (X)
    const closeButton = page.locator('[role="dialog"] button:has(.lucide-x)').first()
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click()
    } else {
      // Fallback: press Escape
      await page.keyboard.press('Escape')
    }

    await expect(page.getByRole('heading', { name: 'App Gallery' })).not.toBeVisible({ timeout: 3000 })
  })

  test('should show Mini-Apps empty state in sidebar when no apps exist', async ({ page }) => {
    // Verify the sidebar shows the empty state for mini-apps
    const miniAppsSection = page.getByText('Mini-Apps')
    await expect(miniAppsSection).toBeVisible()

    // Check for the empty state text
    await expect(page.getByText('No apps yet')).toBeVisible()
    await expect(page.getByText('Ask a Kin to create one')).toBeVisible()
  })
})
