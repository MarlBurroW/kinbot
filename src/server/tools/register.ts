import { createLogger } from '@/server/logger'
import { toolRegistry } from '@/server/tools/index'
import { webSearchTool } from '@/server/tools/search-tools'
import {
  getContactTool,
  searchContactsTool,
  createContactTool,
  updateContactTool,
} from '@/server/tools/contact-tools'
import {
  recallTool,
  memorizeTool,
  updateMemoryTool,
  forgetTool,
  listMemoriesTool,
} from '@/server/tools/memory-tools'
import { searchHistoryTool } from '@/server/tools/history-tools'
import { getSecretTool, redactMessageTool } from '@/server/tools/vault-tools'
import {
  spawnSelfTool,
  spawnKinTool,
  respondToTaskTool,
  cancelTaskTool,
  listTasksTool,
} from '@/server/tools/task-tools'
import {
  reportToParentTool,
  updateTaskStatusTool,
  requestInputTool,
} from '@/server/tools/subtask-tools'
import {
  sendMessageTool,
  replyTool,
  listKinsTool,
} from '@/server/tools/inter-kin-tools'
import {
  createCronTool,
  updateCronTool,
  deleteCronTool,
  listCronsTool,
} from '@/server/tools/cron-tools'
import {
  registerToolTool,
  runCustomToolTool,
  listCustomToolsTool,
} from '@/server/tools/custom-tool-tools'
import { generateImageTool } from '@/server/tools/image-tools'
import { runShellTool } from '@/server/tools/shell-tools'

const log = createLogger('tools')

/**
 * Register all native tools in the tool registry.
 * Called once at server startup.
 *
 * Tools from later phases (tasks, inter-kin, etc.) will be
 * registered here as they are implemented.
 */
export function registerAllTools(): void {
  // Phase 10.5: Web search
  toolRegistry.register('web_search', webSearchTool)

  // Phase 11: Contact tools
  toolRegistry.register('get_contact', getContactTool)
  toolRegistry.register('search_contacts', searchContactsTool)
  toolRegistry.register('create_contact', createContactTool)
  toolRegistry.register('update_contact', updateContactTool)

  // Phase 12: Memory tools
  toolRegistry.register('recall', recallTool)
  toolRegistry.register('memorize', memorizeTool)
  toolRegistry.register('update_memory', updateMemoryTool)
  toolRegistry.register('forget', forgetTool)
  toolRegistry.register('list_memories', listMemoriesTool)

  // Phase 12: History tools
  toolRegistry.register('search_history', searchHistoryTool)

  // Phase 14: Vault tools
  toolRegistry.register('get_secret', getSecretTool)
  toolRegistry.register('redact_message', redactMessageTool)

  // Phase 15: Task tools (parent — main only)
  toolRegistry.register('spawn_self', spawnSelfTool)
  toolRegistry.register('spawn_kin', spawnKinTool)
  toolRegistry.register('respond_to_task', respondToTaskTool)
  toolRegistry.register('cancel_task', cancelTaskTool)
  toolRegistry.register('list_tasks', listTasksTool)

  // Phase 15: Sub-Kin tools (sub-kin only)
  toolRegistry.register('report_to_parent', reportToParentTool)
  toolRegistry.register('update_task_status', updateTaskStatusTool)
  toolRegistry.register('request_input', requestInputTool)

  // Phase 16: Inter-Kin tools (main only)
  toolRegistry.register('send_message', sendMessageTool)
  toolRegistry.register('reply', replyTool)
  toolRegistry.register('list_kins', listKinsTool)

  // Phase 17: Cron tools (main only)
  toolRegistry.register('create_cron', createCronTool)
  toolRegistry.register('update_cron', updateCronTool)
  toolRegistry.register('delete_cron', deleteCronTool)
  toolRegistry.register('list_crons', listCronsTool)
  // Phase 19: Custom tools (main only)
  toolRegistry.register('register_tool', registerToolTool)
  toolRegistry.register('run_custom_tool', runCustomToolTool)
  toolRegistry.register('list_custom_tools', listCustomToolsTool)

  // Phase 21: Image generation (main only)
  toolRegistry.register('generate_image', generateImageTool)

  // Shell execution (main + sub-kin)
  toolRegistry.register('run_shell', runShellTool)

  log.info({ count: toolRegistry.registeredCount }, 'Native tools registered')
}
