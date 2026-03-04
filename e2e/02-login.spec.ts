import { test, expect } from '@playwright/test'
import { loginAs, TEST_USER } from './helpers/auth'

test.describe.serial('Login flow', () => {
  test('successful login', async ({ page }) => {
    // Onboarding already completed by 01-onboarding, so we should see login page
    await page.goto('/')

    await expect(page.getByText('Sign in to your KinBot workspace')).toBeVisible({ timeout: 10_000 })

    // Verify login page renders correctly before logging in
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    await expect(page.getByText('Forgot your password?')).toBeVisible()

    await loginAs(page)

    // Should redirect to main app after login
    await expect(page.getByText('Kins', { exact: true })).toBeVisible({ timeout: 10_000 })
  })

  test('session persists after page reload', async ({ page }) => {
    // Login first
    await page.goto('/')
    await expect(page.getByText('Sign in to your KinBot workspace')).toBeVisible({ timeout: 10_000 })
    await loginAs(page)
    await expect(page.getByText('Kins', { exact: true })).toBeVisible({ timeout: 10_000 })

    // Reload the page
    await page.reload()

    // Should still be in the app, not redirected to login
    await expect(page.getByText('Kins', { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Sign in to your KinBot workspace')).not.toBeVisible()
  })

  test('logout redirects to login page', async ({ page }) => {
    // Login first
    await page.goto('/')
    await expect(page.getByText('Sign in to your KinBot workspace')).toBeVisible({ timeout: 10_000 })
    await loginAs(page)
    await expect(page.getByText('Kins', { exact: true })).toBeVisible({ timeout: 10_000 })

    // Open user menu (avatar button showing initials "TU" for Test User)
    await page.locator('button:has([data-slot="avatar"])').first().click()

    // Click Sign out
    await page.getByText('Sign out').click()

    // Should be back on login page
    await expect(page.getByText('Sign in to your KinBot workspace')).toBeVisible({ timeout: 10_000 })
  })

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/')

    await expect(page.getByText('Sign in to your KinBot workspace')).toBeVisible({ timeout: 10_000 })

    // Fill with wrong password
    await loginAs(page, TEST_USER.email, 'WrongPassword123!')

    // Should show error message
    await expect(page.getByText('Invalid email or password')).toBeVisible({ timeout: 5_000 })

    // Should still be on login page
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  test('login with non-existent email shows error', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/')

    await expect(page.getByText('Sign in to your KinBot workspace')).toBeVisible({ timeout: 10_000 })

    await loginAs(page, 'nobody@kinbot.local', 'SomePassword123!')

    await expect(page.getByText('Invalid email or password')).toBeVisible({ timeout: 5_000 })
  })

  test('error clears when retrying login', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/')

    await expect(page.getByText('Sign in to your KinBot workspace')).toBeVisible({ timeout: 10_000 })

    // First attempt: wrong password
    await loginAs(page, TEST_USER.email, 'WrongPassword123!')
    await expect(page.getByText('Invalid email or password')).toBeVisible({ timeout: 5_000 })

    // Second attempt: correct password - error should clear
    await page.fill('#email', TEST_USER.email)
    await page.fill('#password', TEST_USER.password)
    await page.getByRole('button', { name: 'Sign in' }).click()

    // Should succeed and redirect
    await expect(page.getByText('Kins', { exact: true })).toBeVisible({ timeout: 10_000 })
  })

  test('cleared cookies force re-login', async ({ page }) => {
    // Login first
    await page.goto('/')
    await expect(page.getByText('Sign in to your KinBot workspace')).toBeVisible({ timeout: 10_000 })
    await loginAs(page)
    await expect(page.getByText('Kins', { exact: true })).toBeVisible({ timeout: 10_000 })

    // Clear cookies (simulates session expiry)
    await page.context().clearCookies()
    await page.reload()

    // Should be redirected to login
    await expect(page.getByText('Sign in to your KinBot workspace')).toBeVisible({ timeout: 10_000 })
  })
})
