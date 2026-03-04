import { test, expect } from '@playwright/test'
import { fillIdentityStep, mockProviderModels, TEST_USER } from './helpers/auth'

test.describe.serial('Onboarding flow', () => {
  test('should show step 1 identity form on fresh database', async ({ page }) => {
    await page.goto('/')

    // Should land on step 1
    await expect(page.getByText('Step 1 of 5')).toBeVisible()
    await expect(page.getByText('Your identity')).toBeVisible()

    // All required fields should be present
    await expect(page.locator('#firstName')).toBeVisible()
    await expect(page.locator('#lastName')).toBeVisible()
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#pseudonym')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.locator('#passwordConfirm')).toBeVisible()

    // Avatar area should be visible
    await expect(page.locator('button:has(.lucide-camera)')).toBeVisible()

    // Next button should be visible
    await expect(page.getByRole('button', { name: 'Next' })).toBeVisible()
  })

  test('should show avatar initials as user types name', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Step 1 of 5')).toBeVisible()

    // Type first and last name
    await page.fill('#firstName', 'Alice')
    await page.fill('#lastName', 'Bob')

    // Avatar fallback should show initials "AB"
    await expect(page.locator('[data-slot="avatar-fallback"]')).toContainText('AB')
  })

  test('should show error on password mismatch', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Step 1 of 5')).toBeVisible()

    await page.fill('#firstName', 'Test')
    await page.fill('#lastName', 'User')
    await page.fill('#email', 'mismatch@test.local')
    await page.fill('#pseudonym', 'mismatch')
    await page.fill('#password', 'Password123!')
    await page.fill('#passwordConfirm', 'DifferentPassword456!')

    await page.getByRole('button', { name: 'Next' }).click()

    // Should show password mismatch error (stays on step 1)
    await expect(page.getByText(/password/i).filter({ hasText: /match|mismatch/i })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Step 1 of 5')).toBeVisible()
  })

  test('completes full onboarding with back navigation', async ({ page }) => {
    // Mock provider models for steps 4-5
    await mockProviderModels(page)

    await page.goto('/')

    // ── Step 1: Identity ──
    await expect(page.getByText('Step 1 of 5')).toBeVisible()
    await fillIdentityStep(page)

    // ── Step 2: Preferences ──
    await expect(page.getByText('Step 2 of 5')).toBeVisible()
    await expect(page.getByText('Preferences')).toBeVisible()

    // Verify theme mode options are visible
    await expect(page.getByText('Light', { exact: true })).toBeVisible()
    await expect(page.getByText('Dark', { exact: true })).toBeVisible()
    await expect(page.getByText('System', { exact: true })).toBeVisible()

    // Back button should be visible on step 2
    await expect(page.getByRole('button', { name: 'Back' })).toBeVisible()

    // Click Next (preferences are optional)
    await page.getByRole('button', { name: 'Next' }).click()

    // ── Step 3: Providers ──
    await expect(page.getByText('Step 3 of 5')).toBeVisible()
    await expect(page.getByText('AI Providers')).toBeVisible()

    // LLM and Embedding should show "Missing" badges initially
    await expect(page.getByText('Missing').first()).toBeVisible()

    // Open the "Add a provider" dialog
    await page.getByRole('button', { name: 'Add a provider' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Select OpenAI provider type
    await page.locator('[data-slot="select-trigger"]').click()
    await page.getByRole('option', { name: /OpenAI/ }).click()

    // Fill API key
    await page.fill('#apiKey', 'sk-fake-e2e-test-key-1234567890')

    // Test connection
    await page.getByRole('button', { name: 'Test connection' }).click()
    await expect(page.getByText('Connection successful')).toBeVisible({ timeout: 10_000 })

    // Add provider
    await page.getByRole('button', { name: 'Add provider' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()

    // LLM and Embedding should now show "Covered"
    await expect(page.getByText('Covered').first()).toBeVisible()

    // Click Next
    await page.getByRole('button', { name: 'Next' }).click()

    // ── Step 4: Memory ──
    await expect(page.getByText('Step 4 of 5')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Memory' })).toBeVisible()

    // Test Back button from step 4 — should go to step 3
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.getByText('Step 3 of 5')).toBeVisible()

    // Go forward again
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByText('Step 4 of 5')).toBeVisible()

    // Click Next
    await page.getByRole('button', { name: 'Next' }).click()

    // ── Step 5: Search Providers ──
    await expect(page.getByText('Step 5 of 5')).toBeVisible()
    await expect(page.getByText('Search Providers')).toBeVisible()

    // Test Back button from step 5 — should go to step 4
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.getByText('Step 4 of 5')).toBeVisible()

    // Go forward again
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByText('Step 5 of 5')).toBeVisible()

    // Skip search providers
    await page.getByRole('button', { name: 'Skip for now' }).click()

    // ── Should land on main app ──
    await expect(page.getByText('Kins', { exact: true })).toBeVisible({ timeout: 10_000 })
  })

  test('should redirect to login after onboarding is complete', async ({ page }) => {
    // After onboarding, visiting / should show login (not onboarding again)
    await page.goto('/')

    // Should NOT show step 1 — should show login or main app
    await expect(page.getByText('Step 1 of 5')).not.toBeVisible({ timeout: 5_000 })

    // Should show the sign-in form (since we haven't logged in this browser context)
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible({ timeout: 5_000 })
  })
})
