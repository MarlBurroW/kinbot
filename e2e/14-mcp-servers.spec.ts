import { test, expect, type Page } from '@playwright/test'
import { loginAs, mockProviderModels } from './helpers/auth'

/**
 * Open Settings dialog and navigate to the MCP Servers section.
 */
async function openMcpSettings(page: Page) {
  await page.locator('button:has(.lucide-settings-2)').click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })

  await page.getByRole('dialog').getByText('MCP Servers', { exact: true }).click()
  await expect(
    page.getByText('Manage Model Context Protocol servers that provide external tools to your Kins.'),
  ).toBeVisible({ timeout: 5_000 })
}

/**
 * Mock MCP server API routes so no real processes are spawned.
 */
async function mockMcpApis(page: Page) {
  // Mock approve endpoint
  await page.route('**/api/mcp-servers/*/approve', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
    }
    return route.continue()
  })
}

test.describe.serial('MCP server management', () => {
  test.beforeEach(async ({ page }) => {
    await mockProviderModels(page)
    await mockMcpApis(page)

    await page.goto('/')
    await expect(page.getByText('Sign in to your KinBot workspace')).toBeVisible({ timeout: 10_000 })
    await loginAs(page)
    await expect(page.getByText('Kins', { exact: true })).toBeVisible({ timeout: 10_000 })
  })

  test('should clean up any existing MCP servers and show empty state', async ({ page }) => {
    await openMcpSettings(page)

    // Delete any leftover MCP servers from prior runs
    const dialog = page.getByRole('dialog')
    let deleteButton = dialog.locator('button:has(.lucide-trash-2, .lucide-trash)').first()
    while (await deleteButton.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await deleteButton.click()
      // Confirm deletion
      const confirmBtn = page.getByRole('button', { name: 'Delete' })
      if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await confirmBtn.click()
      }
      await page.waitForTimeout(500)
      deleteButton = dialog.locator('button:has(.lucide-trash-2, .lucide-trash)').first()
    }

    await expect(page.getByText('No MCP servers configured')).toBeVisible({ timeout: 5_000 })
    await expect(
      page.getByText('MCP servers extend your Kins with external tools and data sources.'),
    ).toBeVisible()
  })

  test('should add an MCP server with name and command', async ({ page }) => {
    await openMcpSettings(page)

    // Click "Add MCP server" from empty state
    await page.getByRole('button', { name: 'Add MCP server' }).first().click()

    // Form dialog should appear
    await expect(page.locator('#mcp-name')).toBeVisible({ timeout: 5_000 })

    await page.fill('#mcp-name', 'E2E GitHub Server')
    await page.fill('#mcp-command', 'npx')

    // Add arguments
    await page.fill('#mcp-args', '-y\n@modelcontextprotocol/server-github')

    // Submit
    await page.getByRole('button', { name: 'Add MCP server' }).last().click()

    // Server should appear in list with Active badge
    await expect(page.getByText('E2E GitHub Server').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Active')).toBeVisible()
    await expect(page.getByText('npx -y @modelcontextprotocol/server-github')).toBeVisible()
  })

  test('should add a second MCP server with environment variables', async ({ page }) => {
    await openMcpSettings(page)

    // Click bottom "Add MCP server" button
    await page.getByRole('button', { name: 'Add MCP server' }).last().click()
    await expect(page.locator('#mcp-name')).toBeVisible({ timeout: 5_000 })

    await page.fill('#mcp-name', 'E2E Filesystem Server')
    await page.fill('#mcp-command', '/usr/local/bin/mcp-fs')

    // Add an environment variable
    await page.getByRole('button', { name: 'Add variable' }).click()

    // Fill env key and value
    const dialog = page.getByRole('dialog')
    const envKeyInput = dialog.locator('input[placeholder="KEY"]')
    const envValueInput = dialog.locator('input[placeholder="value"]')
    await envKeyInput.fill('ALLOWED_PATHS')
    await envValueInput.fill('/home/data')

    // Submit
    await page.getByRole('button', { name: 'Add MCP server' }).last().click()

    // Server should appear
    await expect(page.getByText('E2E Filesystem Server').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('/usr/local/bin/mcp-fs')).toBeVisible()
    // Env key should be shown
    await expect(page.getByText('ALLOWED_PATHS')).toBeVisible()
  })

  test('should edit an MCP server name', async ({ page }) => {
    await openMcpSettings(page)

    // Click edit on first server
    const editButton = page.getByRole('dialog').locator('button:has(.lucide-pencil)').first()
    await expect(editButton).toBeVisible({ timeout: 5_000 })
    await editButton.click()

    // Edit form should open with pre-filled values
    await expect(page.locator('#mcp-name')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('#mcp-name')).toHaveValue('E2E GitHub Server')

    // Clear and rename
    await page.locator('#mcp-name').click({ clickCount: 3 })
    await page.locator('#mcp-name').fill('Renamed GitHub MCP')

    await page.getByRole('button', { name: 'Save' }).click()

    // Toast + updated name
    await expect(page.getByText(/updated/i).first()).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Renamed GitHub MCP').first()).toBeVisible({ timeout: 5_000 })
  })

  test('should edit an MCP server command and args', async ({ page }) => {
    await openMcpSettings(page)

    // Edit second server (Filesystem)
    const editButton = page.getByRole('dialog').locator('button:has(.lucide-pencil)').last()
    await expect(editButton).toBeVisible({ timeout: 5_000 })
    await editButton.click()

    await expect(page.locator('#mcp-command')).toBeVisible({ timeout: 5_000 })

    // Change command
    await page.locator('#mcp-command').click({ clickCount: 3 })
    await page.locator('#mcp-command').fill('/opt/bin/mcp-filesystem')

    // Add args
    await page.locator('#mcp-args').fill('--readonly\n--root /data')

    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText(/updated/i).first()).toBeVisible({ timeout: 5_000 })
  })

  test('should delete an MCP server with confirmation', async ({ page }) => {
    await openMcpSettings(page)

    // Delete the second server (last delete button)
    const deleteButton = page.getByRole('dialog').locator('button:has(.lucide-trash-2, .lucide-trash)').last()
    await expect(deleteButton).toBeVisible({ timeout: 5_000 })
    await deleteButton.click()

    // Confirmation dialog
    await expect(
      page.getByText('This will permanently remove this MCP server and disconnect it from all Kins.'),
    ).toBeVisible({ timeout: 5_000 })
    await page.getByRole('button', { name: 'Delete' }).click()

    // Toast
    await expect(page.getByText('MCP server deleted')).toBeVisible({ timeout: 5_000 })
  })

  test('should delete remaining server and return to empty state', async ({ page }) => {
    await openMcpSettings(page)

    const deleteButton = page.getByRole('dialog').locator('button:has(.lucide-trash-2, .lucide-trash)').first()
    await expect(deleteButton).toBeVisible({ timeout: 5_000 })
    await deleteButton.click()

    await expect(
      page.getByText('This will permanently remove this MCP server and disconnect it from all Kins.'),
    ).toBeVisible({ timeout: 5_000 })
    await page.getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByText('MCP server deleted')).toBeVisible({ timeout: 5_000 })

    // Empty state should return
    await expect(page.getByText('No MCP servers configured')).toBeVisible({ timeout: 5_000 })
  })
})
