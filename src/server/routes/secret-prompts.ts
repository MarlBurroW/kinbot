import { Hono } from 'hono'
import { respondToSecretPrompt, getPendingSecretPrompts } from '@/server/services/secret-prompts'
import type { AppVariables } from '@/server/app'

export const secretPromptRoutes = new Hono<{ Variables: AppVariables }>()

/**
 * POST /api/secret-prompts/:id/respond — submit the secret value(s) for a
 * pending secure-input prompt. The body never touches the LLM; the server
 * stores it in the vault and performs the side effect (create+test provider,
 * store secret). Body: { values: Record<fieldKey, string> }.
 */
secretPromptRoutes.post('/:id/respond', async (c) => {
  const promptId = c.req.param('id')
  const body = await c.req.json<{ values?: Record<string, string> }>().catch(() => null)
  if (!body || typeof body.values !== 'object' || body.values === null) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'A `values` object is required' } }, 400)
  }

  const user = c.get('user')
  const result = await respondToSecretPrompt(promptId, body.values, user.id)
  if (!result.success) {
    return c.json({ error: { code: 'SECRET_PROMPT_ERROR', message: result.error } }, 400)
  }
  return c.json({ success: true, summary: result.summary })
})

/**
 * GET /api/secret-prompts/pending?kinId=... — pending secure-input prompts for
 * hydration on page load / modal reconnect. Returns field metadata only (never
 * secret values).
 */
secretPromptRoutes.get('/pending', async (c) => {
  const kinId = c.req.query('kinId')
  if (!kinId) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'kinId is required' } }, 400)
  }
  const prompts = await getPendingSecretPrompts(kinId)
  return c.json({ prompts })
})
