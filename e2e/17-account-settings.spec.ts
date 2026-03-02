import { test, expect, type Page } from '@playwright/test'
import { loginAs, TEST_USER } from './helpers/auth'

/**
 * Open the user menu dropdown and click "My account" to open the Account dialog.
 * The user menu trigger is a button with the user's initials (e.g. "TU") in the top bar.
 */
async function openAccountDialog(page: Page) {
  // The user menu trigger is a small round button containing an Avatar with initials
  const userMenuTrigger = page.locator('button:has([data-slot="avatar-fallback"])').last()
  await userMenuTrigger.click()

  // Click "My account" in the dropdown menu
  await page.getByRole('menuitem', { name: /account/i }).click()

  // Wait for the dialog to appear
  await page.getByRole('dialog').waitFor({ state: 'visible' })
}

test.describe('Account Settings', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible({ timeout: 10_000 })
    await loginAs(page)
    await expect(page.getByText('Kins', { exact: true })).toBeVisible({ timeout: 10_000 })

    // Reset user profile to known state (handles dirty state from retries)
    await page.request.patch('/api/me', {
      data: {
        firstName: TEST_USER.firstName,
        lastName: TEST_USER.lastName,
        pseudonym: TEST_USER.pseudonym,
      },
    })
  })

  test('should open account dialog from user menu', async ({ page }) => {
    await openAccountDialog(page)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Should display user name and email
    await expect(dialog.getByText(`${TEST_USER.firstName} ${TEST_USER.lastName}`)).toBeVisible()
    await expect(dialog.getByText(TEST_USER.email)).toBeVisible()

    // Should show Admin badge (first user is admin)
    await expect(dialog.getByText('Admin')).toBeVisible()
  })

  test('should display form fields with current values', async ({ page }) => {
    await openAccountDialog(page)
    const dialog = page.getByRole('dialog')

    await expect(dialog.locator('#acctFirstName')).toHaveValue(TEST_USER.firstName)
    await expect(dialog.locator('#acctLastName')).toHaveValue(TEST_USER.lastName)
    await expect(dialog.locator('#acctPseudonym')).toHaveValue(TEST_USER.pseudonym)
  })

  test('should edit first name and save', async ({ page }) => {
    await openAccountDialog(page)
    const dialog = page.getByRole('dialog')

    const firstNameInput = dialog.locator('#acctFirstName')
    await firstNameInput.clear()
    await firstNameInput.fill('Updated')

    await dialog.getByRole('button', { name: /save/i }).click()

    // Wait for the name to update in the hero section (confirms save succeeded)
    await expect(dialog.getByText('Updated User')).toBeVisible({ timeout: 5000 })
  })

  test('should persist changes after reopening', async ({ page }) => {
    await openAccountDialog(page)
    const dialog = page.getByRole('dialog')

    // Should show the updated name from previous test
    await expect(dialog.locator('#acctFirstName')).toHaveValue('Updated')

    // Restore original name
    const firstNameInput = dialog.locator('#acctFirstName')
    await firstNameInput.clear()
    await firstNameInput.fill(TEST_USER.firstName)
    await dialog.getByRole('button', { name: /save/i }).click()
    // Wait for save to complete — hero name reverts to original
    await expect(dialog.getByText(`${TEST_USER.firstName} ${TEST_USER.lastName}`)).toBeVisible({ timeout: 5000 })
  })

  test('should edit pseudonym', async ({ page }) => {
    await openAccountDialog(page)
    const dialog = page.getByRole('dialog')

    const pseudonymInput = dialog.locator('#acctPseudonym')
    await pseudonymInput.clear()
    await pseudonymInput.fill('NewPseudo')
    await dialog.getByRole('button', { name: /save/i }).click()
    // Wait for save to complete
    await expect(page.locator('[data-sonner-toast]').first()).toBeVisible({ timeout: 5000 })

    // Close and reopen to verify persistence
    await dialog.getByRole('button', { name: /cancel/i }).click()
    await expect(dialog).not.toBeVisible()

    await openAccountDialog(page)
    await expect(page.getByRole('dialog').locator('#acctPseudonym')).toHaveValue('NewPseudo')

    // Restore original
    const restoreInput = page.getByRole('dialog').locator('#acctPseudonym')
    await restoreInput.clear()
    await restoreInput.fill(TEST_USER.pseudonym)
    await page.getByRole('dialog').getByRole('button', { name: /save/i }).click()
    await expect(page.locator('[data-sonner-toast]').first()).toBeVisible({ timeout: 5000 })
  })

  test('should close dialog via Cancel button', async ({ page }) => {
    await openAccountDialog(page)
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: /cancel/i }).click()
    await expect(dialog).not.toBeVisible()
  })

  test('should reset form when reopening after cancel', async ({ page }) => {
    await openAccountDialog(page)
    const dialog = page.getByRole('dialog')

    // Edit first name but don't save
    const firstNameInput = dialog.locator('#acctFirstName')
    await firstNameInput.clear()
    await firstNameInput.fill('Temporary')

    // Cancel
    await dialog.getByRole('button', { name: /cancel/i }).click()
    await expect(dialog).not.toBeVisible()

    // Reopen — should show original value
    await openAccountDialog(page)
    await expect(page.getByRole('dialog').locator('#acctFirstName')).toHaveValue(TEST_USER.firstName)
  })

  test('should show avatar with initials fallback', async ({ page }) => {
    await openAccountDialog(page)
    const dialog = page.getByRole('dialog')

    // The avatar area should be visible (either image or initials fallback)
    const avatarButton = dialog.locator('button.group').first()
    await expect(avatarButton).toBeVisible()
  })

  test('should have language selector', async ({ page }) => {
    await openAccountDialog(page)
    const dialog = page.getByRole('dialog')

    // Language label should be present
    await expect(dialog.getByText(/language/i)).toBeVisible()
  })
})
