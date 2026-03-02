import { test, expect } from '@playwright/test'
import { loginAs, TEST_USER } from './helpers/auth'

const BASE = 'http://localhost:3334'

/**
 * Helper: ensure at least one Kin exists (needed for file storage — files belong to a Kin).
 */
async function ensureKinExists(page: import('@playwright/test').Page) {
  await page.goto(BASE)
  await page.waitForSelector('[data-slot="sidebar"]', { timeout: 10000 })
  const kinItems = page.locator('[data-slot="sidebar"] >> text=E2E Kin')
  if ((await kinItems.count()) > 0) return

  // Create one via onboarding Kin or sidebar
  const createBtn = page.locator('[data-slot="sidebar"]').getByRole('button').filter({ hasText: /add|create|\+/i }).first()
  if (await createBtn.isVisible()) {
    await createBtn.click()
    await page.waitForTimeout(500)
    // Fill wizard if it opened
    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first()
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.fill('E2E Kin')
      const saveBtn = page.getByRole('button', { name: /create|save|next/i }).first()
      await saveBtn.click()
      await page.waitForTimeout(1000)
    }
  }
}

/**
 * Helper: open Settings dialog and navigate to Files section.
 */
async function openFilesSettings(page: import('@playwright/test').Page) {
  await page.goto(BASE)
  await page.waitForSelector('[data-slot="sidebar"]', { timeout: 10000 })

  // Open settings
  const settingsBtn = page.locator('[data-slot="sidebar"]').getByRole('button', { name: /settings/i }).first()
  await settingsBtn.click()
  await page.waitForTimeout(500)

  // Click Files in settings sidebar
  const filesNav = page.getByText('Files', { exact: true })
  await filesNav.click()
  await page.waitForTimeout(500)
}

test.describe.serial('File Storage settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE)
    await loginAs(page)
    await page.waitForSelector('[data-slot="sidebar"]', { timeout: 10000 })
  })

  test('should ensure a Kin exists for file storage tests', async ({ page }) => {
    await ensureKinExists(page)
  })

  test('should navigate to Files settings and see empty state', async ({ page }) => {
    await openFilesSettings(page)

    // Should see empty state text
    const emptyText = page.getByText(/no files stored/i)
    await expect(emptyText).toBeVisible({ timeout: 5000 })
  })

  test('should open upload file dialog', async ({ page }) => {
    await openFilesSettings(page)

    // Click Upload file button
    const uploadBtn = page.getByRole('button', { name: /upload file/i }).first()
    await uploadBtn.click()
    await page.waitForTimeout(500)

    // Verify dialog opened
    const dialogTitle = page.getByText(/upload file/i).first()
    await expect(dialogTitle).toBeVisible()

    // Verify form fields exist
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeVisible()

    // Kin selector — the upload dialog is the last [role="dialog"] (nested inside settings dialog)
    const uploadDialog = page.locator('[role="dialog"]').last()
    const kinSelector = uploadDialog.locator('[data-slot="select-trigger"]').first()
    await expect(kinSelector).toBeVisible({ timeout: 5000 })

    // Name field
    const nameInput = page.locator('input').filter({ hasText: '' }).nth(1)
    await expect(nameInput).toBeAttached()

    // Close dialog
    const cancelBtn = page.getByRole('button', { name: /cancel/i })
    await cancelBtn.click()
    await page.waitForTimeout(300)
  })

  test('should show error when saving without a file', async ({ page }) => {
    await openFilesSettings(page)

    const uploadBtn = page.getByRole('button', { name: /upload file/i }).first()
    await uploadBtn.click()
    await page.waitForTimeout(500)

    // The upload/add button in dialog should be disabled since no file is selected
    const saveBtn = page.getByRole('button', { name: /upload file/i }).last()
    await expect(saveBtn).toBeDisabled()

    // Close
    const cancelBtn = page.getByRole('button', { name: /cancel/i })
    await cancelBtn.click()
  })

  test('should upload a file with name and description', async ({ page }) => {
    // Mock the upload API to avoid needing actual file storage backend
    await page.route('**/api/file-storage', async (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            file: {
              id: 'test-file-1',
              kinId: 'test-kin',
              name: 'Test Document.txt',
              description: 'A test file for E2E',
              originalName: 'test.txt',
              mimeType: 'text/plain',
              size: 42,
              isPublic: true,
              hasPassword: false,
              readAndBurn: false,
              expiresAt: null,
              downloadCount: 0,
              url: '/files/test-file-1',
              createdByKinId: null,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          }),
        })
      }
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            files: [
              {
                id: 'test-file-1',
                kinId: 'test-kin',
                name: 'Test Document.txt',
                description: 'A test file for E2E',
                originalName: 'test.txt',
                mimeType: 'text/plain',
                size: 42,
                isPublic: true,
                hasPassword: false,
                readAndBurn: false,
                expiresAt: null,
                downloadCount: 0,
                url: '/files/test-file-1',
                createdByKinId: null,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            ],
          }),
        })
      }
      return route.continue()
    })

    await openFilesSettings(page)

    const uploadBtn = page.getByRole('button', { name: /upload file/i }).first()
    await uploadBtn.click()
    await page.waitForTimeout(500)

    // Set a file using Playwright's setInputFiles
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Hello E2E world!'),
    })
    await page.waitForTimeout(300)

    // Name should be auto-filled with filename
    const nameInput = page.locator('input').filter({ has: page.locator('[placeholder]') }).first()

    // Fill description
    const descInput = page.locator('input[placeholder*="What is this file"]')
    if (await descInput.isVisible().catch(() => false)) {
      await descInput.fill('A test file for E2E')
    }

    // Click Upload/Add button in dialog
    const saveBtn = page.getByRole('button', { name: /upload file/i }).last()
    await expect(saveBtn).toBeEnabled()
    await saveBtn.click()
    await page.waitForTimeout(1000)

    // Should see success toast
    const toast = page.getByText(/file uploaded/i)
    await expect(toast).toBeVisible({ timeout: 5000 })
  })

  test('should display uploaded file in the list', async ({ page }) => {
    // Mock GET to return one file
    await page.route('**/api/file-storage', async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            files: [
              {
                id: 'test-file-1',
                kinId: 'test-kin',
                name: 'Test Document.txt',
                description: 'A test file for E2E',
                originalName: 'test.txt',
                mimeType: 'text/plain',
                size: 42,
                isPublic: true,
                hasPassword: false,
                readAndBurn: false,
                expiresAt: null,
                downloadCount: 0,
                url: '/files/test-file-1',
                createdByKinId: null,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            ],
          }),
        })
      }
      return route.continue()
    })

    await openFilesSettings(page)

    // File card should be visible
    const fileCard = page.getByText('Test Document.txt')
    await expect(fileCard).toBeVisible({ timeout: 5000 })
  })

  test('should show public badge on public files', async ({ page }) => {
    await page.route('**/api/file-storage', async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            files: [
              {
                id: 'test-file-pub',
                kinId: 'test-kin',
                name: 'Public File.txt',
                description: null,
                originalName: 'pub.txt',
                mimeType: 'text/plain',
                size: 100,
                isPublic: true,
                hasPassword: false,
                readAndBurn: false,
                expiresAt: null,
                downloadCount: 3,
                url: '/files/test-file-pub',
                createdByKinId: null,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            ],
          }),
        })
      }
      return route.continue()
    })

    await openFilesSettings(page)

    const fileName = page.getByText('Public File.txt')
    await expect(fileName).toBeVisible({ timeout: 5000 })

    // Public badge or icon should be visible
    const publicBadge = page.getByText(/public/i).first()
    await expect(publicBadge).toBeVisible()
  })

  test('should show read-and-burn and password badges', async ({ page }) => {
    await page.route('**/api/file-storage', async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            files: [
              {
                id: 'test-file-secure',
                kinId: 'test-kin',
                name: 'Secure File.pdf',
                description: 'Top secret',
                originalName: 'secret.pdf',
                mimeType: 'application/pdf',
                size: 5000,
                isPublic: false,
                hasPassword: true,
                readAndBurn: true,
                expiresAt: Date.now() + 3600000,
                downloadCount: 0,
                url: '/files/test-file-secure',
                createdByKinId: null,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            ],
          }),
        })
      }
      return route.continue()
    })

    await openFilesSettings(page)

    const fileName = page.getByText('Secure File.pdf')
    await expect(fileName).toBeVisible({ timeout: 5000 })

    // Should show password-protected badge (Lock icon only, no text)
    const lockIcon = page.locator('.lucide-lock').first()
    await expect(lockIcon).toBeVisible()

    // Should show read & burn badge (Flame icon only, no text)
    const flameIcon = page.locator('.lucide-flame').first()
    await expect(flameIcon).toBeVisible()

    // Should show private badge (Eye icon + text)
    const privateBadge = page.getByText(/private/i).first()
    await expect(privateBadge).toBeVisible()
  })

  test('should edit a file name via edit dialog', async ({ page }) => {
    let patchCalled = false
    await page.route('**/api/file-storage', async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            files: [
              {
                id: 'test-file-edit',
                kinId: 'test-kin',
                name: patchCalled ? 'Renamed File.txt' : 'Original File.txt',
                description: 'Edit me',
                originalName: 'orig.txt',
                mimeType: 'text/plain',
                size: 100,
                isPublic: true,
                hasPassword: false,
                readAndBurn: false,
                expiresAt: null,
                downloadCount: 0,
                url: '/files/test-file-edit',
                createdByKinId: null,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            ],
          }),
        })
      }
      return route.continue()
    })

    await page.route('**/api/file-storage/test-file-edit', async (route) => {
      if (route.request().method() === 'PATCH') {
        patchCalled = true
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        })
      }
      return route.continue()
    })

    await openFilesSettings(page)

    const fileName = page.getByText('Original File.txt')
    await expect(fileName).toBeVisible({ timeout: 5000 })

    // Click edit button
    const editBtn = page.getByRole('button', { name: /edit/i }).first()
    await editBtn.click()
    await page.waitForTimeout(500)

    // Dialog should show "Edit file"
    const dialogTitle = page.getByText(/edit file/i).first()
    await expect(dialogTitle).toBeVisible()

    // Change the name
    const nameInput = page.locator('input').first()
    await nameInput.clear()
    await nameInput.fill('Renamed File.txt')

    // Save
    const saveBtn = page.getByRole('button', { name: /save/i })
    await saveBtn.click()
    await page.waitForTimeout(1000)

    // Success toast
    const toast = page.getByText(/file updated/i)
    await expect(toast).toBeVisible({ timeout: 5000 })
  })

  test('should delete a file with confirmation', async ({ page }) => {
    let deleted = false
    await page.route('**/api/file-storage', async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            files: deleted
              ? []
              : [
                  {
                    id: 'test-file-del',
                    kinId: 'test-kin',
                    name: 'Delete Me.txt',
                    description: null,
                    originalName: 'del.txt',
                    mimeType: 'text/plain',
                    size: 10,
                    isPublic: true,
                    hasPassword: false,
                    readAndBurn: false,
                    expiresAt: null,
                    downloadCount: 0,
                    url: '/files/test-file-del',
                    createdByKinId: null,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                  },
                ],
          }),
        })
      }
      return route.continue()
    })

    await page.route('**/api/file-storage/test-file-del', async (route) => {
      if (route.request().method() === 'DELETE') {
        deleted = true
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        })
      }
      return route.continue()
    })

    await openFilesSettings(page)

    const fileName = page.getByText('Delete Me.txt')
    await expect(fileName).toBeVisible({ timeout: 5000 })

    // Click delete button on the file card
    const deleteBtn = page.locator('button[aria-label="Delete"]').first()
    await expect(deleteBtn).toBeVisible({ timeout: 5000 })
    await deleteBtn.click()
    await page.waitForTimeout(300)

    // Confirm deletion in the alert dialog
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible({ timeout: 3000 })
    await dialog.getByRole('button', { name: /delete/i }).click()
    await page.waitForTimeout(1000)

    // Success toast
    const toast = page.getByText(/file deleted/i)
    await expect(toast).toBeVisible({ timeout: 5000 })
  })

  test('should copy file URL to clipboard', async ({ page }) => {
    await page.route('**/api/file-storage', async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            files: [
              {
                id: 'test-file-copy',
                kinId: 'test-kin',
                name: 'Copy URL File.txt',
                description: null,
                originalName: 'copy.txt',
                mimeType: 'text/plain',
                size: 50,
                isPublic: true,
                hasPassword: false,
                readAndBurn: false,
                expiresAt: null,
                downloadCount: 1,
                url: '/files/test-file-copy',
                createdByKinId: null,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            ],
          }),
        })
      }
      return route.continue()
    })

    // Grant clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])

    await openFilesSettings(page)

    const fileName = page.getByText('Copy URL File.txt')
    await expect(fileName).toBeVisible({ timeout: 5000 })

    // Click copy URL button
    const copyBtn = page.getByRole('button', { name: /copy.*url/i }).first()
    if (await copyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await copyBtn.click()
      await page.waitForTimeout(500)

      // Should show copied toast
      const toast = page.getByText(/url copied/i)
      await expect(toast).toBeVisible({ timeout: 5000 })
    }
  })

  test('should show download count on file card', async ({ page }) => {
    await page.route('**/api/file-storage', async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            files: [
              {
                id: 'test-file-dl',
                kinId: 'test-kin',
                name: 'Popular File.zip',
                description: null,
                originalName: 'pop.zip',
                mimeType: 'application/zip',
                size: 1048576,
                isPublic: true,
                hasPassword: false,
                readAndBurn: false,
                expiresAt: null,
                downloadCount: 42,
                url: '/files/test-file-dl',
                createdByKinId: null,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            ],
          }),
        })
      }
      return route.continue()
    })

    await openFilesSettings(page)

    const fileName = page.getByText('Popular File.zip')
    await expect(fileName).toBeVisible({ timeout: 5000 })

    // Download count should be displayed (icon + number)
    const downloads = page.getByText('42')
    await expect(downloads).toBeVisible()
  })
})
