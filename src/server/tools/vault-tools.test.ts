import { describe, it, expect, beforeEach, mock } from 'bun:test'
import type { ToolExecutionContext } from '@/server/tools/types'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockVault = {
  getSecretValue: mock(() => Promise.resolve(null as string | null)),
  redactMessage: mock(() => Promise.resolve(false)),
  createSecret: mock(() => Promise.resolve({ id: 'sec-1', key: 'TEST_KEY' })),
  getSecretByKey: mock(() => Promise.resolve(null as any)),
  updateSecretValueByKey: mock(() => Promise.resolve(null as any)),
  deleteSecret: mock(() => Promise.resolve(false)),
  searchSecrets: mock(() => Promise.resolve([] as any[])),
  findMessageByContent: mock(() => Promise.resolve(null as string | null)),
  getEntryValue: mock(() => Promise.resolve(null as any)),
  createEntry: mock(() => Promise.resolve({ id: 'ent-1', key: 'TEST', entryType: 'text' })),
  getAttachment: mock(() => Promise.resolve(null as any)),
}

const mockVaultTypes = {
  createType: mock(() => Promise.resolve({ id: 'type-1', slug: 'wifi', name: 'WiFi' })),
}

mock.module('@/server/services/vault', () => mockVault)
mock.module('@/server/services/vault-types', () => mockVaultTypes)
mock.module('@/server/logger', () => ({
  createLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
}))

// Import after mocks
const {
  getSecretTool,
  redactMessageTool,
  createSecretTool,
  updateSecretTool,
  deleteSecretTool,
  searchSecretsTool,
  getVaultEntryTool,
  createVaultEntryTool,
  createVaultTypeTool,
  getVaultAttachmentTool,
} = await import('@/server/tools/vault-tools')

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ctx: ToolExecutionContext = { kinId: 'kin-abc', isSubKin: false }

function execute(registration: any, args: any) {
  const t = registration.create(ctx)
  return t.execute(args, { toolCallId: 'tc-1', messages: [], abortSignal: new AbortController().signal })
}

function resetMocks() {
  Object.values(mockVault).forEach((m) => m.mockReset())
  Object.values(mockVaultTypes).forEach((m) => m.mockReset())
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('vault-tools', () => {
  beforeEach(resetMocks)

  // ── Availability ──────────────────────────────────────────────────────────

  describe('availability', () => {
    it('all vault tools are main-only', () => {
      const tools = [
        getSecretTool, redactMessageTool, createSecretTool, updateSecretTool,
        deleteSecretTool, searchSecretsTool, getVaultEntryTool, createVaultEntryTool,
        createVaultTypeTool, getVaultAttachmentTool,
      ]
      for (const t of tools) {
        expect(t.availability).toEqual(['main'])
      }
    })
  })

  // ── get_secret ────────────────────────────────────────────────────────────

  describe('get_secret', () => {
    it('returns value when secret exists', async () => {
      mockVault.getSecretValue.mockResolvedValueOnce('s3cr3t')
      const result = await execute(getSecretTool, { key: 'MY_KEY' })
      expect(result).toEqual({ value: 's3cr3t' })
      expect(mockVault.getSecretValue).toHaveBeenCalledWith('MY_KEY')
    })

    it('returns error when secret not found', async () => {
      mockVault.getSecretValue.mockResolvedValueOnce(null)
      const result = await execute(getSecretTool, { key: 'NOPE' })
      expect(result).toEqual({ error: 'Secret not found' })
    })
  })

  // ── redact_message ────────────────────────────────────────────────────────

  describe('redact_message', () => {
    it('returns success when message redacted', async () => {
      mockVault.redactMessage.mockResolvedValueOnce(true)
      const result = await execute(redactMessageTool, { message_id: 'msg-1', redacted_text: '[REDACTED]' })
      expect(result).toEqual({ success: true })
      expect(mockVault.redactMessage).toHaveBeenCalledWith('msg-1', 'kin-abc', '[REDACTED]')
    })

    it('returns error when message not found', async () => {
      mockVault.redactMessage.mockResolvedValueOnce(false)
      const result = await execute(redactMessageTool, { message_id: 'msg-x', redacted_text: '[REDACTED]' })
      expect(result).toEqual({ error: 'Message not found' })
    })
  })

  // ── create_secret ─────────────────────────────────────────────────────────

  describe('create_secret', () => {
    it('creates secret when key does not exist', async () => {
      mockVault.getSecretByKey.mockResolvedValueOnce(null)
      mockVault.createSecret.mockResolvedValueOnce({ id: 'sec-new', key: 'NEW_KEY' })
      const result = await execute(createSecretTool, { key: 'NEW_KEY', value: 'val', description: 'desc' })
      expect(result).toEqual({ id: 'sec-new', key: 'NEW_KEY' })
      expect(mockVault.createSecret).toHaveBeenCalledWith('NEW_KEY', 'val', 'kin-abc', 'desc')
    })

    it('returns error when key already exists', async () => {
      mockVault.getSecretByKey.mockResolvedValueOnce({ id: 'sec-old', key: 'DUP' })
      const result = await execute(createSecretTool, { key: 'DUP', value: 'val' })
      expect(result).toEqual({ error: 'Secret with key "DUP" already exists. Use update_secret to change its value.' })
      expect(mockVault.createSecret).not.toHaveBeenCalled()
    })
  })

  // ── update_secret ─────────────────────────────────────────────────────────

  describe('update_secret', () => {
    it('updates secret when key exists', async () => {
      mockVault.updateSecretValueByKey.mockResolvedValueOnce({ id: 'sec-1' })
      const result = await execute(updateSecretTool, { key: 'KEY', value: 'new-val' })
      expect(result).toEqual({ id: 'sec-1', key: 'KEY' })
    })

    it('returns error when key not found', async () => {
      mockVault.updateSecretValueByKey.mockResolvedValueOnce(null)
      const result = await execute(updateSecretTool, { key: 'MISSING', value: 'v' })
      expect(result).toEqual({ error: 'Secret with key "MISSING" not found' })
    })
  })

  // ── delete_secret ─────────────────────────────────────────────────────────

  describe('delete_secret', () => {
    it('deletes secret owned by this kin', async () => {
      mockVault.getSecretByKey.mockResolvedValueOnce({ id: 'sec-1', createdByKinId: 'kin-abc' })
      mockVault.deleteSecret.mockResolvedValueOnce(true)
      const result = await execute(deleteSecretTool, { key: 'MY_SECRET' })
      expect(result).toEqual({ success: true, key: 'MY_SECRET' })
      expect(mockVault.deleteSecret).toHaveBeenCalledWith('sec-1')
    })

    it('returns error when secret not found', async () => {
      mockVault.getSecretByKey.mockResolvedValueOnce(null)
      const result = await execute(deleteSecretTool, { key: 'NOPE' })
      expect(result).toEqual({ error: 'Secret with key "NOPE" not found' })
    })

    it('refuses to delete secret owned by another kin', async () => {
      mockVault.getSecretByKey.mockResolvedValueOnce({ id: 'sec-2', createdByKinId: 'kin-other' })
      const result = await execute(deleteSecretTool, { key: 'THEIR_SECRET' })
      expect(result).toEqual({ error: 'Cannot delete this secret — it was not created by this Kin' })
      expect(mockVault.deleteSecret).not.toHaveBeenCalled()
    })

    it('returns error when deleteSecret fails', async () => {
      mockVault.getSecretByKey.mockResolvedValueOnce({ id: 'sec-1', createdByKinId: 'kin-abc' })
      mockVault.deleteSecret.mockResolvedValueOnce(false)
      const result = await execute(deleteSecretTool, { key: 'FAIL' })
      expect(result).toEqual({ error: 'Failed to delete secret' })
    })
  })

  // ── search_secrets ────────────────────────────────────────────────────────

  describe('search_secrets', () => {
    it('returns matching secrets', async () => {
      const secrets = [{ key: 'GH_TOKEN', description: 'GitHub' }]
      mockVault.searchSecrets.mockResolvedValueOnce(secrets)
      const result = await execute(searchSecretsTool, { query: 'github' })
      expect(result).toEqual({ secrets })
    })

    it('returns empty array when no matches', async () => {
      mockVault.searchSecrets.mockResolvedValueOnce([])
      const result = await execute(searchSecretsTool, { query: 'zzz' })
      expect(result).toEqual({ secrets: [] })
    })
  })

  // ── get_vault_entry ───────────────────────────────────────────────────────

  describe('get_vault_entry', () => {
    it('returns entry value when found', async () => {
      mockVault.getSecretByKey.mockResolvedValueOnce({ id: 'sec-1' })
      mockVault.getEntryValue.mockResolvedValueOnce({ entryType: 'credential', value: { user: 'a' } })
      const result = await execute(getVaultEntryTool, { key: 'CRED' })
      expect(result).toEqual({ entryType: 'credential', fields: { user: 'a' } })
    })

    it('returns error when key not found', async () => {
      mockVault.getSecretByKey.mockResolvedValueOnce(null)
      const result = await execute(getVaultEntryTool, { key: 'NOPE' })
      expect(result).toEqual({ error: 'Entry not found' })
    })

    it('returns error when entry value not found', async () => {
      mockVault.getSecretByKey.mockResolvedValueOnce({ id: 'sec-1' })
      mockVault.getEntryValue.mockResolvedValueOnce(null)
      const result = await execute(getVaultEntryTool, { key: 'ORPHAN' })
      expect(result).toEqual({ error: 'Entry not found' })
    })
  })

  // ── create_vault_entry ────────────────────────────────────────────────────

  describe('create_vault_entry', () => {
    it('creates entry when key is new', async () => {
      mockVault.getSecretByKey.mockResolvedValueOnce(null)
      mockVault.createEntry.mockResolvedValueOnce({ id: 'ent-1', key: 'WIFI_HOME', entryType: 'wifi' })
      const result = await execute(createVaultEntryTool, {
        key: 'WIFI_HOME', entry_type: 'wifi', value: { ssid: 'Home' },
      })
      expect(result).toEqual({ id: 'ent-1', key: 'WIFI_HOME', entryType: 'wifi' })
    })

    it('returns error when key already exists', async () => {
      mockVault.getSecretByKey.mockResolvedValueOnce({ id: 'sec-old' })
      const result = await execute(createVaultEntryTool, {
        key: 'DUP', entry_type: 'text', value: 'v',
      })
      expect(result).toEqual({ error: 'Entry with key "DUP" already exists' })
    })
  })

  // ── create_vault_type ─────────────────────────────────────────────────────

  describe('create_vault_type', () => {
    it('creates a custom type', async () => {
      mockVaultTypes.createType.mockResolvedValueOnce({ id: 'type-1', slug: 'wifi', name: 'WiFi' })
      const result = await execute(createVaultTypeTool, {
        name: 'WiFi', slug: 'wifi', icon: 'Wifi',
        fields: [{ name: 'ssid', label: 'SSID', type: 'text', required: true }],
      })
      expect(result).toEqual({ id: 'type-1', slug: 'wifi', name: 'WiFi' })
    })

    it('returns error on failure', async () => {
      mockVaultTypes.createType.mockRejectedValueOnce(new Error('Slug taken'))
      const result = await execute(createVaultTypeTool, {
        name: 'WiFi', slug: 'wifi', fields: [],
      })
      expect(result).toEqual({ error: 'Slug taken' })
    })

    it('handles non-Error throws', async () => {
      mockVaultTypes.createType.mockRejectedValueOnce('boom')
      const result = await execute(createVaultTypeTool, {
        name: 'X', slug: 'x', fields: [],
      })
      expect(result).toEqual({ error: 'Failed to create type' })
    })
  })

  // ── get_vault_attachment ──────────────────────────────────────────────────

  describe('get_vault_attachment', () => {
    it('returns base64 data when attachment found', async () => {
      const data = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
      mockVault.getAttachment.mockResolvedValueOnce({ name: 'file.txt', mimeType: 'text/plain', data })
      const result = await execute(getVaultAttachmentTool, { attachment_id: 'att-1' })
      expect(result.name).toBe('file.txt')
      expect(result.mimeType).toBe('text/plain')
      expect(result.size).toBe(5)
      expect(result.base64).toBe(btoa('Hello'))
    })

    it('returns error when attachment not found', async () => {
      mockVault.getAttachment.mockResolvedValueOnce(null)
      const result = await execute(getVaultAttachmentTool, { attachment_id: 'att-x' })
      expect(result).toEqual({ error: 'Attachment not found' })
    })
  })
})
