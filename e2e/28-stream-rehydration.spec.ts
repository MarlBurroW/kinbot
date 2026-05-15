import { test, expect, type Page } from '@playwright/test'
import { loginAs, mockProviderModels } from './helpers/auth'

/**
 * Regression spec for ticket kinbot#19 — "Problème de reprise de streaming
 * sur le main thread".
 *
 * Scenario:
 *   1. Send a message to a Kin in its main conversation.
 *   2. While the assistant is still streaming tokens, navigate away
 *      (Projects page).
 *   3. Navigate back to the conversation BEFORE chat:done fires.
 *   4. Expectation: the partial assistant bubble is visible immediately
 *      (rehydrated from GET /api/kins/:id/messages's `streamingMessage`
 *      snapshot). Pre-fix behaviour showed only the "Réflexion…" /
 *      typing indicator until chat:done landed.
 *
 * Server-side: relies on E2E_MOCK_LLM=true (configured in
 * playwright.config.js) emitting a deterministic ~30-token response
 * with a per-token delay so the navigate-away has time to happen.
 */

const ASSISTANT_PHRASE = 'Fresh basil'
const USER_MESSAGE = 'Tell me about Italian cooking herbs.'

async function openKinChat(page: Page) {
  await page.getByText('Test Assistant').first().click()
  const input = page.getByPlaceholder('Send a message...')
  await expect(input).toBeVisible({ timeout: 10_000 })
  return input
}

test.describe.serial('Main-thread stream rehydration', () => {
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

  test('partial assistant bubble survives a navigate-away mid-stream', async ({ page }) => {
    const input = await openKinChat(page)

    // Send a fresh prompt — the mock LLM will start streaming back the
    // canned response at the configured token delay.
    await input.fill(USER_MESSAGE)
    await page.keyboard.press('Enter')
    await expect(page.getByText(USER_MESSAGE).first()).toBeVisible({ timeout: 10_000 })

    // Wait for the first assistant token to land, so we know a stream is
    // genuinely in-flight before we navigate away. The phrase "Fresh basil"
    // appears about 200ms into the mock stream at 120ms per token.
    await expect(page.getByText(ASSISTANT_PHRASE).first()).toBeVisible({ timeout: 10_000 })

    // Navigate away to Projects (any non-chat page works — we just need to
    // unmount the ChatPanel so its streamingMessage state is wiped).
    await page.goto('/projects')
    await expect(page).toHaveURL(/\/projects/, { timeout: 5_000 })

    // Navigate back to the conversation. This remounts useChat /
    // useChatStreaming and triggers fetchMessages → seedStreaming().
    await page.getByText('Test Assistant').first().click()
    await expect(page.getByPlaceholder('Send a message...')).toBeVisible({ timeout: 10_000 })

    // ── Assertion ────────────────────────────────────────────────────────
    // The partial assistant bubble must be visible IMMEDIATELY after the
    // remount, NOT only once chat:done lands. Pre-fix this assertion would
    // have failed because the conversation showed only the typing indicator
    // until the stream completed.
    await expect(page.getByText(ASSISTANT_PHRASE).first()).toBeVisible({ timeout: 2_000 })

    // Finally, the stream still completes cleanly and the persisted message
    // appears in place (no double bubble, same content).
    await expect(
      page.getByText('cornerstones of Italian cooking').first(),
    ).toBeVisible({ timeout: 10_000 })

    // Sanity: only ONE assistant bubble containing the phrase — the seeded
    // streaming bubble should have been replaced in-place, not duplicated.
    await expect(page.getByText(ASSISTANT_PHRASE)).toHaveCount(1)
  })
})
