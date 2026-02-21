import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { vaultSecrets } from '@/server/db/schema'
import {
  listSecrets,
  createSecret,
  updateSecret,
  deleteSecret,
} from '@/server/services/vault'
import { createLogger } from '@/server/logger'

const log = createLogger('routes:vault')
const vaultRoutes = new Hono()

// GET /api/vault — list all secrets (keys only, never values)
vaultRoutes.get('/', async (c) => {
  const secrets = await listSecrets()
  return c.json({ secrets })
})

// POST /api/vault — create a new secret
vaultRoutes.post('/', async (c) => {
  const { key, value } = (await c.req.json()) as { key: string; value: string }

  if (!key || !value) {
    return c.json(
      { error: { code: 'INVALID_INPUT', message: 'Both key and value are required' } },
      400,
    )
  }

  // Check for duplicate key
  const existing = await db
    .select()
    .from(vaultSecrets)
    .where(eq(vaultSecrets.key, key))
    .get()

  if (existing) {
    return c.json(
      { error: { code: 'DUPLICATE_KEY', message: `Secret with key "${key}" already exists` } },
      409,
    )
  }

  const secret = await createSecret(key, value)
  log.info({ secretId: secret.id, key }, 'Vault secret created')
  return c.json({ secret }, 201)
})

// PATCH /api/vault/:id — update a secret
vaultRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = (await c.req.json()) as { key?: string; value?: string }

  const updated = await updateSecret(id, body)
  if (!updated) {
    return c.json({ error: { code: 'SECRET_NOT_FOUND', message: 'Secret not found' } }, 404)
  }

  return c.json({ secret: updated })
})

// DELETE /api/vault/:id — delete a secret
vaultRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')

  const deleted = await deleteSecret(id)
  if (!deleted) {
    return c.json({ error: { code: 'SECRET_NOT_FOUND', message: 'Secret not found' } }, 404)
  }

  log.info({ secretId: id }, 'Vault secret deleted')
  return c.json({ success: true })
})

export { vaultRoutes }
