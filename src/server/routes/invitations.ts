import { Hono } from 'hono'
import type { AppVariables } from '@/server/app'
import {
  createInvitation,
  listInvitations,
  revokeInvitation,
  validateInvitation,
} from '@/server/services/invitations'
import { createLogger } from '@/server/logger'

const log = createLogger('routes:invitations')

export const invitationRoutes = new Hono<{ Variables: AppVariables }>()

// GET /api/invitations — list all invitations
invitationRoutes.get('/', async (c) => {
  const items = listInvitations()
  return c.json({ invitations: items })
})

// POST /api/invitations — create a new invitation
invitationRoutes.post('/', async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  const { label, expiresInDays } = body as {
    label?: string
    expiresInDays?: number
  }

  try {
    const invitation = await createInvitation({
      createdBy: user.id,
      label,
      expiresInDays,
    })
    return c.json({ invitation }, 201)
  } catch (err: any) {
    log.warn({ err: err.message }, 'Failed to create invitation')
    return c.json(
      { error: { code: 'INVITATION_LIMIT', message: err.message } },
      400,
    )
  }
})

// DELETE /api/invitations/:id — revoke an invitation
invitationRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const result = revokeInvitation(id)

  if (!result.success) {
    if (result.reason === 'NOT_FOUND') {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Invitation not found' } },
        404,
      )
    }
    if (result.reason === 'ALREADY_USED') {
      return c.json(
        { error: { code: 'ALREADY_USED', message: 'Cannot revoke an already used invitation' } },
        409,
      )
    }
  }

  return c.json({ success: true })
})

// GET /api/invitations/:token/validate — PUBLIC (no auth) — validate a token
invitationRoutes.get('/:token/validate', async (c) => {
  const token = c.req.param('token')
  const result = validateInvitation(token)
  return c.json(result)
})
