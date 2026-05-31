import { Hono } from 'hono'
import { listPendingSends, approvePendingSend, rejectPendingSend } from '@/server/services/pending-email-sends'

const pendingEmailSendRoutes = new Hono()

// GET /api/pending-email-sends?status=pending — list queued sends (default: pending).
pendingEmailSendRoutes.get('/', async (c) => {
  const status = c.req.query('status')
  return c.json({ pending: await listPendingSends({ status }) })
})

// POST /api/pending-email-sends/:id/approve — send it for real.
pendingEmailSendRoutes.post('/:id/approve', async (c) => {
  const r = await approvePendingSend(c.req.param('id'))
  if (!r.ok) return c.json({ error: { code: 'APPROVE_FAILED', message: r.error ?? 'Failed' } }, 400)
  return c.json({ ok: true })
})

// POST /api/pending-email-sends/:id/reject — drop it.
pendingEmailSendRoutes.post('/:id/reject', async (c) => {
  const r = await rejectPendingSend(c.req.param('id'))
  if (!r.ok) return c.json({ error: { code: 'REJECT_FAILED', message: r.error ?? 'Failed' } }, 400)
  return c.json({ ok: true })
})

export { pendingEmailSendRoutes }
