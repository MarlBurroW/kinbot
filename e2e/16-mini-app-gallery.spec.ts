import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

// ─── Tests ──────────────────────────────────────────────────────────────────
// The gallery dialog UI was removed (apps are shown inline in the sidebar).
// Only the sidebar-level Mini-Apps tests remain.

test.describe.serial('Mini App Gallery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await loginAs(page)
    await page.waitForSelector('[data-sidebar="sidebar"]', { timeout: 10000 })
  })

  test('should show Mini-Apps section in Apps tab', async ({ page }) => {
    // Navigate to Mini-Apps tab
    const appsTab = page.getByRole('tab', { name: 'Mini-Apps' })
    await appsTab.click()

    // The tab content should be visible (Mini-Apps list renders inline)
    await expect(appsTab).toHaveAttribute('data-state', 'active')
  })

  test('should show Mini-Apps empty state in sidebar when no apps exist', async ({ page }) => {
    // Navigate to Mini-Apps tab
    const appsTab = page.getByRole('tab', { name: 'Mini-Apps' })
    await appsTab.click()

    // The empty state text depends on whether a Kin is selected:
    // - With a Kin selected: "No apps yet" / "Ask a Kin to create one"
    // - Without a Kin selected: "Select a Kin" / "Select a Kin to see its mini-apps"
    const noAppsYet = page.getByText('No apps yet')
    const selectAKin = page.getByText('Select a Kin', { exact: true })

    // One of the two empty states should be visible
    await expect(noAppsYet.or(selectAKin)).toBeVisible({ timeout: 5000 })
  })
})
