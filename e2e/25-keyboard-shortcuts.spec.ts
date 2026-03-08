import { test, expect, type Page } from '@playwright/test'
import { loginAs, mockProviderModels } from './helpers/auth'

/** Press ? key by clicking body first to defocus inputs, then typing '?' */
async function pressQuestionMark(page: Page) {
  await page.locator('body').click()
  await page.keyboard.type('?')
}

/** Open the shortcuts dialog and return the dialog locator */
async function openShortcutsDialog(page: Page) {
  await pressQuestionMark(page)
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 3_000 })
  return dialog
}

test.describe('Keyboard shortcuts dialog', () => {
  test.describe.configure({ mode: 'serial' })

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

  test('open shortcuts dialog with ? key', async ({ page }) => {
    const dialog = await openShortcutsDialog(page)
    await expect(dialog.getByRole('heading', { name: 'Keyboard Shortcuts' })).toBeVisible()
  })

  test('shows navigation shortcuts group', async ({ page }) => {
    const dialog = await openShortcutsDialog(page)
    await expect(dialog.getByText('Navigation')).toBeVisible()
    await expect(dialog.getByText('Command palette')).toBeVisible()
    await expect(dialog.getByText('Toggle sidebar')).toBeVisible()
    await expect(dialog.getByText('Open settings')).toBeVisible()
    await expect(dialog.getByText('Show keyboard shortcuts')).toBeVisible()
  })

  test('shows kins shortcuts group', async ({ page }) => {
    const dialog = await openShortcutsDialog(page)
    await expect(dialog.getByText('Kins')).toBeVisible()
    await expect(dialog.getByText('Switch to Kin by position')).toBeVisible()
    await expect(dialog.getByText('Create new Kin')).toBeVisible()
  })

  test('shows chat shortcuts group', async ({ page }) => {
    const dialog = await openShortcutsDialog(page)
    await expect(dialog.getByText('Chat', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Send message')).toBeVisible()
    await expect(dialog.getByText('New line')).toBeVisible()
    await expect(dialog.getByText('Focus message input')).toBeVisible()
    await expect(dialog.getByText('Search in conversation')).toBeVisible()
    await expect(dialog.getByText('Browse sent messages')).toBeVisible()
  })

  test('shows formatting shortcuts group', async ({ page }) => {
    const dialog = await openShortcutsDialog(page)
    await expect(dialog.getByText('Text Formatting')).toBeVisible()
    await expect(dialog.getByText('Bold')).toBeVisible()
    await expect(dialog.getByText('Italic')).toBeVisible()
    await expect(dialog.getByText('Inline code')).toBeVisible()
    await expect(dialog.getByText('Code block')).toBeVisible()
    await expect(dialog.getByText('Strikethrough')).toBeVisible()
  })

  test('shows keyboard key badges', async ({ page }) => {
    const dialog = await openShortcutsDialog(page)
    const kbds = dialog.locator('kbd')
    const count = await kbds.count()
    expect(count).toBeGreaterThan(10)
    await expect(dialog.locator('kbd', { hasText: 'Ctrl' }).first()).toBeVisible()
    await expect(dialog.locator('kbd', { hasText: 'Enter' }).first()).toBeVisible()
    await expect(dialog.locator('kbd', { hasText: 'Esc' }).first()).toBeVisible()
  })

  test('close dialog with Escape key', async ({ page }) => {
    const dialog = await openShortcutsDialog(page)
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible({ timeout: 3_000 })
  })

  test('toggle dialog open and closed with ? key', async ({ page }) => {
    // Open
    const dialog = await openShortcutsDialog(page)
    // Close with ? again
    await pressQuestionMark(page)
    await expect(dialog).not.toBeVisible({ timeout: 3_000 })
  })

  test('does not open when typing in an input', async ({ page }) => {
    // Click on a kin first to get the chat input visible
    const kinLink = page.locator('[data-testid="kin-link"]').first()
    const hasKin = await kinLink.isVisible({ timeout: 3_000 }).catch(() => false)
    if (!hasKin) {
      test.skip()
      return
    }
    await kinLink.click()
    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 5_000 })
    await textarea.click()
    await textarea.focus()
    await page.keyboard.type('?')
    const dialog = page.getByRole('dialog')
    await expect(dialog).not.toBeVisible({ timeout: 1_500 })
  })

  test('shows hint text at bottom', async ({ page }) => {
    const dialog = await openShortcutsDialog(page)
    // "Press ? anywhere to show this dialog"
    await expect(dialog.getByText('Press ? anywhere to show this dialog')).toBeVisible()
  })
})
