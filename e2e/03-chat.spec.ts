import { test, expect } from '@playwright/test'
import { loginAs, mockProviderModels, TEST_USER } from './helpers/auth'

test.describe.serial('Chat flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock provider models so the model picker works
    await mockProviderModels(page)

    // Login first
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible({ timeout: 10_000 })
    await loginAs(page)
    await expect(page.getByText('Kins', { exact: true })).toBeVisible({ timeout: 10_000 })
  })

  test('create a kin', async ({ page }) => {
    // Click the "+" button to create a new Kin (title="New Kin")
    await page.getByTitle('New Kin').click()

    // The wizard dialog should open with "Describe your Kin"
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Describe your Kin' })).toBeVisible()

    // Skip the AI wizard and go to manual form
    await page.getByRole('button', { name: 'Create manually' }).click()

    // Fill the form
    await page.fill('#kinFormName', 'Test Assistant')
    await page.fill('#kinFormRole', 'General helper for testing')

    // Select a model from the model picker
    const modelPicker = page.getByRole('combobox').first()
    await modelPicker.click()
    // Select the first LLM model option
    await page.getByRole('option', { name: /GPT-4o/i }).click()

    // Close the model picker popover by clicking elsewhere
    await page.locator('#kinFormName').click()

    // Submit the form
    await page.getByRole('button', { name: 'Create Kin' }).click()

    // The new kin should appear in the sidebar after dialog closes
    await expect(page.getByText('Test Assistant').first()).toBeVisible({ timeout: 15_000 })
  })

  test('send a message', async ({ page }) => {
    // The kin created in the previous test should be in the sidebar
    // Click on it to open the chat
    await page.getByText('Test Assistant').first().click()

    // The chat panel should show the message input
    const messageInput = page.getByPlaceholder('Send a message...')
    await expect(messageInput).toBeVisible({ timeout: 10_000 })

    // Type a message
    await messageInput.fill('Hello, this is a test message!')

    // Click the send button (it's an icon button with SendHorizontal)
    await page.locator('button:has(svg.lucide-send-horizontal)').click()

    // The user message should appear in the chat (as a paragraph, not the textarea)
    await expect(page.getByRole('paragraph').filter({ hasText: 'Hello, this is a test message!' }).first()).toBeVisible({ timeout: 10_000 })
  })

  test('search messages in conversation', async ({ page }) => {
    // Open the kin with a message from the previous test
    await page.getByText('Test Assistant').first().click()
    await expect(page.getByPlaceholder('Send a message...')).toBeVisible({ timeout: 10_000 })

    // Wait for the existing message to appear
    await expect(page.getByRole('paragraph').filter({ hasText: 'Hello, this is a test message!' }).first()).toBeVisible({ timeout: 10_000 })

    // Click the search button (lucide-search icon in the conversation header)
    await page.locator('button:has(svg.lucide-search)').click()

    // The search input should appear
    const searchInput = page.getByPlaceholder('Search in conversation...')
    await expect(searchInput).toBeVisible({ timeout: 5_000 })

    // Search for the message
    await searchInput.fill('test message')

    // Should show match count
    await expect(page.getByText(/1 of 1/)).toBeVisible({ timeout: 5_000 })

    // Search for something that doesn't exist
    await searchInput.fill('nonexistent gibberish xyz')
    await expect(page.getByText('No matches')).toBeVisible({ timeout: 5_000 })

    // Close search via Escape key
    await searchInput.press('Escape')
    await expect(searchInput).not.toBeVisible()
  })

  test('open more actions dropdown and see export options', async ({ page }) => {
    // Open the kin
    await page.getByText('Test Assistant').first().click()
    await expect(page.getByPlaceholder('Send a message...')).toBeVisible({ timeout: 10_000 })

    // Click the "More actions" dropdown trigger (MoreVertical icon)
    await page.locator('button:has(svg.lucide-ellipsis-vertical)').click()

    // The dropdown should show export options
    await expect(page.getByRole('menuitem', { name: 'Export as Markdown' })).toBeVisible({ timeout: 3_000 })
    await expect(page.getByRole('menuitem', { name: 'Export as JSON' })).toBeVisible()

    // Close the dropdown by pressing Escape
    await page.keyboard.press('Escape')
  })

  test('clear conversation', async ({ page }) => {
    // Open the kin
    await page.getByText('Test Assistant').first().click()
    await expect(page.getByPlaceholder('Send a message...')).toBeVisible({ timeout: 10_000 })

    // Verify the message from a previous test is present
    await expect(page.getByRole('paragraph').filter({ hasText: 'Hello, this is a test message!' }).first()).toBeVisible({ timeout: 10_000 })

    // Open the more actions dropdown
    await page.locator('button:has(svg.lucide-ellipsis-vertical)').click()

    // Click "Clear conversation"
    await page.getByRole('menuitem', { name: 'Clear conversation' }).click()

    // Confirmation dialog should appear
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 3_000 })

    // Confirm the clear action
    await page.getByRole('button', { name: 'Clear all messages' }).click()

    // The conversation should now be empty — ChatEmptyState shows "Chat with <kin name>"
    await expect(page.getByText('Chat with Test Assistant')).toBeVisible({ timeout: 10_000 })
  })

  test('send message after clearing shows in conversation', async ({ page }) => {
    // Open the kin (cleared in previous test)
    await page.getByText('Test Assistant').first().click()
    const messageInput = page.getByPlaceholder('Send a message...')
    await expect(messageInput).toBeVisible({ timeout: 10_000 })

    // Should be empty from previous clear
    await expect(page.getByText('Chat with Test Assistant')).toBeVisible({ timeout: 5_000 })

    // Send a new message
    await messageInput.fill('Message after clear')
    await page.locator('button:has(svg.lucide-send-horizontal)').click()

    // The new message should appear — use getByText since markdown rendering may vary
    await expect(page.getByText('Message after clear').first()).toBeVisible({ timeout: 10_000 })
  })

  test('conversation header shows kin name, role, and model picker', async ({ page }) => {
    await page.getByText('Test Assistant').first().click()
    await expect(page.getByPlaceholder('Send a message...')).toBeVisible({ timeout: 10_000 })

    // Header should display kin name as heading
    await expect(page.getByRole('main').getByRole('heading', { name: 'Test Assistant', level: 2 })).toBeVisible()

    // Header should display the role text (desktop only, scoped to main to avoid sidebar match)
    await expect(page.getByRole('main').getByText('General helper for testing')).toBeVisible()

    // Model picker combobox should be visible and show GPT-4o
    const modelPicker = page.locator('main').getByRole('combobox').first()
    await expect(modelPicker).toBeVisible({ timeout: 5_000 })
    await expect(modelPicker).toContainText(/GPT-4o/i)
  })

  test('tool calls toggle button works', async ({ page }) => {
    await page.getByText('Test Assistant').first().click()
    await expect(page.getByPlaceholder('Send a message...')).toBeVisible({ timeout: 10_000 })

    // Tool calls panel heading should be visible (panel is open by default from snapshot)
    const toolsHeading = page.getByRole('heading', { name: 'Tool Calls' })

    // Click wrench button to toggle
    const toolsButton = page.locator('button:has(svg.lucide-wrench)').first()
    await expect(toolsButton).toBeVisible({ timeout: 5_000 })
    await toolsButton.click()

    // Toggle again
    await toolsButton.click()
  })

  test('kin settings button opens edit modal', async ({ page }) => {
    await page.getByText('Test Assistant').first().click()
    await expect(page.getByPlaceholder('Send a message...')).toBeVisible({ timeout: 10_000 })

    // Click the settings button (aria-label "Kin settings")
    await page.getByRole('button', { name: 'Kin settings' }).click()

    // The kin edit dialog should open
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })

    // Should show the kin name in the form
    const nameInput = page.locator('#kinFormName')
    await expect(nameInput).toHaveValue('Test Assistant')

    // Close dialog
    await page.keyboard.press('Escape')
  })

  test('right-click message shows context menu with copy option', async ({ page }) => {
    await page.getByText('Test Assistant').first().click()
    await expect(page.getByPlaceholder('Send a message...')).toBeVisible({ timeout: 10_000 })

    // Wait for the message from previous test
    await expect(page.getByText('Message after clear').first()).toBeVisible({ timeout: 10_000 })

    // Right-click on the message to open context menu
    await page.getByText('Message after clear').first().click({ button: 'right' })

    // Context menu should show Copy option
    await expect(page.getByRole('menuitem', { name: /copy/i })).toBeVisible({ timeout: 3_000 })

    // Should also show Edit & resend for user messages
    await expect(page.getByRole('menuitem', { name: /edit/i })).toBeVisible()

    // Should show Quote reply
    await expect(page.getByRole('menuitem', { name: /quote/i })).toBeVisible()

    // Close context menu
    await page.keyboard.press('Escape')
  })

  test('cancel clear conversation via dialog', async ({ page }) => {
    await page.getByText('Test Assistant').first().click()
    await expect(page.getByPlaceholder('Send a message...')).toBeVisible({ timeout: 10_000 })

    // Ensure a message exists
    await expect(page.getByText('Message after clear').first()).toBeVisible({ timeout: 10_000 })

    // Open more actions dropdown
    await page.locator('button:has(svg.lucide-ellipsis-vertical)').click()

    // Click "Clear conversation"
    await page.getByRole('menuitem', { name: 'Clear conversation' }).click()

    // Confirmation dialog should appear
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 3_000 })

    // Click Cancel instead of confirming
    await page.getByRole('button', { name: /cancel/i }).click()

    // Dialog should close and message should still be there
    await expect(page.getByRole('alertdialog')).not.toBeVisible({ timeout: 3_000 })
    await expect(page.getByText('Message after clear').first()).toBeVisible()
  })
})
