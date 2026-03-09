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

async function openSearch(page: Page) {
  await page.keyboard.press('Control+f')
  const searchInput = page.getByPlaceholder('Search in conversation...')
  await expect(searchInput).toBeVisible({ timeout: 5_000 })
  return searchInput
}

test.describe.serial('Conversation search (Ctrl+F)', () => {
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

  test('open search with Ctrl+F', async ({ page }) => {
    await openKinChat(page)
    const searchInput = await openSearch(page)
    await expect(searchInput).toBeFocused()
  })

  test('search finds matching messages', async ({ page }) => {
    await openKinChat(page)
    // Wait for a message to be visible (from previous tests like 26-conversation-stats)
    await expect(page.locator('[data-message-id]').first()).toBeVisible({ timeout: 10_000 })

    const searchInput = await openSearch(page)
    // Search for text from the stats test user message: "Hello stats test message"
    await searchInput.fill('stats test')
    // Should show match count: "N of M"
    await expect(page.getByText(/\d+ of \d+/)).toBeVisible({ timeout: 5_000 })
  })

  test('no results for nonsense query', async ({ page }) => {
    await openKinChat(page)
    const searchInput = await openSearch(page)
    await searchInput.fill('xyznonexistent999')
    await expect(page.getByText('No matches')).toBeVisible({ timeout: 5_000 })
  })

  test('close search with Escape', async ({ page }) => {
    await openKinChat(page)
    const searchInput = await openSearch(page)
    await page.keyboard.press('Escape')
    await expect(searchInput).not.toBeVisible({ timeout: 3_000 })
  })

  test('close search with close button', async ({ page }) => {
    await openKinChat(page)
    const searchInput = await openSearch(page)
    await page.getByTitle('Close search').click()
    await expect(searchInput).not.toBeVisible({ timeout: 3_000 })
  })

  test('navigate matches with Enter and Shift+Enter', async ({ page }) => {
    await openKinChat(page)
    await expect(page.locator('[data-message-id]').first()).toBeVisible({ timeout: 10_000 })

    const searchInput = await openSearch(page)
    // Search for "Hello" which should match user messages from previous tests
    await searchInput.fill('Hello')
    const matchIndicator = page.getByText(/1 of (\d+)/)
    await expect(matchIndicator).toBeVisible({ timeout: 5_000 })

    // Only test navigation if we have 2+ matches
    const text = await matchIndicator.textContent()
    const total = parseInt(text?.match(/of (\d+)/)?.[1] ?? '0')
    if (total >= 2) {
      await searchInput.press('Enter')
      await expect(page.getByText(/2 of \d+/)).toBeVisible({ timeout: 3_000 })
      await searchInput.press('Shift+Enter')
      await expect(page.getByText(/1 of \d+/)).toBeVisible({ timeout: 3_000 })
    }
    // With 1 match, Enter should wrap around to 1 of 1
    if (total === 1) {
      await searchInput.press('Enter')
      await expect(page.getByText('1 of 1')).toBeVisible({ timeout: 3_000 })
    }
  })

  test('navigate with arrow buttons', async ({ page }) => {
    await openKinChat(page)
    await expect(page.locator('[data-message-id]').first()).toBeVisible({ timeout: 10_000 })

    const searchInput = await openSearch(page)
    await searchInput.fill('Hello')
    const matchIndicator = page.getByText(/1 of (\d+)/)
    await expect(matchIndicator).toBeVisible({ timeout: 5_000 })

    const text = await matchIndicator.textContent()
    const total = parseInt(text?.match(/of (\d+)/)?.[1] ?? '0')
    if (total >= 2) {
      await page.getByTitle('Next match').click()
      await expect(page.getByText(/2 of \d+/)).toBeVisible({ timeout: 3_000 })
      await page.getByTitle('Previous match').click()
      await expect(page.getByText(/1 of \d+/)).toBeVisible({ timeout: 3_000 })
    }
  })

  test('short query (1 char) shows no match indicator', async ({ page }) => {
    await openKinChat(page)
    const searchInput = await openSearch(page)
    await searchInput.fill('x')
    // With < 2 chars, no match indicator should appear
    await expect(page.getByText('No matches')).not.toBeVisible({ timeout: 2_000 })
    await expect(page.getByText(/\d+ of \d+/)).not.toBeVisible({ timeout: 1_000 })
  })

  test('search input clears and resets on reopen', async ({ page }) => {
    await openKinChat(page)
    let searchInput = await openSearch(page)
    await searchInput.fill('test query')
    await page.keyboard.press('Escape')
    await expect(searchInput).not.toBeVisible({ timeout: 3_000 })

    // Reopen - should be empty
    searchInput = await openSearch(page)
    await expect(searchInput).toHaveValue('')
  })
})
