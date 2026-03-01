import { tool } from 'ai'
import { z } from 'zod'
import { eq, and, asc, inArray } from 'drizzle-orm'
import {
  spawnTask,
  respondToTask,
  cancelTask,
  listKinTasks,
  listSourceKinTasks,
  getTask,
} from '@/server/services/tasks'
import { resolveKinId } from '@/server/services/kin-resolver'
import { db } from '@/server/db/index'
import { kins, messages } from '@/server/db/schema'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:tasks')

/**
 * spawn_self — clone the current Kin with a specific mission.
 * Available to main agents only.
 */
export const spawnSelfTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Spawn a sub-Kin copy of yourself with a specific task. ' +
        'The sub-Kin inherits your character, expertise, and tools. ' +
        'Your current turn ends immediately after spawning.',
      inputSchema: z.object({
        title: z.string().describe('Short label for the task (shown in UI, max ~60 chars)'),
        task_description: z.string().describe('Full instructions for the sub-Kin task'),
        mode: z
          .enum(['await', 'async'])
          .describe(
            '"await" = result enters your queue and triggers a new turn; ' +
            '"async" = result is deposited as informational, no new turn',
          ),
        model: z
          .string()
          .optional()
          .describe('LLM model for the sub-Kin. If omitted, inherits your model'),
        allow_human_prompt: z
          .boolean()
          .optional()
          .describe('Whether the sub-Kin can prompt the human user for input. Defaults to true.'),
      }),
      execute: async ({ title, task_description, mode, model, allow_human_prompt }) => {
        log.debug({ kinId: ctx.kinId, mode, spawnType: 'self' }, 'Task spawn requested (spawn_self)')
        const { taskId } = await spawnTask({
          parentKinId: ctx.kinId,
          title,
          description: task_description,
          mode,
          spawnType: 'self',
          model,
          allowHumanPrompt: allow_human_prompt,
        })
        return { taskId, status: 'pending' }
      },
    }),
}

/**
 * spawn_kin — instantiate another Kin from the platform with a specific mission.
 * Available to main agents only.
 */
export const spawnKinTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Spawn a different Kin as a sub-Kin for a specific task. ' +
        'The sub-Kin uses the target Kin\'s identity and expertise. ' +
        'Your current turn ends immediately after spawning.',
      inputSchema: z.object({
        kin_slug: z.string().describe('Slug of the target Kin to spawn (e.g. "test-ai")'),
        title: z.string().describe('Short label for the task (shown in UI, max ~60 chars)'),
        task_description: z.string().describe('Full instructions for the sub-Kin task'),
        mode: z
          .enum(['await', 'async'])
          .describe(
            '"await" = result enters your queue and triggers a new turn; ' +
            '"async" = result is deposited as informational, no new turn',
          ),
        model: z
          .string()
          .optional()
          .describe('LLM model for the sub-Kin. If omitted, inherits target Kin\'s model'),
        allow_human_prompt: z
          .boolean()
          .optional()
          .describe('Whether the sub-Kin can prompt the human user for input. Defaults to true.'),
      }),
      execute: async ({ kin_slug, title, task_description, mode, model, allow_human_prompt }) => {
        const kinId = resolveKinId(kin_slug)
        if (!kinId) {
          return { error: `Kin not found for slug "${kin_slug}"` }
        }
        log.debug({ kinId: ctx.kinId, targetKinId: kinId, mode, spawnType: 'other' }, 'Task spawn requested (spawn_kin)')
        const { taskId } = await spawnTask({
          parentKinId: ctx.kinId,
          title,
          description: task_description,
          mode,
          spawnType: 'other',
          sourceKinId: kinId,
          model,
          allowHumanPrompt: allow_human_prompt,
        })
        return { taskId, status: 'pending' }
      },
    }),
}

/**
 * respond_to_task — answer a clarification request from a sub-Kin.
 * Available to main agents only.
 */
export const respondToTaskTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Answer a clarification request (request_input) from one of your sub-Kins. ' +
        'The answer is injected into the sub-Kin\'s session and triggers a new LLM turn.',
      inputSchema: z.object({
        task_id: z.string().describe('ID of the sub-Kin task'),
        answer: z.string().describe('The clarification answer'),
      }),
      execute: async ({ task_id, answer }) => {
        const success = await respondToTask(task_id, answer)
        if (!success) {
          return { error: 'Task not found or not active' }
        }
        return { success: true }
      },
    }),
}

/**
 * cancel_task — cancel a task in progress.
 * Available to main agents only.
 */
export const cancelTaskTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description: 'Cancel a sub-Kin task that is pending or in progress.',
      inputSchema: z.object({
        task_id: z.string().describe('ID of the task to cancel'),
      }),
      execute: async ({ task_id }) => {
        const success = await cancelTask(task_id, ctx.kinId)
        if (!success) {
          return { error: 'Task not found, not owned by you, or already finished' }
        }
        return { success: true }
      },
    }),
}

/**
 * list_tasks — list all current tasks and their status.
 * Available to main agents only.
 */
export const listTasksTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'List all tasks — both tasks you spawned and tasks where you were spawned as the executing Kin by another Kin.',
      inputSchema: z.object({}),
      execute: async () => {
        const spawnedTasks = await listKinTasks(ctx.kinId)
        const assignedTasks = await listSourceKinTasks(ctx.kinId)

        // Deduplicate (shouldn't overlap but safety first)
        const seenIds = new Set(spawnedTasks.map((t) => t.id))
        const allTasks = [...spawnedTasks, ...assignedTasks.filter((t) => !seenIds.has(t.id))]

        // Resolve related Kin slugs
        const relatedKinIds = [...new Set([
          ...allTasks
            .filter((t) => t.spawnType === 'other' && t.sourceKinId)
            .map((t) => t.sourceKinId!),
          ...assignedTasks.map((t) => t.parentKinId),
        ])]
        const kinSlugMap = new Map<string, string>()
        if (relatedKinIds.length > 0) {
          const relatedKins = await db
            .select({ id: kins.id, slug: kins.slug, name: kins.name })
            .from(kins)
            .where(inArray(kins.id, relatedKinIds))
            .all()
          for (const k of relatedKins) {
            kinSlugMap.set(k.id, k.slug ?? k.name)
          }
        }

        return {
          tasks: allTasks.map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            status: t.status,
            mode: t.mode,
            spawnType: t.spawnType,
            relationship: t.parentKinId === ctx.kinId ? 'spawned_by_me' : 'assigned_to_me',
            sourceKinSlug: t.sourceKinId ? kinSlugMap.get(t.sourceKinId) ?? null : null,
            parentKinSlug: t.parentKinId !== ctx.kinId ? kinSlugMap.get(t.parentKinId) ?? null : null,
            result: t.result,
            error: t.error,
            depth: t.depth,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
          })),
        }
      },
    }),
}

/**
 * get_task_detail — fetch full details and message history of a task.
 * Works for tasks you spawned OR tasks where you were the executing Kin.
 */
export const getTaskDetailTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Get detailed information about a specific task, including its full message history. ' +
        'Works for tasks you spawned OR tasks where you were the executing Kin.',
      inputSchema: z.object({
        task_id: z.string().describe('ID of the task to inspect'),
      }),
      execute: async ({ task_id }) => {
        const task = await getTask(task_id)
        if (!task) return { error: 'Task not found' }

        // Verify the Kin has access (either parent or source)
        if (task.parentKinId !== ctx.kinId && task.sourceKinId !== ctx.kinId) {
          return { error: 'Access denied — you are not related to this task' }
        }

        // Fetch task messages
        const taskMessages = await db
          .select({
            role: messages.role,
            content: messages.content,
            sourceType: messages.sourceType,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(and(eq(messages.kinId, task.parentKinId), eq(messages.taskId, task_id)))
          .orderBy(asc(messages.createdAt))
          .all()

        return {
          task: {
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            mode: task.mode,
            spawnType: task.spawnType,
            result: task.result,
            error: task.error,
            depth: task.depth,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
          },
          messages: taskMessages,
        }
      },
    }),
}
