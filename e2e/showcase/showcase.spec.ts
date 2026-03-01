import { test, expect } from '@playwright/test'
import { mockProviderModels } from '../helpers/auth'

/**
 * Showcase test — records a smooth visual walkthrough of KinBot.
 *
 * This is NOT a functional test. Its purpose is to produce a polished video
 * for the landing site hero. It uses deliberate pauses and visible typing
 * so the viewer can follow the flow naturally.
 *
 * Run with: SHOWCASE_THEME=dark npx playwright test --config=playwright.showcase.config.js
 */

async function pause(page: import('@playwright/test').Page, ms = 1500) {
  await page.waitForTimeout(ms)
}

async function typeSlowly(
  page: import('@playwright/test').Page,
  selector: string,
  text: string,
  delay = 70,
) {
  await page.locator(selector).click()
  await page.locator(selector).pressSequentially(text, { delay })
}

test('KinBot showcase walkthrough', async ({ page }) => {
  await mockProviderModels(page)
  await page.goto('/')

  // ── Step 1: Identity ──
  await expect(page.getByText('Step 1 of 5')).toBeVisible()
  await pause(page, 1000)

  await typeSlowly(page, '#firstName', 'Alex', 80)
  await typeSlowly(page, '#lastName', 'Martin', 80)
  await typeSlowly(page, '#email', 'alex@example.com', 50)
  await typeSlowly(page, '#pseudonym', 'Alex', 80)
  await typeSlowly(page, '#password', 'SecurePass123!', 50)
  await typeSlowly(page, '#passwordConfirm', 'SecurePass123!', 50)
  await pause(page, 600)
  await page.getByRole('button', { name: 'Next' }).click()

  // ── Step 2: Preferences — show briefly ──
  await expect(page.getByText('Step 2 of 5')).toBeVisible()
  await pause(page, 1500)
  await page.getByRole('button', { name: 'Next' }).click()

  // ── Step 3: Providers — add OpenAI ──
  await expect(page.getByText('Step 3 of 5')).toBeVisible()
  await pause(page, 1000)
  await page.getByRole('button', { name: 'Add a provider' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  await page.locator('[data-slot="select-trigger"]').click()
  await page.getByRole('option', { name: /OpenAI/ }).click()
  await pause(page, 500)

  await page.fill('#apiKey', 'sk-showcase-demo-key-1234567890')
  await pause(page, 500)

  await page.getByRole('button', { name: 'Test connection' }).click()
  await expect(page.getByText('Connection successful')).toBeVisible({ timeout: 10_000 })
  await pause(page, 800)

  await page.getByRole('button', { name: 'Add provider' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await pause(page, 800)
  await page.getByRole('button', { name: 'Next' }).click()

  // ── Step 4: Memory — skip ──
  await expect(page.getByText('Step 4 of 5')).toBeVisible()
  await pause(page, 800)
  await page.getByRole('button', { name: 'Next' }).click()

  // ── Step 5: Search Providers — skip ──
  await expect(page.getByText('Step 5 of 5')).toBeVisible()
  await pause(page, 500)
  await page.getByRole('button', { name: 'Skip for now' }).click()

  // ── Main App — landed ──
  await expect(page.getByText('Kins', { exact: true })).toBeVisible({ timeout: 10_000 })
  await pause(page, 2000)

  // ── Create a Kin ──
  await page.getByTitle('New Kin').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Describe your Kin' })).toBeVisible()
  await pause(page, 500)

  await page.getByRole('button', { name: 'Create manually' }).click()
  await pause(page, 500)

  await typeSlowly(page, '#kinFormName', 'Chef Claude', 80)
  await typeSlowly(
    page,
    '#kinFormRole',
    'A culinary expert specializing in world cuisines and cooking techniques',
    35,
  )
  await pause(page, 800)

  // Select model
  const modelPicker = page.getByRole('combobox').first()
  await modelPicker.click()
  await page.getByRole('option', { name: /GPT-4o/i }).click()
  await page.locator('#kinFormName').click()
  await pause(page, 500)

  await page.getByRole('button', { name: 'Create Kin' }).click()
  await expect(page.getByText('Chef Claude').first()).toBeVisible({ timeout: 15_000 })
  await pause(page, 2000)

  // ── Open Chat ──
  await page.getByText('Chef Claude').first().click()
  const messageInput = page.getByPlaceholder('Send a message...')
  await expect(messageInput).toBeVisible({ timeout: 10_000 })
  await pause(page, 1500)

  // ── Type and send a message ──
  await messageInput.click()
  await messageInput.pressSequentially('What are the best herbs for Italian cooking?', {
    delay: 55,
  })
  await pause(page, 800)

  await page.locator('button:has(svg.lucide-send-horizontal)').click()
  await expect(
    page.locator('text=What are the best herbs').first(),
  ).toBeVisible({ timeout: 10_000 })
  await pause(page, 1000)

  // Wait for mock LLM response to stream in
  await expect(
    page.locator('text=Fresh basil').first(),
  ).toBeVisible({ timeout: 15_000 })
  await pause(page, 3000)

  // ── Final pause on the chat view ──
  await pause(page, 2000)
})
