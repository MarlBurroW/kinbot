import { describe, it, expect, beforeEach, mock } from 'bun:test'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockVault = {
  getSecretValue: mock((_key: string) => Promise.resolve(null as string | null)),
  getSecretByKey: mock((_key: string) => Promise.resolve(null as { id: string; key: string } | null)),
  createSecret: mock((_key: string, _value: string, _createdByKinId?: string, _description?: string) =>
    Promise.resolve({ id: 'sec-1', key: 'TEST', createdAt: new Date() })),
  updateSecretValueByKey: mock((_key: string, _newValue: string) =>
    Promise.resolve(null as { id: string; key: string; updatedAt: Date } | null)),
  deleteSecret: mock((_id: string) => Promise.resolve(true)),
  listKeysByPrefix: mock((_prefix: string) => Promise.resolve([] as string[])),
}

mock.module('@/server/services/vault', () => mockVault)
mock.module('@/server/logger', () => ({
  createLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
}))

// Import after mocks so plugins.ts picks them up
const { createPluginVault } = await import('@/server/services/plugins')

beforeEach(() => {
  for (const fn of Object.values(mockVault)) fn.mockClear()
})

describe('createPluginVault', () => {
  describe('getSecret (permissive read)', () => {
    it('reads any vault key as-is, no prefix added', async () => {
      const vault = createPluginVault('twilio-sms')
      mockVault.getSecretValue.mockResolvedValueOnce('the-token')

      const v = await vault.getSecret('channel_twilio-sms_abc_authToken')

      expect(v).toBe('the-token')
      expect(mockVault.getSecretValue.mock.calls[0]?.[0]).toBe('channel_twilio-sms_abc_authToken')
    })

    it('returns null when the key is unknown', async () => {
      const vault = createPluginVault('twilio-sms')
      mockVault.getSecretValue.mockResolvedValueOnce(null)

      expect(await vault.getSecret('missing')).toBeNull()
    })
  })

  describe('setSecret (scoped write)', () => {
    it('prefixes the key with plugin:<name>: before calling createSecret', async () => {
      const vault = createPluginVault('twilio-sms')
      mockVault.getSecretByKey.mockResolvedValueOnce(null) // not yet stored

      await vault.setSecret('oauth_refresh_token', 'rfsh_xxx')

      expect(mockVault.getSecretByKey.mock.calls[0]?.[0]).toBe('plugin:twilio-sms:oauth_refresh_token')
      const createCall = mockVault.createSecret.mock.calls[0]
      expect(createCall?.[0]).toBe('plugin:twilio-sms:oauth_refresh_token')
      expect(createCall?.[1]).toBe('rfsh_xxx')
    })

    it('updates instead of creating when the scoped key already exists', async () => {
      const vault = createPluginVault('twilio-sms')
      mockVault.getSecretByKey.mockResolvedValueOnce({
        id: 'existing-id',
        key: 'plugin:twilio-sms:oauth_refresh_token',
      })

      await vault.setSecret('oauth_refresh_token', 'rfsh_new')

      expect(mockVault.createSecret).not.toHaveBeenCalled()
      expect(mockVault.updateSecretValueByKey.mock.calls[0]?.[0]).toBe('plugin:twilio-sms:oauth_refresh_token')
      expect(mockVault.updateSecretValueByKey.mock.calls[0]?.[1]).toBe('rfsh_new')
    })

    it('passes a default description when none is provided', async () => {
      const vault = createPluginVault('twilio-sms')
      mockVault.getSecretByKey.mockResolvedValueOnce(null)

      await vault.setSecret('key', 'val')

      const desc = mockVault.createSecret.mock.calls[0]?.[3]
      expect(desc).toContain('twilio-sms')
      expect(desc).toContain('key')
    })

    it('forwards a custom description verbatim', async () => {
      const vault = createPluginVault('twilio-sms')
      mockVault.getSecretByKey.mockResolvedValueOnce(null)

      await vault.setSecret('key', 'val', 'Stripe live secret')

      expect(mockVault.createSecret.mock.calls[0]?.[3]).toBe('Stripe live secret')
    })
  })

  describe('deleteSecret (scoped)', () => {
    it('only deletes secrets under the plugin namespace', async () => {
      const vault = createPluginVault('twilio-sms')
      mockVault.getSecretByKey.mockResolvedValueOnce({
        id: 'sec-twilio',
        key: 'plugin:twilio-sms:oauth_refresh_token',
      })

      await vault.deleteSecret('oauth_refresh_token')

      expect(mockVault.getSecretByKey.mock.calls[0]?.[0]).toBe('plugin:twilio-sms:oauth_refresh_token')
      expect(mockVault.deleteSecret.mock.calls[0]?.[0]).toBe('sec-twilio')
    })

    it('no-ops when the scoped key does not exist (does NOT delete by raw key)', async () => {
      const vault = createPluginVault('twilio-sms')
      mockVault.getSecretByKey.mockResolvedValueOnce(null)

      await vault.deleteSecret('channel_telegram_xyz_botToken')

      expect(mockVault.deleteSecret).not.toHaveBeenCalled()
    })
  })

  describe('listKeys (scoped)', () => {
    it('returns only this plugin\'s keys, unprefixed', async () => {
      const vault = createPluginVault('twilio-sms')
      mockVault.listKeysByPrefix.mockResolvedValueOnce([
        'plugin:twilio-sms:oauth_refresh',
        'plugin:twilio-sms:webhook_signing_key',
      ])

      const keys = await vault.listKeys()

      expect(mockVault.listKeysByPrefix.mock.calls[0]?.[0]).toBe('plugin:twilio-sms:')
      expect(keys).toEqual(['oauth_refresh', 'webhook_signing_key'])
    })

    it('returns an empty list when the plugin owns nothing', async () => {
      const vault = createPluginVault('untouched-plugin')
      mockVault.listKeysByPrefix.mockResolvedValueOnce([])

      expect(await vault.listKeys()).toEqual([])
    })
  })

  describe('cross-plugin isolation', () => {
    it('plugin A and plugin B write to distinct namespaces', async () => {
      const vaultA = createPluginVault('plugin-a')
      const vaultB = createPluginVault('plugin-b')
      mockVault.getSecretByKey.mockResolvedValue(null)

      await vaultA.setSecret('shared_key', 'value-a')
      await vaultB.setSecret('shared_key', 'value-b')

      const createCalls = mockVault.createSecret.mock.calls
      expect(createCalls[0]?.[0]).toBe('plugin:plugin-a:shared_key')
      expect(createCalls[1]?.[0]).toBe('plugin:plugin-b:shared_key')
    })

    it('plugin A cannot delete plugin B\'s secrets via deleteSecret', async () => {
      const vaultA = createPluginVault('plugin-a')
      // Even if a secret named "shared_key" exists under plugin-b's namespace,
      // pluginA's deleteSecret looks up `plugin:plugin-a:shared_key` — which
      // doesn't exist — and short-circuits.
      mockVault.getSecretByKey.mockResolvedValueOnce(null)

      await vaultA.deleteSecret('shared_key')

      expect(mockVault.deleteSecret).not.toHaveBeenCalled()
      expect(mockVault.getSecretByKey.mock.calls[0]?.[0]).toBe('plugin:plugin-a:shared_key')
    })

    it('plugin A\'s listKeys never returns plugin B\'s entries', async () => {
      const vaultA = createPluginVault('plugin-a')
      // The mocked vault returns whatever we hand it; in reality the SQL LIKE
      // filter scopes the result. Here we assert that vaultA queries with the
      // correct prefix, so the underlying filter does the isolation.
      mockVault.listKeysByPrefix.mockResolvedValueOnce(['plugin:plugin-a:key1'])

      const keys = await vaultA.listKeys()

      expect(mockVault.listKeysByPrefix.mock.calls[0]?.[0]).toBe('plugin:plugin-a:')
      expect(keys).toEqual(['key1'])
    })
  })
})
