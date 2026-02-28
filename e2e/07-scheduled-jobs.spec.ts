import { test, expect, type Page } from '@playwright/test'
import { loginAs, mockProviderModels } from './helpers/auth'

/**
 * Mock cron-related API routes to avoid real LLM calls.
 */
async function mockCronApis(page: Page) {
  // Mock any execution-related endpoints
  await page.route('**/api/crons/*/execute', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
    }
    return route.continue()
  })
}

/**
 * Open the "Create scheduled job" modal via the sidebar plus button.
 */
async function openCreateJobModal(page: Page) {
  // The Scheduled Jobs section has a plus button with title="New job"
  const plusBtn = page.getByTitle('New job')
  await plusBtn.click()

  // Wait for the create modal
  await expect(page.getByText('Create scheduled job')).toBeVisible({ timeout: 5_000 })
}

/**
 * Fill and submit the create job form.
 */
async function createJob(
  page: Page,
  opts: { name: string; schedule: string; instructions: string; preset?: string },
) {
  await openCreateJobModal(page)

  // Fill name
  await page.getByPlaceholder('e.g. Daily report, Weekly cleanup...').fill(opts.name)

  // Select Kin (pick first available)
  const kinCombobox = page.locator('[role="combobox"]').filter({ hasText: /select a kin/i })
  if (await kinCombobox.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await kinCombobox.click()
    await page.getByRole('option').first().click()
  }

  // Fill schedule - use preset or manual
  if (opts.preset) {
    await page.getByRole('button', { name: opts.preset }).click()
  } else {
    await page.getByPlaceholder('e.g. 0 9 * * *').fill(opts.schedule)
  }

  // Fill task instructions (CodeMirror markdown editor)
  // CodeMirror uses contenteditable .cm-content — click and use keyboard shortcuts to fill
  const cmContent = page.locator('.cm-content[contenteditable="true"]').first()
  await cmContent.click()
  // Select all existing content and replace it
  await page.keyboard.press('Control+a')
  await page.keyboard.insertText(opts.instructions)

  // Submit
  await page.getByRole('button', { name: /create job/i }).click()

  // Wait for modal to close and job to appear in sidebar
  await expect(page.getByText(opts.name).first()).toBeVisible({ timeout: 10_000 })
}

test.describe.serial('Scheduled jobs management', () => {
  test.beforeEach(async ({ page }) => {
    await mockProviderModels(page)
    await mockCronApis(page)

    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible({ timeout: 10_000 })
    await loginAs(page)
    await expect(page.getByText('Kins', { exact: true })).toBeVisible({ timeout: 10_000 })
  })

  test('should see empty scheduled jobs section in sidebar', async ({ page }) => {
    // The scheduled jobs section should be visible
    await expect(page.getByText('Scheduled Jobs', { exact: true })).toBeVisible({ timeout: 5_000 })

    // Should show empty state
    await expect(page.getByText('No scheduled jobs')).toBeVisible({ timeout: 5_000 })
  })

  test('should open create job modal', async ({ page }) => {
    await openCreateJobModal(page)

    // Verify form fields are present
    await expect(page.getByPlaceholder('e.g. Daily report, Weekly cleanup...')).toBeVisible()
    await expect(page.getByPlaceholder('e.g. 0 9 * * *')).toBeVisible()
    await expect(page.getByText('Owner Kin')).toBeVisible()
    await expect(page.getByText('Task instructions')).toBeVisible()
  })

  test('should create a scheduled job with manual cron expression', async ({ page }) => {
    await createJob(page, {
      name: 'Daily Report Job',
      schedule: '0 9 * * *',
      instructions: 'Generate a daily summary report of all activities.',
    })

    // Verify the job appears in the sidebar
    await expect(page.getByText('Daily Report Job')).toBeVisible()
  })

  test('should create a second job using a preset schedule', async ({ page }) => {
    await createJob(page, {
      name: 'Hourly Check Job',
      schedule: '',
      instructions: 'Check system health and report any issues.',
      preset: 'Hourly',
    })

    await expect(page.getByText('Hourly Check Job')).toBeVisible()
  })

  test('should open job detail modal by clicking on a job', async ({ page }) => {
    // Click on the first job
    const jobCard = page.locator('[role="button"]', { hasText: 'Daily Report Job' }).first()
    await jobCard.click()

    // Detail modal should open — title is the job name
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 5_000 })
    await expect(dialog.getByText('Generate a daily summary report')).toBeVisible()

    // Close the detail modal
    const closeBtn = dialog.getByRole('button', { name: /close/i })
    if (await closeBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await closeBtn.click()
    } else {
      await page.keyboard.press('Escape')
    }
  })

  test('should edit a scheduled job', async ({ page }) => {
    // Click on the job to open detail
    const jobCard = page.locator('[role="button"]', { hasText: 'Daily Report Job' }).first()
    await jobCard.click()
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    // Click edit button in the detail modal
    const editBtn = dialog.getByRole('button', { name: /edit/i }).first()
    await editBtn.click()

    // Should switch to edit form
    await expect(page.getByText('Edit scheduled job')).toBeVisible({ timeout: 5_000 })

    // Change the name
    const nameInput = page.getByPlaceholder('e.g. Daily report, Weekly cleanup...')
    await nameInput.clear()
    await nameInput.fill('Updated Daily Report')

    // Save
    await page.getByRole('button', { name: /save changes/i }).click()

    // Verify updated name
    await expect(page.getByText('Updated Daily Report')).toBeVisible({ timeout: 10_000 })
  })

  test('should toggle job active state', async ({ page }) => {
    // Find the switch/toggle for the job
    const jobCard = page.locator('div', { hasText: 'Updated Daily Report' }).first()
    const toggle = jobCard.locator('[role="switch"]').first()

    if (await toggle.isVisible({ timeout: 2_000 }).catch(() => false)) {
      const wasChecked = await toggle.getAttribute('aria-checked')
      await toggle.click()

      // Wait for state to update (API call + re-render)
      const expectedState = wasChecked === 'true' ? 'false' : 'true'
      await expect(toggle).toHaveAttribute('aria-checked', expectedState, { timeout: 5_000 })

      // Toggle back
      await toggle.click()
    }
  })

  test('should delete the hourly job with confirmation', async ({ page }) => {
    // Open job detail
    const jobCard = page.locator('[role="button"]', { hasText: 'Hourly Check Job' }).first()
    await jobCard.click()
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    // Click edit to access delete
    const editBtn = dialog.getByRole('button', { name: /edit/i }).first()
    await editBtn.click()
    await expect(page.getByText('Edit scheduled job')).toBeVisible({ timeout: 5_000 })

    // Click delete
    const deleteBtn = page.getByRole('button', { name: /delete job/i })
    await deleteBtn.click()

    // Confirm deletion
    const confirmBtn = page.getByRole('button', { name: /delete permanently/i })
    if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmBtn.click()
    }

    // Job should disappear
    await expect(page.getByText('Hourly Check Job')).not.toBeVisible({ timeout: 10_000 })
  })

  test('should delete the remaining job for cleanup', async ({ page }) => {
    const jobCard = page.locator('[role="button"]', { hasText: 'Updated Daily Report' }).first()
    await jobCard.click()
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    const editBtn = dialog.getByRole('button', { name: /edit/i }).first()
    await editBtn.click()
    await expect(page.getByText('Edit scheduled job')).toBeVisible({ timeout: 5_000 })

    const deleteBtn = page.getByRole('button', { name: /delete job/i })
    await deleteBtn.click()

    const confirmBtn = page.getByRole('button', { name: /delete permanently/i })
    if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmBtn.click()
    }

    await expect(page.getByText('Updated Daily Report')).not.toBeVisible({ timeout: 10_000 })

    // Should be back to empty state
    await expect(page.getByText('No scheduled jobs')).toBeVisible({ timeout: 5_000 })
  })
})
