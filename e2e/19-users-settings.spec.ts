import { test, expect, type Page } from '@playwright/test'
import { loginAs, TEST_USER } from './helpers/auth'

/** Open settings dialog and navigate to Users section */
async function openUsersSettings(page: Page) {
  await page.locator('button:has(.lucide-settings-2)').click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
  await page.getByRole('dialog').getByText('Users', { exact: true }).click()
  await expect(page.getByText('Manage platform users and send invitations.')).toBeVisible({ timeout: 5_000 })
}

/** Delete all existing invitations via API so tests start clean */
async function clearInvitations(page: Page) {
  const res = await page.request.get('/api/invitations')
  const data = await res.json() as { invitations: { id: string }[] }
  for (const inv of data.invitations) {
    await page.request.delete(`/api/invitations/${inv.id}`)
  }
}

test.describe.serial('Users settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await loginAs(page)
    await expect(page.locator('button:has(.lucide-settings-2)')).toBeVisible({ timeout: 10_000 })
  })

  test('should navigate to Users settings and see current user', async ({ page }) => {
    await clearInvitations(page)
    await openUsersSettings(page)

    // Current user from onboarding should be visible
    await expect(page.getByText(`${TEST_USER.firstName} ${TEST_USER.lastName}`)).toBeVisible()
    await expect(page.getByText(`@${TEST_USER.pseudonym}`)).toBeVisible()
    // "you" badge should be visible for the current user
    await expect(page.getByText('you', { exact: true })).toBeVisible()
  })

  test('should not show delete button for current user', async ({ page }) => {
    await openUsersSettings(page)

    // The user card for the current user should NOT have a delete button
    const userCard = page.locator('.rounded-xl.border.bg-card').filter({ hasText: TEST_USER.firstName })
    await expect(userCard).toBeVisible()
    await expect(userCard.locator('button:has(.lucide-trash-2)')).not.toBeVisible()
  })

  test('should see empty invitations section', async ({ page }) => {
    await openUsersSettings(page)

    await expect(page.getByRole('heading', { name: 'Invitations' })).toBeVisible()
    await expect(page.getByText('No invitations')).toBeVisible()
  })

  test('should open create invitation dialog', async ({ page }) => {
    await openUsersSettings(page)

    await page.getByRole('button', { name: /invite/i }).click()
    await expect(page.locator('[role="dialog"]').last().getByRole('heading', { name: 'Invite' })).toBeVisible({ timeout: 5_000 })

    // Check form fields
    await expect(page.getByText('Label')).toBeVisible()
    await expect(page.getByPlaceholder(/for mom|for coworker/i)).toBeVisible()
    await expect(page.getByText('Expires in (days)')).toBeVisible()

    // Cancel
    await page.getByRole('button', { name: /cancel/i }).click()
  })

  test('should create an invitation and see revealed link', async ({ page }) => {
    await openUsersSettings(page)

    await page.getByRole('button', { name: /invite/i }).click()
    await expect(page.getByPlaceholder(/for mom|for coworker/i)).toBeVisible({ timeout: 5_000 })

    // Fill label
    await page.getByPlaceholder(/for mom|for coworker/i).fill('For E2E Friend')

    // Submit — click the Invite button inside the dialog (not the page-level one)
    const dialog = page.locator('[role="dialog"]').last()
    await dialog.getByRole('button', { name: /invite/i }).last().click()

    // Toast
    await expect(page.getByText('Invitation created').first()).toBeVisible({ timeout: 5_000 })

    // Revealed link dialog should appear
    await expect(page.getByText('Copy link')).toBeVisible({ timeout: 5_000 })

    // Should show an input with the invitation URL
    const linkInput = page.locator('[role="dialog"]').last().locator('input[readonly]')
    await expect(linkInput).toBeVisible()
    const linkValue = await linkInput.inputValue()
    expect(linkValue).toContain('/invite/')

    // Close the revealed link dialog (use first() to avoid strict mode with X close + text Close)
    await page.locator('[role="dialog"]').last().getByRole('button', { name: /close/i }).first().click()
  })

  test('should see created invitation in the list with active status', async ({ page }) => {
    await openUsersSettings(page)

    // The invitation should appear with the label
    await expect(page.getByText('For E2E Friend')).toBeVisible()
    // Should have Active badge
    await expect(page.getByText('Active', { exact: true })).toBeVisible()
  })

  test('should create a second invitation without label', async ({ page }) => {
    await openUsersSettings(page)

    await page.getByRole('button', { name: /invite/i }).click()
    await expect(page.getByPlaceholder(/for mom|for coworker/i)).toBeVisible({ timeout: 5_000 })

    // Don't fill label — submit directly
    const dialog = page.locator('[role="dialog"]').last()
    await dialog.getByRole('button', { name: /invite/i }).last().click()

    await expect(page.getByRole('heading', { name: 'Invitation created' })).toBeVisible({ timeout: 5_000 })

    // Close revealed link dialog
    await page.locator('[role="dialog"]').last().getByRole('button', { name: /close/i }).first().click()
  })

  test('should revoke an invitation with confirmation', async ({ page }) => {
    await openUsersSettings(page)

    // Find the "For E2E Friend" invitation card and click the revoke button (XCircle icon)
    const invCard = page.locator('.rounded-xl.border.bg-card').filter({ hasText: 'For E2E Friend' })
    await expect(invCard).toBeVisible()
    await invCard.locator('button:has(.lucide-circle-x)').click()

    // AlertDialog confirmation
    await expect(page.locator('[role="alertdialog"]')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('This will invalidate the invitation link')).toBeVisible()
    await page.locator('[role="alertdialog"]').getByRole('button', { name: /revoke/i }).click()

    // Toast
    await expect(page.getByText('Invitation revoked')).toBeVisible({ timeout: 5_000 })
  })

  test('should clean up remaining invitations', async ({ page }) => {
    await clearInvitations(page)
    await openUsersSettings(page)

    await expect(page.getByText('No invitations')).toBeVisible()
  })
})
