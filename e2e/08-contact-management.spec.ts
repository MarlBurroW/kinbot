import { test, expect, type Page } from '@playwright/test'
import { loginAs, mockProviderModels } from './helpers/auth'

/**
 * Open Settings dialog and navigate to the Contacts section.
 */
async function openContactsSettings(page: Page) {
  await page.locator('button:has(.lucide-settings-2)').click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })

  await page.getByRole('dialog').getByText('Contacts', { exact: true }).click()
  await expect(
    page.getByText('Manage the shared contact registry accessible by all Kins.'),
  ).toBeVisible({ timeout: 5_000 })
}

/**
 * Open the "Add contact" dialog from within the Contacts settings.
 */
async function openAddContactDialog(page: Page) {
  await page.getByRole('button', { name: /add contact/i }).first().click()
  await expect(page.getByText('Create a new contact entry')).toBeVisible({ timeout: 5_000 })
}

/**
 * Create a contact via the form dialog.
 */
async function createContact(
  page: Page,
  opts: {
    name: string
    type?: 'kin'
    identifiers?: Array<{ label: string; value: string }>
  },
) {
  await openAddContactDialog(page)

  // Fill name
  const nameInput = page.locator('#contact-name')
  await nameInput.fill(opts.name)

  // Change type if needed
  if (opts.type === 'kin') {
    await page.locator('#contact-type').click()
    await page.getByRole('option', { name: /kin/i }).click()
  }

  // Add identifiers
  if (opts.identifiers) {
    for (const ident of opts.identifiers) {
      await page.getByRole('button', { name: /add identifier/i }).click()

      // The last combobox is the label selector for the new identifier
      const comboboxes = page.getByRole('combobox')
      const lastCombobox = comboboxes.last()
      await lastCombobox.click()

      // Type into the search input inside the popover
      const searchInput = page.getByPlaceholder('Type or search...')
      if (await searchInput.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await searchInput.fill(ident.label)
        // Click the matching suggestion
        const suggestion = page
          .locator('button')
          .filter({ hasText: new RegExp(`^${ident.label}$`, 'i') })
          .first()
        if (await suggestion.isVisible({ timeout: 1_000 }).catch(() => false)) {
          await suggestion.click()
        } else {
          await searchInput.press('Enter')
        }
      }

      // Fill the value in the last value input
      const valueInputs = page.getByPlaceholder('Enter value')
      await valueInputs.last().fill(ident.value)
    }
  }

  // Submit — the "Add contact" button in the dialog footer
  // The dialog has a footer with Cancel + Add contact buttons
  const dialogs = page.locator('[role="dialog"]')
  const contactDialog = dialogs.last()
  await contactDialog.getByRole('button', { name: /add contact/i }).click()

  // Wait for dialog to close
  await expect(page.getByText('Create a new contact entry')).not.toBeVisible({ timeout: 5_000 })
}

/**
 * Delete a contact card by its name text, confirming in the AlertDialog.
 */
async function deleteContact(page: Page, name: string) {
  const card = page.locator('.surface-card', { hasText: name }).first()
  await card.locator('button:has(.lucide-trash-2)').first().click()

  // Confirm in the alert dialog
  await expect(page.getByText('This will permanently delete this contact')).toBeVisible({
    timeout: 3_000,
  })
  const alertDialog = page.locator('[role="alertdialog"]')
  await alertDialog.getByRole('button', { name: 'Delete' }).click()

  // Wait for the contact to disappear
  await expect(page.getByText(name)).not.toBeVisible({ timeout: 5_000 })
}

test.describe.serial('Contact management', () => {
  test.beforeEach(async ({ page }) => {
    await mockProviderModels(page)

    await page.goto('/')
    await expect(page.getByText('Sign in to your KinBot workspace')).toBeVisible({
      timeout: 10_000,
    })
    await loginAs(page)
    await expect(page.getByText('Kins', { exact: true })).toBeVisible({ timeout: 10_000 })
  })

  test('should navigate to contacts settings and see existing contacts', async ({ page }) => {
    await openContactsSettings(page)

    // Onboarding creates a "Test User" contact linked to the test account
    await expect(page.getByText('Test User').first()).toBeVisible({ timeout: 5_000 })
    // Should have the "Add contact" button
    await expect(page.getByRole('button', { name: /add contact/i })).toBeVisible()
  })

  test('should open add contact dialog and see form fields', async ({ page }) => {
    await openContactsSettings(page)
    await openAddContactDialog(page)

    await expect(page.locator('#contact-name')).toBeVisible()
    await expect(page.locator('#contact-type')).toBeVisible()
    await expect(page.getByText('Identifiers', { exact: true })).toBeVisible()

    // Close dialog
    await page.keyboard.press('Escape')
  })

  test('should create a human contact with email identifier', async ({ page }) => {
    await openContactsSettings(page)

    await createContact(page, {
      name: 'Alice Smith',
      identifiers: [{ label: 'email', value: 'alice@example.com' }],
    })

    // Verify contact card appears
    await expect(page.getByText('Alice Smith')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('email: alice@example.com')).toBeVisible()
  })

  test('should create a second contact without identifiers', async ({ page }) => {
    await openContactsSettings(page)

    await createContact(page, {
      name: 'Bob Jones',
    })

    await expect(page.getByText('Bob Jones')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Alice Smith')).toBeVisible()
  })

  test('should edit a contact name', async ({ page }) => {
    await openContactsSettings(page)
    await expect(page.getByText('Alice Smith')).toBeVisible({ timeout: 5_000 })

    // Click pencil icon on Alice's card
    const aliceCard = page.locator('.surface-card', { hasText: 'Alice Smith' }).first()
    await aliceCard.locator('button:has(.lucide-pencil)').first().click()

    // Edit dialog should open
    await expect(page.getByText('Update contact information')).toBeVisible({ timeout: 5_000 })

    // Change name
    const nameInput = page.locator('#contact-name')
    await nameInput.clear()
    await nameInput.fill('Alice Updated')

    // Save
    await page.getByRole('button', { name: /save/i }).click()

    // Verify updated name
    await expect(page.getByText('Alice Updated')).toBeVisible({ timeout: 5_000 })
  })

  test('should delete Bob with confirmation', async ({ page }) => {
    await openContactsSettings(page)
    await expect(page.getByText('Bob Jones')).toBeVisible({ timeout: 5_000 })

    await deleteContact(page, 'Bob Jones')
  })

  test('should delete Alice for cleanup', async ({ page }) => {
    await openContactsSettings(page)
    await expect(page.getByText('Alice Updated')).toBeVisible({ timeout: 5_000 })

    await deleteContact(page, 'Alice Updated')

    // Test User (from onboarding) should still be visible
    await expect(page.getByText('Test User').first()).toBeVisible({ timeout: 5_000 })
  })
})
