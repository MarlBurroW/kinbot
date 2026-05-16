import { tool } from 'ai'
import { z } from 'zod'
import { createLogger } from '@/server/logger'
import type { ToolRegistration, ToolExecutionContext } from '@/server/tools/types'
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  editProjectDescription,
  setActiveProject,
} from '@/server/services/projects'
import {
  listProjectTags,
  createTag,
  updateTag,
  deleteTag,
} from '@/server/services/project-tags'
import {
  listTickets,
  getTicket,
  createTicket,
  updateTicket,
  deleteTicket,
  addTicketTag,
  removeTicketTag,
  startTicketTask,
  startTicketEnrichment,
  resolveTicketRef,
} from '@/server/services/tickets'
import {
  listTicketComments,
  createTicketComment,
  deleteTicketComment,
} from '@/server/services/ticket-comments'
import { db } from '@/server/db/index'
import { kins } from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import { TICKET_STATUSES } from '@/shared/constants'

/** Look up the active project for the calling Kin — used to resolve bare
 *  ticket references like `#42`. Returns null when no active project is set. */
function getActiveProjectIdFor(kinId: string): string | null {
  const row = db
    .select({ activeProjectId: kins.activeProjectId })
    .from(kins)
    .where(eq(kins.id, kinId))
    .get()
  return row?.activeProjectId ?? null
}

const log = createLogger('tools:project')

// ─── Availability gates ───────────────────────────────────────────────────────

/** Main-agent-only tools (CRUD-on-projects / context-management).
 *  Sub-Kins linked to a ticket do NOT get these (they could destabilize their own run). */
const mainOnlyCondition = (ctx: ToolExecutionContext): boolean => !ctx.taskId

/** Available to main agents AND to sub-Kins when task.ticket_id is set.
 *  This covers the read/update set the sub-Kin needs to interact with its assigned ticket. */
const mainOrTicketBoundCondition = (ctx: ToolExecutionContext): boolean =>
  !ctx.taskId || !!ctx.ticketId

// ─── Read tools (main + ticket-bound sub-Kin) ─────────────────────────────────

export const listProjectsTool: ToolRegistration = {
  availability: ['main'],
  readOnly: true,
  concurrencySafe: true,
  condition: mainOnlyCondition,
  create: () =>
    tool({
      description: 'List all projects on the platform with ticket counts. Use to discover available projects.',
      inputSchema: z.object({}),
      execute: async () => {
        const projects = await listProjects()
        return { projects }
      },
    }),
}

export const getProjectTool: ToolRegistration = {
  availability: ['main'],
  readOnly: true,
  concurrencySafe: true,
  condition: mainOrTicketBoundCondition,
  create: () =>
    tool({
      description: 'Retrieve a project with its description, tags, and ticket counts per status.',
      inputSchema: z.object({
        project_id: z.string(),
      }),
      execute: async ({ project_id }) => {
        const project = await getProject(project_id)
        if (!project) return { error: 'PROJECT_NOT_FOUND' }
        return { project }
      },
    }),
}

export const listTicketsTool: ToolRegistration = {
  availability: ['main'],
  readOnly: true,
  concurrencySafe: true,
  condition: mainOrTicketBoundCondition,
  create: () =>
    tool({
      description: 'List tickets in a project, optionally filtered by status or tag.',
      inputSchema: z.object({
        project_id: z.string(),
        status: z.enum(TICKET_STATUSES).optional(),
        tag_id: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional().describe('Default: 50'),
        offset: z.number().int().min(0).optional().describe('Default: 0'),
      }),
      execute: async ({ project_id, status, tag_id, limit, offset }) => {
        const result = await listTickets(project_id, {
          status,
          tagId: tag_id,
          limit: limit ?? 50,
          offset: offset ?? 0,
        })
        return result
      },
    }),
}

export const getTicketTool: ToolRegistration = {
  availability: ['main'],
  readOnly: true,
  concurrencySafe: true,
  condition: mainOrTicketBoundCondition,
  create: (ctx) =>
    tool({
      description:
        'Retrieve a ticket with full description, tags, and linked tasks history. ' +
        'Accepts a UUID, a qualified id like "kinbot#42", or a bare "#42" (resolved against the active project).',
      inputSchema: z.object({
        ticket_id: z.string(),
      }),
      execute: async ({ ticket_id }) => {
        const resolved = await resolveTicketRef(ticket_id, {
          activeProjectId: getActiveProjectIdFor(ctx.kinId),
        })
        if (!resolved.ok) return { error: resolved.code, message: resolved.message }
        const ticket = await getTicket(resolved.ticketId)
        if (!ticket) return { error: 'TICKET_NOT_FOUND' }
        return { ticket }
      },
    }),
}

// ─── Project CRUD (main only) ─────────────────────────────────────────────────

export const createProjectTool: ToolRegistration = {
  availability: ['main'],
  condition: mainOnlyCondition,
  create: () =>
    tool({
      description: 'Create a new project. A default tag palette (bug, feature, chore, doc) is seeded automatically.',
      inputSchema: z.object({
        title: z.string(),
        description: z.string().optional(),
        github_url: z.string().optional(),
      }),
      execute: async ({ title, description, github_url }) => {
        try {
          const project = await createProject({ title, description, githubUrl: github_url })
          return { project }
        } catch (err) {
          log.warn({ err }, 'createProject failed')
          return { error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),
}

export const updateProjectTool: ToolRegistration = {
  availability: ['main'],
  condition: mainOnlyCondition,
  create: () =>
    tool({
      description: 'Modify a project. Use the dedicated description tools for incremental edits to long descriptions.',
      inputSchema: z.object({
        project_id: z.string(),
        title: z.string().optional(),
        github_url: z.string().nullable().optional(),
      }),
      execute: async ({ project_id, title, github_url }) => {
        const project = await updateProject(project_id, { title, githubUrl: github_url })
        if (!project) return { error: 'PROJECT_NOT_FOUND' }
        return { project }
      },
    }),
}

export const deleteProjectTool: ToolRegistration = {
  availability: ['main'],
  destructive: true,
  condition: mainOnlyCondition,
  create: () =>
    tool({
      description: 'Permanently delete a project. Cascades to tickets, tags, and ticket_tags. Tasks history is preserved (ticket_id set to NULL).',
      inputSchema: z.object({
        project_id: z.string(),
      }),
      execute: async ({ project_id }) => {
        const deleted = await deleteProject(project_id)
        if (!deleted) return { error: 'PROJECT_NOT_FOUND' }
        return { success: true, projectId: project_id }
      },
    }),
}

// ─── Project description editing (main + ticket-bound sub-Kin) ────────────────

export const updateProjectDescriptionTool: ToolRegistration = {
  availability: ['main'],
  condition: mainOrTicketBoundCondition,
  create: () =>
    tool({
      description: 'Replace the full description of a project. For incremental edits, prefer append_project_description or patch_project_description.',
      inputSchema: z.object({
        project_id: z.string(),
        content: z.string(),
      }),
      execute: async ({ project_id, content }) => {
        const project = await editProjectDescription(project_id, { mode: 'replace', content })
        if (!project) return { error: 'PROJECT_NOT_FOUND' }
        return { project }
      },
    }),
}

export const appendProjectDescriptionTool: ToolRegistration = {
  availability: ['main'],
  condition: mainOrTicketBoundCondition,
  create: () =>
    tool({
      description: 'Append text to the end of a project description without re-writing it. Separator defaults to two newlines.',
      inputSchema: z.object({
        project_id: z.string(),
        text: z.string(),
        separator: z.string().optional().describe('Default: "\\n\\n"'),
      }),
      execute: async ({ project_id, text, separator }) => {
        const project = await editProjectDescription(project_id, { mode: 'append', text, separator })
        if (!project) return { error: 'PROJECT_NOT_FOUND' }
        return { project }
      },
    }),
}

export const patchProjectDescriptionTool: ToolRegistration = {
  availability: ['main'],
  condition: mainOrTicketBoundCondition,
  create: () =>
    tool({
      description: 'Find-and-replace a unique substring in the project description. Errors if find is missing or matches multiple times.',
      inputSchema: z.object({
        project_id: z.string(),
        find: z.string(),
        replace: z.string(),
      }),
      execute: async ({ project_id, find, replace }) => {
        try {
          const project = await editProjectDescription(project_id, { mode: 'patch', find, replace })
          if (!project) return { error: 'PROJECT_NOT_FOUND' }
          return { project }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),
}

// ─── Active project (main only) ───────────────────────────────────────────────

export const setActiveProjectTool: ToolRegistration = {
  availability: ['main'],
  condition: mainOnlyCondition,
  create: (ctx) =>
    tool({
      description: 'Set or clear the active project for the calling Kin. The project context will be injected in the system prompt on the next turn. Pass null to deactivate.',
      inputSchema: z.object({
        project_id: z.string().nullable(),
      }),
      execute: async ({ project_id }) => {
        try {
          const result = await setActiveProject(ctx.kinId, project_id)
          return { activeProjectId: result.activeProjectId }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),
}

// ─── Tags (main only — sub-Kins don't manage the palette) ─────────────────────

export const createTagTool: ToolRegistration = {
  availability: ['main'],
  condition: mainOnlyCondition,
  create: () =>
    tool({
      description: 'Create a new tag in a project. Tag labels must be unique within the project.',
      inputSchema: z.object({
        project_id: z.string(),
        label: z.string(),
        color: z.string().describe('Hex color, e.g. "#ef4444"'),
      }),
      execute: async ({ project_id, label, color }) => {
        try {
          const tag = await createTag({ projectId: project_id, label, color })
          return { tag }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),
}

export const updateTagTool: ToolRegistration = {
  availability: ['main'],
  condition: mainOnlyCondition,
  create: () =>
    tool({
      description: 'Modify a tag\'s label or color.',
      inputSchema: z.object({
        tag_id: z.string(),
        label: z.string().optional(),
        color: z.string().optional(),
      }),
      execute: async ({ tag_id, label, color }) => {
        try {
          const tag = await updateTag(tag_id, { label, color })
          if (!tag) return { error: 'TAG_NOT_FOUND' }
          return { tag }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),
}

export const deleteTagTool: ToolRegistration = {
  availability: ['main'],
  destructive: true,
  condition: mainOnlyCondition,
  create: () =>
    tool({
      description: 'Delete a tag. All tickets lose this tag (cascaded ticket_tags rows).',
      inputSchema: z.object({
        tag_id: z.string(),
      }),
      execute: async ({ tag_id }) => {
        const deleted = await deleteTag(tag_id)
        if (!deleted) return { error: 'TAG_NOT_FOUND' }
        return { success: true, tagId: tag_id }
      },
    }),
}

// ─── Tickets (CRUD: main only ; update + tag mgmt: main + ticket-bound sub-Kin) ─

export const createTicketTool: ToolRegistration = {
  availability: ['main'],
  condition: mainOnlyCondition,
  create: (ctx) =>
    tool({
      description: 'Create a new ticket in a project. Status defaults to "backlog". You are recorded as the reporter.',
      inputSchema: z.object({
        project_id: z.string(),
        title: z.string(),
        description: z.string().optional(),
        status: z.enum(TICKET_STATUSES).optional(),
        tag_ids: z.array(z.string()).optional(),
      }),
      execute: async ({ project_id, title, description, status, tag_ids }) => {
        try {
          const ticket = await createTicket({
            projectId: project_id,
            title,
            description,
            status,
            tagIds: tag_ids,
            reporter: { type: 'kin', id: ctx.kinId },
          })
          return { ticket }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),
}

export const updateTicketTool: ToolRegistration = {
  availability: ['main'],
  condition: mainOrTicketBoundCondition,
  create: (ctx) =>
    tool({
      description:
        'Modify a ticket — title, description, status, position, or tags (PUT-like for tag_ids: pass the full set). ' +
        'Status change without explicit position moves the card to the top of the target column. ' +
        'Accepts a UUID, a qualified id like "kinbot#42", or a bare "#42" (resolved against the active project).',
      inputSchema: z.object({
        ticket_id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(TICKET_STATUSES).optional(),
        position: z.number().int().optional(),
        tag_ids: z.array(z.string()).optional(),
      }),
      execute: async ({ ticket_id, title, description, status, position, tag_ids }) => {
        const resolved = await resolveTicketRef(ticket_id, {
          activeProjectId: getActiveProjectIdFor(ctx.kinId),
        })
        if (!resolved.ok) return { error: resolved.code, message: resolved.message }
        try {
          const ticket = await updateTicket(resolved.ticketId, {
            title,
            description,
            status,
            position,
            tagIds: tag_ids,
          })
          if (!ticket) return { error: 'TICKET_NOT_FOUND' }
          return { ticket }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),
}

export const addTicketTagTool: ToolRegistration = {
  availability: ['main'],
  condition: mainOrTicketBoundCondition,
  create: (ctx) =>
    tool({
      description:
        'Attach a tag to a ticket. Idempotent. The tag must belong to the ticket\'s project. ' +
        'Accepts a UUID, a qualified id like "kinbot#42", or a bare "#42".',
      inputSchema: z.object({
        ticket_id: z.string(),
        tag_id: z.string(),
      }),
      execute: async ({ ticket_id, tag_id }) => {
        const resolved = await resolveTicketRef(ticket_id, {
          activeProjectId: getActiveProjectIdFor(ctx.kinId),
        })
        if (!resolved.ok) return { error: resolved.code, message: resolved.message }
        const ok = await addTicketTag(resolved.ticketId, tag_id)
        if (!ok) return { error: 'TICKET_OR_TAG_NOT_FOUND_OR_CROSS_PROJECT' }
        return { success: true }
      },
    }),
}

export const removeTicketTagTool: ToolRegistration = {
  availability: ['main'],
  condition: mainOrTicketBoundCondition,
  create: (ctx) =>
    tool({
      description:
        'Detach a tag from a ticket. Accepts a UUID, a qualified id like "kinbot#42", or a bare "#42".',
      inputSchema: z.object({
        ticket_id: z.string(),
        tag_id: z.string(),
      }),
      execute: async ({ ticket_id, tag_id }) => {
        const resolved = await resolveTicketRef(ticket_id, {
          activeProjectId: getActiveProjectIdFor(ctx.kinId),
        })
        if (!resolved.ok) return { error: resolved.code, message: resolved.message }
        const ok = await removeTicketTag(resolved.ticketId, tag_id)
        if (!ok) return { error: 'TICKET_TAG_LINK_NOT_FOUND' }
        return { success: true }
      },
    }),
}

export const deleteTicketTool: ToolRegistration = {
  availability: ['main'],
  destructive: true,
  condition: mainOnlyCondition,
  create: (ctx) =>
    tool({
      description:
        'Permanently delete a ticket. Linked tasks history is preserved (ticket_id set to NULL). ' +
        'Accepts a UUID, a qualified id like "kinbot#42", or a bare "#42".',
      inputSchema: z.object({
        ticket_id: z.string(),
      }),
      execute: async ({ ticket_id }) => {
        const resolved = await resolveTicketRef(ticket_id, {
          activeProjectId: getActiveProjectIdFor(ctx.kinId),
        })
        if (!resolved.ok) return { error: resolved.code, message: resolved.message }
        const deleted = await deleteTicket(resolved.ticketId)
        if (!deleted) return { error: 'TICKET_NOT_FOUND' }
        return { success: true, ticketId: resolved.ticketId }
      },
    }),
}

// ─── Start ticket task (main only) ────────────────────────────────────────────

export const startTicketTaskTool: ToolRegistration = {
  availability: ['main'],
  condition: mainOnlyCondition,
  create: (ctx) =>
    tool({
      description:
        'Spawn a sub-Kin to work on a ticket. Always runs in await mode — you will get a turn when it finishes. ' +
        'NO side-effect on the ticket status: update it manually via update_ticket() before/after. ' +
        'Accepts a UUID, a qualified id like "kinbot#42", or a bare "#42".',
      inputSchema: z.object({
        ticket_id: z.string(),
      }),
      execute: async ({ ticket_id }) => {
        const resolved = await resolveTicketRef(ticket_id, {
          activeProjectId: getActiveProjectIdFor(ctx.kinId),
        })
        if (!resolved.ok) return { error: resolved.code, message: resolved.message }
        try {
          const result = await startTicketTask(resolved.ticketId, ctx.kinId)
          return result
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),
}

// ─── Enrich ticket (main only) ────────────────────────────────────────────────

export const enrichTicketTool: ToolRegistration = {
  availability: ['main'],
  condition: mainOnlyCondition,
  create: (ctx) =>
    tool({
      description:
        'Spawn a dedicated enrichment sub-Kin on a ticket. The agent gathers context (repo, related tickets, history) ' +
        'and rewrites the ticket title, description, and tags to make it actionable. Runs in await mode — you get a turn back when it finishes. ' +
        'Refuses if another enrichment is already in flight on the same ticket. ' +
        'Accepts a UUID, a qualified id like "kinbot#42", or a bare "#42".',
      inputSchema: z.object({
        ticket_id: z.string(),
        focus: z
          .string()
          .optional()
          .describe(
            'Optional free-form orientation for the enrichment (e.g. "creuse plus côté tests" or "propose une approche de migration DB").',
          ),
      }),
      execute: async ({ ticket_id, focus }) => {
        const resolved = await resolveTicketRef(ticket_id, {
          activeProjectId: getActiveProjectIdFor(ctx.kinId),
        })
        if (!resolved.ok) return { error: resolved.code, message: resolved.message }
        try {
          const result = await startTicketEnrichment(resolved.ticketId, ctx.kinId, { focus })
          return result
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error'
          if (msg === 'ENRICHMENT_ALREADY_RUNNING') {
            return {
              error: 'ENRICHMENT_ALREADY_RUNNING',
              message: 'An enrichment task is already running on this ticket. Wait for it to finish before launching another.',
            }
          }
          return { error: msg }
        }
      },
    }),
}

// ─── Ticket comments (main + ticket-bound sub-Kin) ────────────────────────────

export const addTicketCommentTool: ToolRegistration = {
  availability: ['main'],
  condition: mainOrTicketBoundCondition,
  create: (ctx) =>
    tool({
      description:
        'Post a comment on a ticket signed as the calling Kin. Use mid-task to flag something separate ' +
        'from the final report (the final report is already posted automatically as a comment when the ' +
        'sub-Kin finishes). Accepts a UUID, a qualified id like "kinbot#42", or a bare "#42".',
      inputSchema: z.object({
        ticket_id: z.string(),
        content: z.string().describe('Markdown supported. Avoid em-dashes per repo conventions; use commas or parentheses instead.'),
      }),
      execute: async ({ ticket_id, content }) => {
        const resolved = await resolveTicketRef(ticket_id, {
          activeProjectId: getActiveProjectIdFor(ctx.kinId),
        })
        if (!resolved.ok) return { error: resolved.code, message: resolved.message }
        try {
          const comment = await createTicketComment({
            ticketId: resolved.ticketId,
            author: { type: 'kin', id: ctx.kinId },
            content,
            metadata: ctx.taskId ? { fromTaskId: ctx.taskId } : null,
          })
          return { comment }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error'
          return { error: msg }
        }
      },
    }),
}

export const listTicketCommentsTool: ToolRegistration = {
  availability: ['main'],
  readOnly: true,
  concurrencySafe: true,
  condition: mainOrTicketBoundCondition,
  create: (ctx) =>
    tool({
      description:
        'List comments posted on a ticket in chronological order. ' +
        'Accepts a UUID, a qualified id like "kinbot#42", or a bare "#42".',
      inputSchema: z.object({
        ticket_id: z.string(),
        limit: z.number().int().min(1).max(200).optional().describe('Default: 100'),
        offset: z.number().int().min(0).optional().describe('Default: 0'),
      }),
      execute: async ({ ticket_id, limit, offset }) => {
        const resolved = await resolveTicketRef(ticket_id, {
          activeProjectId: getActiveProjectIdFor(ctx.kinId),
        })
        if (!resolved.ok) return { error: resolved.code, message: resolved.message }
        const result = await listTicketComments(resolved.ticketId, {
          limit: limit ?? 100,
          offset: offset ?? 0,
        })
        return result
      },
    }),
}

export const deleteTicketCommentTool: ToolRegistration = {
  availability: ['main'],
  destructive: true,
  condition: mainOrTicketBoundCondition,
  create: (ctx) =>
    tool({
      description:
        'Delete a comment by its UUID. A Kin can only delete its own comments. Hard delete, no recovery.',
      inputSchema: z.object({
        comment_id: z.string(),
      }),
      execute: async ({ comment_id }) => {
        try {
          const ok = await deleteTicketComment(comment_id, { type: 'kin', id: ctx.kinId })
          if (!ok) return { error: 'COMMENT_NOT_FOUND' }
          return { success: true, commentId: comment_id }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error'
          if (msg === 'FORBIDDEN') {
            return { error: 'FORBIDDEN', message: 'You can only delete your own comments.' }
          }
          return { error: msg }
        }
      },
    }),
}

// ─── List tags (main only, helper for discovery) ──────────────────────────────

export const listProjectTagsTool: ToolRegistration = {
  availability: ['main'],
  readOnly: true,
  concurrencySafe: true,
  condition: mainOnlyCondition,
  create: () =>
    tool({
      description: 'List all tags defined for a project.',
      inputSchema: z.object({
        project_id: z.string(),
      }),
      execute: async ({ project_id }) => {
        const tags = await listProjectTags(project_id)
        return { tags }
      },
    }),
}
