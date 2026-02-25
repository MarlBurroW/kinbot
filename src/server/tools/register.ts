import { createLogger } from '@/server/logger'
import { toolRegistry } from '@/server/tools/index'
import { webSearchTool } from '@/server/tools/search-tools'
import {
  browseUrlTool,
  extractLinksTool,
  screenshotUrlTool,
} from '@/server/tools/browse-tools'
import {
  getContactTool,
  searchContactsTool,
  createContactTool,
  updateContactTool,
  deleteContactTool,
  setContactNoteTool,
  findContactByIdentifierTool,
} from '@/server/tools/contact-tools'
import {
  recallTool,
  memorizeTool,
  updateMemoryTool,
  forgetTool,
  listMemoriesTool,
} from '@/server/tools/memory-tools'
import { searchHistoryTool } from '@/server/tools/history-tools'
import {
  getSecretTool,
  redactMessageTool,
  createSecretTool,
  updateSecretTool,
  deleteSecretTool,
  searchSecretsTool,
} from '@/server/tools/vault-tools'
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
import { promptHumanTool } from '@/server/tools/human-prompt-tools'
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
  getCronJournalTool,
} from '@/server/tools/cron-tools'
import {
  registerToolTool,
  runCustomToolTool,
  listCustomToolsTool,
} from '@/server/tools/custom-tool-tools'
import { generateImageTool, listImageModelsTool } from '@/server/tools/image-tools'
import { runShellTool } from '@/server/tools/shell-tools'
import {
  addMcpServerTool,
  updateMcpServerTool,
  removeMcpServerTool,
  listMcpServersTool,
} from '@/server/tools/mcp-tools'
import {
  storeFileTool,
  getStoredFileTool,
  listStoredFilesTool,
  searchStoredFilesTool,
  updateStoredFileTool,
  deleteStoredFileTool,
} from '@/server/tools/file-storage-tools'
import {
  createKinTool,
  updateKinTool,
  deleteKinTool,
  getKinDetailsTool,
} from '@/server/tools/kin-management-tools'
import {
  createWebhookTool,
  updateWebhookTool,
  deleteWebhookTool,
  listWebhooksTool,
} from '@/server/tools/webhook-tools'
import {
  listChannelsTool,
  listChannelConversationsTool,
  sendChannelMessageTool,
} from '@/server/tools/channel-tools'
import { getPlatformLogsTool } from '@/server/tools/platform-tools'
import { executeSqlTool } from '@/server/tools/database-tools'
import {
  listUsersTool,
  getUserTool,
  createInvitationTool,
} from '@/server/tools/user-tools'
import {
  wakeMeInTool,
  cancelWakeupTool,
  listWakeupsTool,
} from '@/server/tools/wakeup-tools'

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

  // Web browsing
  toolRegistry.register('browse_url', browseUrlTool)
  toolRegistry.register('extract_links', extractLinksTool)
  toolRegistry.register('screenshot_url', screenshotUrlTool)

  // Phase 11: Contact tools
  toolRegistry.register('get_contact', getContactTool)
  toolRegistry.register('search_contacts', searchContactsTool)
  toolRegistry.register('create_contact', createContactTool)
  toolRegistry.register('update_contact', updateContactTool)
  toolRegistry.register('delete_contact', deleteContactTool)
  toolRegistry.register('set_contact_note', setContactNoteTool)
  toolRegistry.register('find_contact_by_identifier', findContactByIdentifierTool)

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
  toolRegistry.register('create_secret', createSecretTool)
  toolRegistry.register('update_secret', updateSecretTool)
  toolRegistry.register('delete_secret', deleteSecretTool)
  toolRegistry.register('search_secrets', searchSecretsTool)

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

  // Human-in-the-loop (main + sub-kin)
  toolRegistry.register('prompt_human', promptHumanTool)

  // Phase 16: Inter-Kin tools (main only)
  toolRegistry.register('send_message', sendMessageTool)
  toolRegistry.register('reply', replyTool)
  toolRegistry.register('list_kins', listKinsTool)

  // Phase 17: Cron tools (main only)
  toolRegistry.register('create_cron', createCronTool)
  toolRegistry.register('update_cron', updateCronTool)
  toolRegistry.register('delete_cron', deleteCronTool)
  toolRegistry.register('list_crons', listCronsTool)
  toolRegistry.register('get_cron_journal', getCronJournalTool)
  // Phase 19: Custom tools (main only)
  toolRegistry.register('register_tool', registerToolTool)
  toolRegistry.register('run_custom_tool', runCustomToolTool)
  toolRegistry.register('list_custom_tools', listCustomToolsTool)

  // Phase 21: Image tools
  toolRegistry.register('generate_image', generateImageTool)
  toolRegistry.register('list_image_models', listImageModelsTool)

  // Phase 18: MCP management tools (main only)
  toolRegistry.register('add_mcp_server', addMcpServerTool)
  toolRegistry.register('update_mcp_server', updateMcpServerTool)
  toolRegistry.register('remove_mcp_server', removeMcpServerTool)
  toolRegistry.register('list_mcp_servers', listMcpServersTool)

  // Shell execution (main + sub-kin)
  toolRegistry.register('run_shell', runShellTool)

  // File storage tools (main only)
  toolRegistry.register('store_file', storeFileTool)
  toolRegistry.register('get_stored_file', getStoredFileTool)
  toolRegistry.register('list_stored_files', listStoredFilesTool)
  toolRegistry.register('search_stored_files', searchStoredFilesTool)
  toolRegistry.register('update_stored_file', updateStoredFileTool)
  toolRegistry.register('delete_stored_file', deleteStoredFileTool)

  // Kin management tools (main only, opt-in required)
  toolRegistry.register('create_kin', createKinTool)
  toolRegistry.register('update_kin', updateKinTool)
  toolRegistry.register('delete_kin', deleteKinTool)
  toolRegistry.register('get_kin_details', getKinDetailsTool)

  // Webhook tools (main only)
  toolRegistry.register('create_webhook', createWebhookTool)
  toolRegistry.register('update_webhook', updateWebhookTool)
  toolRegistry.register('delete_webhook', deleteWebhookTool)
  toolRegistry.register('list_webhooks', listWebhooksTool)

  // Channel tools (main only, send_channel_message is opt-in)
  toolRegistry.register('list_channels', listChannelsTool)
  toolRegistry.register('list_channel_conversations', listChannelConversationsTool)
  toolRegistry.register('send_channel_message', sendChannelMessageTool)

  // Platform / system tools (main only, opt-in required)
  toolRegistry.register('get_platform_logs', getPlatformLogsTool)

  // Database tools (main only, opt-in required — God Tier)
  toolRegistry.register('execute_sql', executeSqlTool)

  // User management tools (main only)
  toolRegistry.register('list_users', listUsersTool)
  toolRegistry.register('get_user', getUserTool)
  toolRegistry.register('create_invitation', createInvitationTool)

  // Wake-up scheduler tools (main only)
  toolRegistry.register('wake_me_in', wakeMeInTool)
  toolRegistry.register('cancel_wakeup', cancelWakeupTool)
  toolRegistry.register('list_wakeups', listWakeupsTool)

  log.info({ count: toolRegistry.registeredCount }, 'Native tools registered')
}
