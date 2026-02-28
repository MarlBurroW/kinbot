import { test, expect, type Page } from '@playwright/test'
import { loginAs, mockProviderModels } from './helpers/auth'

/**
 * Helper: Click on a kin card in the sidebar by name.
 */
async function selectKin(page: Page, kinName: string) {
  await page.getByText(kinName, { exact: true }).first().click()
  // Wait for chat area to load
  await expect(page.getByPlaceholder('Send a message...')).toBeVisible({ timeout: 10_000 })
}

/**
 * Helper: Open the kin edit modal via the Settings2 icon on the kin card.
 */
async function openKinEditModal(page: Page, kinName: string) {
  // Right-click on the kin card to open context menu, then click Edit
  const kinText = page.getByText(kinName, { exact: true }).first()
  await kinText.click({ button: 'right' })

  // Click the "Edit" context menu item (has Settings2 icon)
  await page.getByRole('menuitem').filter({ hasText: /edit/i }).click()

  // Wait for the edit dialog to appear
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
}

/**
 * Helper: Create a kin via the UI (used as setup for edit/delete tests).
 */
async function createKin(page: Page, name: string, role: string) {
  await page.getByTitle('New Kin').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('Describe your Kin')).toBeVisible()
  await page.getByRole('button', { name: 'Create manually' }).click()

  await page.fill('#kinFormName', name)
  await page.fill('#kinFormRole', role)

  // Select model
  const modelPicker = page.getByRole('combobox').first()
  await modelPicker.click()
  await page.getByRole('option', { name: /GPT-4o/i }).click()
  await page.locator('#kinFormName').click() // close popover

  await page.getByRole('button', { name: 'Create Kin' }).click()
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 15_000 })
}

test.describe.serial('Kin management', () => {
  test.beforeEach(async ({ page }) => {
    await mockProviderModels(page)

    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible({ timeout: 10_000 })
    await loginAs(page)
    await expect(page.getByText('Kins', { exact: true })).toBeVisible({ timeout: 10_000 })
  })

  test('should create a second kin for management tests', async ({ page }) => {
    await createKin(page, 'Management Test Kin', 'A kin for testing edit and delete operations')

    // Verify it appears in the sidebar
    await expect(page.getByText('Management Test Kin').first()).toBeVisible()
  })

  test('should open kin edit modal and see general tab', async ({ page }) => {
    await openKinEditModal(page, 'Management Test Kin')

    // Should see the kin name in the form
    const nameInput = page.locator('#kinFormName')
    await expect(nameInput).toBeVisible({ timeout: 5_000 })
    await expect(nameInput).toHaveValue('Management Test Kin')

    // Should see the role field
    const roleInput = page.locator('#kinFormRole')
    await expect(roleInput).toBeVisible()
    await expect(roleInput).toHaveValue('A kin for testing edit and delete operations')
  })

  test('should edit kin name and role', async ({ page }) => {
    await openKinEditModal(page, 'Management Test Kin')

    // Change name
    await page.locator('#kinFormName').fill('Renamed Kin')

    // Change role
    await page.locator('#kinFormRole').fill('Updated role description')

    // Save — look for the save button
    await page.getByRole('button', { name: /Save/i }).click()

    // Should see success indication (toast or dialog closes)
    // Wait for the dialog to close or success toast
    await expect(page.getByText('Renamed Kin').first()).toBeVisible({ timeout: 10_000 })
  })

  test('should edit kin character and expertise fields', async ({ page }) => {
    await openKinEditModal(page, 'Renamed Kin')

    // Find character field (textarea or markdown editor)
    const characterField = page.locator('#kinFormCharacter, [data-testid="character-editor"] textarea, .cm-content').first()
    if (await characterField.isVisible()) {
      await characterField.click()
      await characterField.fill('Friendly and helpful personality')
    }

    // Find expertise field
    const expertiseField = page.locator('#kinFormExpertise, [data-testid="expertise-editor"] textarea').first()
    if (await expertiseField.isVisible()) {
      await expertiseField.click()
      await expertiseField.fill('Testing and quality assurance')
    }

    // Save
    const saveButton = page.getByRole('button', { name: /Save/i })
    if (await saveButton.isVisible()) {
      await saveButton.click()
      // Wait briefly for save to complete
      await page.waitForTimeout(1_000)
    }
  })

  test('should navigate to tools tab in edit modal', async ({ page }) => {
    await openKinEditModal(page, 'Renamed Kin')

    // Click the tools tab (Wrench icon)
    const toolsTab = page.getByRole('dialog').locator('button:has(.lucide-wrench)')
    await expect(toolsTab).toBeVisible({ timeout: 5_000 })
    await toolsTab.click()

    // Should see tool-related content (tool domain groups)
    await expect(page.getByRole('dialog').getByText(/tool/i).first()).toBeVisible({ timeout: 5_000 })
  })

  test('should navigate to memory tab in edit modal', async ({ page }) => {
    await openKinEditModal(page, 'Renamed Kin')

    // Click the memory tab (Brain icon)
    const memoryTab = page.getByRole('dialog').locator('button:has(.lucide-brain)')
    await expect(memoryTab).toBeVisible({ timeout: 5_000 })
    await memoryTab.click()

    // Should see memory-related content
    await expect(page.getByRole('dialog').getByText(/memor/i).first()).toBeVisible({ timeout: 5_000 })
  })

  test('should delete a kin with confirmation', async ({ page }) => {
    // First create a disposable kin
    await createKin(page, 'Disposable Kin', 'Will be deleted')

    await openKinEditModal(page, 'Disposable Kin')

    // Find the delete button (Trash2 icon or ConfirmDeleteButton)
    const deleteButton = page.getByRole('dialog').locator('button:has(.lucide-trash-2, .lucide-trash)')
    await expect(deleteButton).toBeVisible({ timeout: 5_000 })
    await deleteButton.click()

    // Should show confirmation — click confirm/delete
    const confirmButton = page.getByRole('button', { name: /Delete|Confirm/i }).last()
    await expect(confirmButton).toBeVisible({ timeout: 5_000 })
    await confirmButton.click()

    // The kin should disappear from the sidebar
    await expect(page.getByText('Disposable Kin')).toBeHidden({ timeout: 10_000 })
  })

  test('should create a kin via the wizard dialog', async ({ page }) => {
    // Open the new kin dialog
    await page.getByTitle('New Kin').click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Describe your Kin')).toBeVisible()

    // Verify the wizard has a text area for describing the kin
    const descriptionInput = page.getByRole('dialog').locator('textarea').first()
    await expect(descriptionInput).toBeVisible({ timeout: 5_000 })

    // Verify "Create manually" button exists as alternative
    await expect(page.getByRole('button', { name: 'Create manually' })).toBeVisible()

    // Use manual creation (wizard requires LLM calls)
    await page.getByRole('button', { name: 'Create manually' }).click()

    // Verify manual form appeared
    await expect(page.locator('#kinFormName')).toBeVisible({ timeout: 5_000 })

    // Cancel/close the dialog
    // Press Escape to close
    await page.keyboard.press('Escape')
  })

  test('should select a kin and open its chat', async ({ page }) => {
    await selectKin(page, 'Renamed Kin')

    // Chat area should be visible with message input
    const messageInput = page.getByPlaceholder('Send a message...')
    await expect(messageInput).toBeVisible()

    // The kin name should appear in the chat header or breadcrumb
    await expect(page.getByText('Renamed Kin').first()).toBeVisible()
  })
})
