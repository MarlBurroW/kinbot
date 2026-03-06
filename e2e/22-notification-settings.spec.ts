import { test, expect, type Page } from '@playwright/test'
import { loginAs, mockProviderModels } from './helpers/auth'

async function openSettings(page: Page) {
  await page.locator('button:has(.lucide-settings-2)').click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
}

async function navigateToNotifications(page: Page) {
  await openSettings(page)
  await page.getByRole('dialog').getByText('Notifications', { exact: true }).click()
}

test.describe.serial('Settings — Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await mockProviderModels(page)
    await page.goto('/')
    await loginAs(page)
    await expect(page.locator('button:has(.lucide-settings-2)')).toBeVisible({ timeout: 10_000 })
  })

  test('should display notification preferences section', async ({ page }) => {
    await navigateToNotifications(page)
    const dialog = page.getByRole('dialog')

    // Section header and description
    await expect(dialog.getByText('Choose which notifications you want to receive.')).toBeVisible()

    // All 7 notification type toggles should be visible
    const types = [
      'Input needed',
      'User pending approval',
      'Cron pending approval',
      'MCP pending approval',
      'Kin error',
      'Kin alert',
      'Mention',
    ]
    for (const label of types) {
      await expect(dialog.getByText(label, { exact: true })).toBeVisible()
    }
  })

  test('should display notification sound toggle', async ({ page }) => {
    await navigateToNotifications(page)
    const dialog = page.getByRole('dialog')

    await expect(dialog.getByText('Notification sound')).toBeVisible()
    await expect(dialog.getByText('Play a chime when a new notification arrives.')).toBeVisible()

    // Sound toggle switch should exist
    const soundSwitch = dialog.locator('#notif-sound')
    await expect(soundSwitch).toBeVisible()
  })

  test('should toggle a notification type off and on', async ({ page }) => {
    await navigateToNotifications(page)
    const dialog = page.getByRole('dialog')

    // Find the "Kin alert" switch
    const kinAlertSwitch = dialog.locator('#notif-kin\\:alert')
    await expect(kinAlertSwitch).toBeVisible()

    // It should be checked by default
    await expect(kinAlertSwitch).toBeChecked()

    // Toggle off
    await kinAlertSwitch.click()
    await expect(kinAlertSwitch).not.toBeChecked()

    // Toggle back on
    await kinAlertSwitch.click()
    await expect(kinAlertSwitch).toBeChecked()
  })

  test('should display external delivery section', async ({ page }) => {
    await navigateToNotifications(page)
    const dialog = page.getByRole('dialog')

    await expect(dialog.getByRole('heading', { name: 'External delivery' })).toBeVisible()
    await expect(dialog.getByText('Receive notifications on external platforms.')).toBeVisible()
  })

  test('should show empty state for external channels', async ({ page }) => {
    await navigateToNotifications(page)
    const dialog = page.getByRole('dialog')

    // No channels configured in E2E DB
    await expect(dialog.getByText('No external delivery channels configured.')).toBeVisible()
  })

  test('should show Add delivery channel button', async ({ page }) => {
    await navigateToNotifications(page)
    const dialog = page.getByRole('dialog')

    const addButton = dialog.getByRole('button', { name: 'Add delivery channel' }).first()
    await expect(addButton).toBeVisible()
  })

  test('should open add channel dialog', async ({ page }) => {
    await navigateToNotifications(page)
    const dialog = page.getByRole('dialog')

    // Click the bottom "Add delivery channel" button
    await dialog.getByRole('button', { name: 'Add delivery channel' }).last().click()

    // A nested dialog should appear with "Add delivery channel" title
    await expect(page.getByText('Add delivery channel').first()).toBeVisible({ timeout: 5_000 })

    // Should show source channel and label fields
    await expect(page.getByText('Source channel (bot)')).toBeVisible()
    await expect(page.getByText('Label')).toBeVisible()
  })

  test('should show no available channels message in add dialog', async ({ page }) => {
    await navigateToNotifications(page)
    const dialog = page.getByRole('dialog')

    await dialog.getByRole('button', { name: 'Add delivery channel' }).last().click()
    await expect(page.getByText('Add delivery channel').first()).toBeVisible({ timeout: 5_000 })

    // In E2E environment, no active messaging channels exist
    // The form should show "No active channels available" or have an empty select
    await expect(page.getByText('No active channels available')).toBeVisible({ timeout: 3_000 })
  })

  test('should toggle notification sound', async ({ page }) => {
    await navigateToNotifications(page)
    const dialog = page.getByRole('dialog')

    const soundSwitch = dialog.locator('#notif-sound')
    const initialState = await soundSwitch.isChecked()

    // Toggle
    await soundSwitch.click()
    const newState = await soundSwitch.isChecked()
    expect(newState).toBe(!initialState)

    // Toggle back
    await soundSwitch.click()
    await expect(soundSwitch).toBeChecked({ checked: initialState })
  })

  test('should show help panel', async ({ page }) => {
    await navigateToNotifications(page)
    const dialog = page.getByRole('dialog')

    // Help panel should be present (collapsed or expanded)
    // Look for the help content text
    const helpContent = dialog.getByText('Notifications keep you informed about important events in KinBot')
    // It may be collapsed - if there's a toggle, click it
    const helpToggle = dialog.locator('button:has(.lucide-circle-help)')
    if (await helpToggle.isVisible()) {
      await helpToggle.click()
      await expect(helpContent).toBeVisible({ timeout: 3_000 })
    }
  })

  test('should show notification type descriptions', async ({ page }) => {
    await navigateToNotifications(page)
    const dialog = page.getByRole('dialog')

    // Check a few descriptions are visible
    await expect(dialog.getByText('A Kin is waiting for your response to continue')).toBeVisible()
    await expect(dialog.getByText('Someone mentioned you in a conversation')).toBeVisible()
  })
})
