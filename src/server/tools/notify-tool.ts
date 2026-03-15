import { tool } from 'ai'
import { z } from 'zod'
import { createNotification } from '@/server/services/notifications'
import type { ToolRegistration } from './types'

export const notifyTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  create: (ctx) =>
    tool({
      description:
        'Send a notification to the user (bell icon + external channels if configured).',
      inputSchema: z.object({
        title: z.string().max(100),
        body: z
          .string()
          .max(500)
          .optional(),
      }),
      execute: async ({ title, body }) => {
        await createNotification({
          type: 'kin:alert',
          title,
          body,
          kinId: ctx.kinId,
          relatedType: 'kin',
        })
        return { success: true, message: 'Notification sent to user.' }
      },
    }),
}
