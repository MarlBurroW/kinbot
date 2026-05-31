/**
 * Email sends queued for human approval.
 *
 * When an email account is in `send_mode='approval'`, the `send_email` tool
 * queues the message here instead of sending it. The user approves → we run the
 * real `sendMessage`; rejects → it's dropped. Mirrors the Kin-created cron
 * approval pattern (pending row + notification + SSE + approve/reject endpoints).
 */
import { v4 as uuid } from 'uuid'
import { eq } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { pendingEmailSends, kins } from '@/server/db/schema'
import { createLogger } from '@/server/logger'
import { sseManager } from '@/server/sse/index'
import { resolveEmailProvider, listEmailAccounts } from '@/server/services/email-accounts'
import type { SendEmailParams, EmailAddress } from '@/server/email/types'
import type { PendingEmailSend } from '@/shared/types'

const log = createLogger('pending-email-sends')

type Row = typeof pendingEmailSends.$inferSelect

function addrToString(a: EmailAddress): string {
  return a.name ? `${a.name} <${a.email}>` : a.email
}

function summarize(params: SendEmailParams): string {
  return `${params.to.map((a) => a.email).join(', ')} · ${params.subject}`
}

/** Queue an email for approval. Returns the pending id. */
export async function createPendingSend(input: {
  accountId: string
  kinId: string
  taskId?: string
  params: SendEmailParams
}): Promise<string> {
  const id = uuid()
  const summary = summarize(input.params)
  await db.insert(pendingEmailSends).values({
    id,
    accountId: input.accountId,
    kinId: input.kinId,
    taskId: input.taskId ?? null,
    payload: JSON.stringify(input.params),
    summary,
    status: 'pending',
    error: null,
    createdAt: new Date(),
    resolvedAt: null,
  })

  const { createNotification } = await import('@/server/services/notifications')
  createNotification({
    type: 'email:pending-send-approval',
    title: 'Email waiting for approval',
    body: summary,
    kinId: input.kinId,
    relatedId: id,
    relatedType: 'email',
  }).catch(() => {})

  sseManager.broadcast({ type: 'email:pending-created', kinId: input.kinId, data: { pendingId: id } })
  log.info({ id, kinId: input.kinId, accountId: input.accountId }, 'Email queued for approval')
  return id
}

async function toPending(row: Row, emailByAccount: Map<string, string>, nameByKin: Map<string, string>): Promise<PendingEmailSend> {
  const params = JSON.parse(row.payload) as SendEmailParams
  return {
    id: row.id,
    accountId: row.accountId,
    accountEmail: emailByAccount.get(row.accountId) ?? '',
    kinId: row.kinId,
    kinName: nameByKin.get(row.kinId) ?? '',
    to: params.to.map(addrToString),
    cc: params.cc?.map(addrToString),
    subject: params.subject,
    body: params.body,
    status: row.status as PendingEmailSend['status'],
    error: row.error,
    createdAt: (row.createdAt as unknown as number) ?? 0,
  }
}

/** List pending sends (default: only `status='pending'`). */
export async function listPendingSends(opts: { status?: string } = {}): Promise<PendingEmailSend[]> {
  const rows = db.select().from(pendingEmailSends).all()
  const filtered = rows
    .filter((r) => (opts.status ? r.status === opts.status : r.status === 'pending'))
    .sort((a, b) => (b.createdAt as unknown as number) - (a.createdAt as unknown as number))
  if (filtered.length === 0) return []

  const accounts = await listEmailAccounts()
  const emailByAccount = new Map(accounts.map((a) => [a.id, a.emailAddress]))
  const nameByKin = new Map(db.select({ id: kins.id, name: kins.name }).from(kins).all().map((k) => [k.id, k.name]))
  return Promise.all(filtered.map((r) => toPending(r, emailByAccount, nameByKin)))
}

/** Approve a pending send → actually send the email. */
export async function approvePendingSend(id: string): Promise<{ ok: boolean; error?: string }> {
  const row = db.select().from(pendingEmailSends).where(eq(pendingEmailSends.id, id)).get()
  if (!row) return { ok: false, error: 'NOT_FOUND' }
  if (row.status !== 'pending') return { ok: false, error: `Already ${row.status}` }

  const params = JSON.parse(row.payload) as SendEmailParams
  try {
    // Re-resolve with the requesting Kin's id (it passed the allow-list at
    // request time), then send for real.
    const { provider, config } = await resolveEmailProvider({ slug: row.accountId, kinId: row.kinId })
    await provider.sendMessage(params, config)
    await db
      .update(pendingEmailSends)
      .set({ status: 'sent', resolvedAt: new Date() })
      .where(eq(pendingEmailSends.id, id))
    sseManager.broadcast({ type: 'email:pending-resolved', kinId: row.kinId, data: { pendingId: id, status: 'sent' } })
    log.info({ id, kinId: row.kinId }, 'Approved email sent')
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await db
      .update(pendingEmailSends)
      .set({ status: 'failed', error: message, resolvedAt: new Date() })
      .where(eq(pendingEmailSends.id, id))
    sseManager.broadcast({ type: 'email:pending-resolved', kinId: row.kinId, data: { pendingId: id, status: 'failed' } })
    log.warn({ id, error: message }, 'Approved email send failed')
    return { ok: false, error: message }
  }
}

/** Reject a pending send → drop it, never sent. */
export async function rejectPendingSend(id: string): Promise<{ ok: boolean; error?: string }> {
  const row = db.select().from(pendingEmailSends).where(eq(pendingEmailSends.id, id)).get()
  if (!row) return { ok: false, error: 'NOT_FOUND' }
  if (row.status !== 'pending') return { ok: false, error: `Already ${row.status}` }
  await db
    .update(pendingEmailSends)
    .set({ status: 'rejected', resolvedAt: new Date() })
    .where(eq(pendingEmailSends.id, id))
  sseManager.broadcast({ type: 'email:pending-resolved', kinId: row.kinId, data: { pendingId: id, status: 'rejected' } })
  log.info({ id }, 'Email send rejected')
  return { ok: true }
}
