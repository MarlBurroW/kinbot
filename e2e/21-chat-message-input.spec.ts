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

test.describe.serial('Chat message input features', () => {
  test.beforeEach(async ({ page }) => {
    await mockProviderModels(page)
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible({ timeout: 10_000 })
    await loginAs(page)
    await expect(page.getByText('Kins', { exact: true })).toBeVisible({ timeout: 10_000 })
  })

  test('should show formatting toolbar when input is focused', async ({ page }) => {
    const input = await openKinChat(page)
    await input.click()

    // Formatting buttons should be visible (Bold, Italic, Strikethrough, Code, Code block)
    await expect(page.locator('button:has(svg.lucide-bold)')).toBeVisible({ timeout: 3_000 })
    await expect(page.locator('button:has(svg.lucide-italic)')).toBeVisible()
    await expect(page.locator('button:has(svg.lucide-strikethrough)')).toBeVisible()
    await expect(page.locator('button:has(svg.lucide-code)')).toBeVisible()
    await expect(page.locator('button:has(svg.lucide-braces)')).toBeVisible()
  })

  test('should apply bold formatting via toolbar button', async ({ page }) => {
    const input = await openKinChat(page)

    // Type text, select it, then apply bold
    await input.fill('hello world')
    await input.click()
    await page.keyboard.press('Control+A')
    await page.locator('button:has(svg.lucide-bold)').click()

    // Input should now contain bold markdown
    await expect(input).toHaveValue('**hello world**')
  })

  test('should apply italic formatting via toolbar button', async ({ page }) => {
    const input = await openKinChat(page)

    await input.fill('hello world')
    await input.click()
    await page.keyboard.press('Control+A')
    await page.locator('button:has(svg.lucide-italic)').click()

    await expect(input).toHaveValue('_hello world_')
  })

  test('should apply strikethrough formatting via toolbar button', async ({ page }) => {
    const input = await openKinChat(page)

    await input.fill('hello world')
    await input.click()
    await page.keyboard.press('Control+A')
    await page.locator('button:has(svg.lucide-strikethrough)').click()

    await expect(input).toHaveValue('~~hello world~~')
  })

  test('should apply inline code formatting via toolbar button', async ({ page }) => {
    const input = await openKinChat(page)

    await input.fill('hello world')
    await input.click()
    await page.keyboard.press('Control+A')
    await page.locator('button:has(svg.lucide-code)').click()

    await expect(input).toHaveValue('`hello world`')
  })

  test('should apply code block formatting via toolbar button', async ({ page }) => {
    const input = await openKinChat(page)

    await input.fill('hello world')
    await input.click()
    await page.keyboard.press('Control+A')
    await page.locator('button:has(svg.lucide-braces)').click()

    await expect(input).toHaveValue('```\nhello world\n```')
  })

  test('should apply bold formatting via keyboard shortcut', async ({ page }) => {
    const input = await openKinChat(page)

    await input.click()
    await page.keyboard.type('shortcut test')
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Control+b')

    await expect(input).toHaveValue('**shortcut test**')
  })

  test('should apply italic formatting via keyboard shortcut', async ({ page }) => {
    const input = await openKinChat(page)

    await input.click()
    await page.keyboard.type('shortcut test')
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Control+i')

    await expect(input).toHaveValue('_shortcut test_')
  })

  test('should show attachment button', async ({ page }) => {
    await openKinChat(page)

    // Paperclip icon for file attachments
    await expect(page.locator('button:has(svg.lucide-paperclip)')).toBeVisible({ timeout: 3_000 })
  })

  test('should send message with Enter key', async ({ page }) => {
    const input = await openKinChat(page)

    await input.fill('Enter key test message')
    await page.keyboard.press('Enter')

    // Message should appear in chat
    await expect(page.getByText('Enter key test message').first()).toBeVisible({ timeout: 10_000 })
  })

  test('should allow multiline input with Shift+Enter', async ({ page }) => {
    const input = await openKinChat(page)

    await input.click()
    await page.keyboard.type('Line one')
    await page.keyboard.press('Shift+Enter')
    await page.keyboard.type('Line two')

    // The textarea should contain both lines (not sent)
    const value = await input.inputValue()
    expect(value).toContain('Line one')
    expect(value).toContain('Line two')
  })

  test('should disable send button when input is empty', async ({ page }) => {
    await openKinChat(page)

    // Send button should not be clickable with empty input
    const sendBtn = page.locator('button:has(svg.lucide-send-horizontal)')
    // It may be hidden or disabled when empty - check it's either not visible or disabled
    const isVisible = await sendBtn.isVisible({ timeout: 2_000 }).catch(() => false)
    if (isVisible) {
      await expect(sendBtn).toBeDisabled()
    }
    // If not visible at all, that's also fine - send button appears only when there's content
  })
})
