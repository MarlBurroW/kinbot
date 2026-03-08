import { test, expect, type Page } from '@playwright/test'
import { loginAs, mockProviderModels } from './helpers/auth'

/**
 * Navigate to the Test Assistant kin chat and wait for the message input.
 */
async function openKinChat(page: Page) {
  await page.getByText('Test Assistant').first().click()
  const input = page.getByPlaceholder('Send a message...')
  await expect(input).toBeVisible({ timeout: 10_000 })
  return input
}

test.describe.serial('Conversation statistics popover', () => {
  test.beforeEach(async ({ page }) => {
    await mockProviderModels(page)
    await page.goto('/')
    const signIn = page.getByRole('button', { name: 'Sign in' })
    const kins = page.getByText('Kins', { exact: true })
    await expect(signIn.or(kins)).toBeVisible({ timeout: 10_000 })
    if (await signIn.isVisible().catch(() => false)) {
      await loginAs(page)
    }
    await expect(kins).toBeVisible({ timeout: 10_000 })
  })

  test('create kin and send a message so stats have data', async ({ page }) => {
    // Create a kin if it doesn't exist
    const testAssistant = page.getByText('Test Assistant').first()
    const isKinVisible = await testAssistant.isVisible({ timeout: 3_000 }).catch(() => false)

    if (!isKinVisible) {
      // Click the sidebar "New Kin" button (the small one with title attribute)
      await page.getByTitle('New Kin').click()

      // The wizard dialog should open
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })

      // Skip AI wizard and go to manual form
      await page.getByRole('button', { name: 'Create manually' }).click()

      // Fill the form
      await page.fill('#kinFormName', 'Test Assistant')
      await page.fill('#kinFormRole', 'General helper for testing')

      // Select a model
      const modelPicker = page.getByRole('combobox').first()
      await modelPicker.click()
      await page.getByRole('option', { name: /GPT-4o/i }).click()
      await page.locator('#kinFormName').click()

      // Submit
      await page.getByRole('button', { name: 'Create Kin' }).click()
      await expect(testAssistant).toBeVisible({ timeout: 15_000 })
    }

    const input = await openKinChat(page)
    await input.fill('Hello stats test message')
    await page.keyboard.press('Enter')
    // Wait for the user message to appear in the conversation
    await expect(page.getByText('Hello stats test message').first()).toBeVisible({ timeout: 10_000 })
  })

  test('stats button is visible in conversation header', async ({ page }) => {
    await openKinChat(page)
    // Wait for the message to be loaded
    await expect(
      page.getByText('Hello stats test message').first(),
    ).toBeVisible({ timeout: 10_000 })

    // The stats button uses a BarChart3 icon
    const statsButton = page.locator('button:has(svg.lucide-chart-column), button:has(svg.lucide-bar-chart-3)')
    await expect(statsButton).toBeVisible({ timeout: 5_000 })
  })

  test('clicking stats button opens popover with title', async ({ page }) => {
    await openKinChat(page)
    await expect(
      page.getByText('Hello stats test message').first(),
    ).toBeVisible({ timeout: 10_000 })

    await page.locator('button:has(svg.lucide-chart-column), button:has(svg.lucide-bar-chart-3)').click()

    // Popover should show the stats title
    await expect(page.getByText('Conversation Statistics')).toBeVisible({ timeout: 5_000 })
  })

  test('stats popover shows message counts', async ({ page }) => {
    await openKinChat(page)
    await expect(
      page.getByText('Hello stats test message').first(),
    ).toBeVisible({ timeout: 10_000 })

    await page.locator('button:has(svg.lucide-chart-column), button:has(svg.lucide-bar-chart-3)').click()
    await expect(page.getByText('Conversation Statistics')).toBeVisible({ timeout: 5_000 })

    // Should show the stat labels
    await expect(page.getByText('Total messages')).toBeVisible()
    await expect(page.getByText('Your messages')).toBeVisible()
    await expect(page.getByText('Assistant messages')).toBeVisible()
  })

  test('stats popover shows tool calls and word count', async ({ page }) => {
    await openKinChat(page)
    await expect(
      page.getByText('Hello stats test message').first(),
    ).toBeVisible({ timeout: 10_000 })

    await page.locator('button:has(svg.lucide-chart-column), button:has(svg.lucide-bar-chart-3)').click()
    await expect(page.getByText('Conversation Statistics')).toBeVisible({ timeout: 5_000 })

    await expect(page.getByText('Tool calls', { exact: true })).toBeVisible()
    await expect(page.getByText('Total words', { exact: true })).toBeVisible()
  })

  test('stats popover shows duration', async ({ page }) => {
    await openKinChat(page)
    await expect(
      page.getByText('Hello stats test message').first(),
    ).toBeVisible({ timeout: 10_000 })

    await page.locator('button:has(svg.lucide-chart-column), button:has(svg.lucide-bar-chart-3)').click()
    await expect(page.getByText('Conversation Statistics')).toBeVisible({ timeout: 5_000 })

    await expect(page.getByText('Duration')).toBeVisible()
  })

  test('stats popover closes when clicking outside', async ({ page }) => {
    await openKinChat(page)
    await expect(
      page.getByText('Hello stats test message').first(),
    ).toBeVisible({ timeout: 10_000 })

    await page.locator('button:has(svg.lucide-chart-column), button:has(svg.lucide-bar-chart-3)').click()
    await expect(page.getByText('Conversation Statistics')).toBeVisible({ timeout: 5_000 })

    // Click outside the popover to close it
    await page.locator('body').click({ position: { x: 10, y: 10 } })
    await expect(page.getByText('Conversation Statistics')).not.toBeVisible({ timeout: 5_000 })
  })

  test('stats popover closes with Escape key', async ({ page }) => {
    await openKinChat(page)
    await expect(
      page.getByText('Hello stats test message').first(),
    ).toBeVisible({ timeout: 10_000 })

    await page.locator('button:has(svg.lucide-chart-column), button:has(svg.lucide-bar-chart-3)').click()
    await expect(page.getByText('Conversation Statistics')).toBeVisible({ timeout: 5_000 })

    await page.keyboard.press('Escape')
    await expect(page.getByText('Conversation Statistics')).not.toBeVisible({ timeout: 5_000 })
  })

  test('stats popover can be toggled open and closed', async ({ page }) => {
    await openKinChat(page)
    await expect(
      page.getByText('Hello stats test message').first(),
    ).toBeVisible({ timeout: 10_000 })

    const statsButton = page.locator('button:has(svg.lucide-chart-column), button:has(svg.lucide-bar-chart-3)')

    // Open
    await statsButton.click()
    await expect(page.getByText('Conversation Statistics')).toBeVisible({ timeout: 5_000 })

    // Close by clicking button again
    await statsButton.click()
    await expect(page.getByText('Conversation Statistics')).not.toBeVisible({ timeout: 5_000 })

    // Re-open
    await statsButton.click()
    await expect(page.getByText('Conversation Statistics')).toBeVisible({ timeout: 5_000 })
  })
})
