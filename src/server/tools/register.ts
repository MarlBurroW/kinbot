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
  reviewMemoriesTool,
} from '@/server/tools/memory-tools'
import { searchHistoryTool, browseHistoryTool, listSummariesTool, readSummaryTool } from '@/server/tools/history-tools'
import {
  getSecretTool,
  redactMessageTool,
  createSecretTool,
  updateSecretTool,
  deleteSecretTool,
  searchSecretsTool,
  getVaultEntryTool,
  createVaultEntryTool,
  createVaultTypeTool,
  getVaultAttachmentTool,
} from '@/server/tools/vault-tools'
import {
  spawnSelfTool,
  spawnKinTool,
  respondToTaskTool,
  cancelTaskTool,
  listTasksTool,
  listActiveQueuesTool,
  getTaskDetailTool,
} from '@/server/tools/task-tools'
import {
  reportToParentTool,
  updateTaskStatusTool,
  requestInputTool,
} from '@/server/tools/subtask-tools'
import { promptHumanTool } from '@/server/tools/human-prompt-tools'
import { notifyTool } from '@/server/tools/notify-tool'
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
  triggerCronTool,
} from '@/server/tools/cron-tools'
import {
  registerToolTool,
  runCustomToolTool,
  listCustomToolsTool,
} from '@/server/tools/custom-tool-tools'
import { generateImageTool, listImageModelsTool } from '@/server/tools/image-tools'
import { listProvidersTool, listModelsTool } from '@/server/tools/provider-tools'
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
  createChannelTool,
  updateChannelTool,
  deleteChannelTool,
  activateChannelTool,
  deactivateChannelTool,
} from '@/server/tools/channel-tools'
import {
  searchKnowledgeTool,
  listKnowledgeSourcesTool,
} from '@/server/tools/knowledge-tools'
import { getPlatformLogsTool, getPlatformConfigTool, updatePlatformConfigTool, restartPlatformTool } from '@/server/tools/platform-tools'
import { getSystemInfoTool } from '@/server/tools/system-info-tools'
import { httpRequestTool } from '@/server/tools/http-request-tools'
import { executeSqlTool } from '@/server/tools/database-tools'
import {
  listUsersTool,
  getUserTool,
  createInvitationTool,
} from '@/server/tools/user-tools'
import {
  wakeMeInTool,
  wakeMeEveryTool,
  cancelWakeupTool,
  listWakeupsTool,
} from '@/server/tools/wakeup-tools'
import {
  createMiniAppTool,
  updateMiniAppTool,
  deleteMiniAppTool,
  listMiniAppsTool,
  writeMiniAppFileTool,
  readMiniAppFileTool,
  deleteMiniAppFileTool,
  listMiniAppFilesTool,
  getMiniAppStorageTool,
  setMiniAppStorageTool,
  deleteMiniAppStorageTool,
  listMiniAppStorageTool,
  clearMiniAppStorageTool,
  createMiniAppSnapshotTool,
  listMiniAppSnapshotsTool,
  rollbackMiniAppTool,
  generateMiniAppIconTool,
  getMiniAppConsoleTool,
  editMiniAppFileTool,
  multiEditMiniAppFileTool,
} from '@/server/tools/mini-app-tools'
import { getMiniAppTemplatesTool } from '@/server/tools/mini-app-templates'
import { getMiniAppDocsTool } from '@/server/tools/mini-app-docs'
import { browseMiniAppsTool } from '@/server/tools/mini-app-gallery'
import { attachFileTool } from '@/server/tools/attach-file-tool'
import {
  readFileTool,
  writeFileTool,
  editFileTool,
  listDirectoryTool,
} from '@/server/tools/filesystem-tools'
import { grepTool } from '@/server/tools/grep-tools'
import { multiEditTool } from '@/server/tools/multi-edit-tools'
import {
  listInstalledPluginsTool,
  browsePluginStoreTool,
  installPluginTool,
  uninstallPluginTool,
  enablePluginTool,
  disablePluginTool,
  configurePluginTool,
  getPluginDetailsTool,
  checkPluginUpdatesTool,
  updatePluginTool,
} from '@/server/tools/plugin-tools'

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
  toolRegistry.register('review_memories', reviewMemoriesTool)

  // Phase 12: History tools
  toolRegistry.register('search_history', searchHistoryTool)
  toolRegistry.register('browse_history', browseHistoryTool)
  toolRegistry.register('list_summaries', listSummariesTool)
  toolRegistry.register('read_summary', readSummaryTool)

  // Phase 14: Vault tools
  toolRegistry.register('get_secret', getSecretTool)
  toolRegistry.register('redact_message', redactMessageTool)
  toolRegistry.register('create_secret', createSecretTool)
  toolRegistry.register('update_secret', updateSecretTool)
  toolRegistry.register('delete_secret', deleteSecretTool)
  toolRegistry.register('search_secrets', searchSecretsTool)
  toolRegistry.register('get_vault_entry', getVaultEntryTool)
  toolRegistry.register('create_vault_entry', createVaultEntryTool)
  toolRegistry.register('create_vault_type', createVaultTypeTool)
  toolRegistry.register('get_vault_attachment', getVaultAttachmentTool)

  // Phase 15: Task tools (parent — main only)
  toolRegistry.register('spawn_self', spawnSelfTool)
  toolRegistry.register('spawn_kin', spawnKinTool)
  toolRegistry.register('respond_to_task', respondToTaskTool)
  toolRegistry.register('cancel_task', cancelTaskTool)
  toolRegistry.register('list_tasks', listTasksTool)
  toolRegistry.register('list_active_queues', listActiveQueuesTool)
  toolRegistry.register('get_task_detail', getTaskDetailTool)

  // Phase 15: Sub-Kin tools (sub-kin only)
  toolRegistry.register('report_to_parent', reportToParentTool)
  toolRegistry.register('update_task_status', updateTaskStatusTool)
  toolRegistry.register('request_input', requestInputTool)

  // Human-in-the-loop (main + sub-kin)
  toolRegistry.register('prompt_human', promptHumanTool)
  toolRegistry.register('notify', notifyTool)

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
  toolRegistry.register('trigger_cron', triggerCronTool)
  // Phase 19: Custom tools (main only)
  toolRegistry.register('register_tool', registerToolTool)
  toolRegistry.register('run_custom_tool', runCustomToolTool)
  toolRegistry.register('list_custom_tools', listCustomToolsTool)

  // Phase 21: Image tools
  toolRegistry.register('generate_image', generateImageTool)
  toolRegistry.register('list_image_models', listImageModelsTool)

  // Provider & model discovery tools (main + sub-kin)
  toolRegistry.register('list_providers', listProvidersTool)
  toolRegistry.register('list_models', listModelsTool)

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

  // Channel tools (main only, send_channel_message/create/update/delete are opt-in)
  toolRegistry.register('list_channels', listChannelsTool)
  toolRegistry.register('list_channel_conversations', listChannelConversationsTool)
  toolRegistry.register('send_channel_message', sendChannelMessageTool)
  toolRegistry.register('create_channel', createChannelTool)
  toolRegistry.register('update_channel', updateChannelTool)
  toolRegistry.register('delete_channel', deleteChannelTool)
  toolRegistry.register('activate_channel', activateChannelTool)
  toolRegistry.register('deactivate_channel', deactivateChannelTool)
  toolRegistry.register('attach_file', attachFileTool)

  // Platform / system tools (main only, opt-in required)
  toolRegistry.register('get_platform_logs', getPlatformLogsTool)
  toolRegistry.register('get_platform_config', getPlatformConfigTool)
  toolRegistry.register('update_platform_config', updatePlatformConfigTool)
  toolRegistry.register('restart_platform', restartPlatformTool)
  toolRegistry.register('get_system_info', getSystemInfoTool)
  toolRegistry.register('http_request', httpRequestTool)

  // Database tools (main only, opt-in required — God Tier)
  toolRegistry.register('execute_sql', executeSqlTool)

  // User management tools (main only)
  toolRegistry.register('list_users', listUsersTool)
  toolRegistry.register('get_user', getUserTool)
  toolRegistry.register('create_invitation', createInvitationTool)

  // Wake-up scheduler tools (main only)
  toolRegistry.register('wake_me_in', wakeMeInTool)
  toolRegistry.register('wake_me_every', wakeMeEveryTool)
  toolRegistry.register('cancel_wakeup', cancelWakeupTool)
  toolRegistry.register('list_wakeups', listWakeupsTool)

  // Mini-App tools (main only)
  toolRegistry.register('create_mini_app', createMiniAppTool)
  toolRegistry.register('update_mini_app', updateMiniAppTool)
  toolRegistry.register('delete_mini_app', deleteMiniAppTool)
  toolRegistry.register('list_mini_apps', listMiniAppsTool)
  toolRegistry.register('write_mini_app_file', writeMiniAppFileTool)
  toolRegistry.register('read_mini_app_file', readMiniAppFileTool)
  toolRegistry.register('delete_mini_app_file', deleteMiniAppFileTool)
  toolRegistry.register('list_mini_app_files', listMiniAppFilesTool)
  toolRegistry.register('get_mini_app_storage', getMiniAppStorageTool)
  toolRegistry.register('set_mini_app_storage', setMiniAppStorageTool)
  toolRegistry.register('delete_mini_app_storage', deleteMiniAppStorageTool)
  toolRegistry.register('list_mini_app_storage', listMiniAppStorageTool)
  toolRegistry.register('clear_mini_app_storage', clearMiniAppStorageTool)
  toolRegistry.register('create_mini_app_snapshot', createMiniAppSnapshotTool)
  toolRegistry.register('list_mini_app_snapshots', listMiniAppSnapshotsTool)
  toolRegistry.register('rollback_mini_app', rollbackMiniAppTool)
  toolRegistry.register('get_mini_app_templates', getMiniAppTemplatesTool)
  toolRegistry.register('get_mini_app_docs', getMiniAppDocsTool)
  toolRegistry.register('browse_mini_apps', browseMiniAppsTool)
  toolRegistry.register('generate_mini_app_icon', generateMiniAppIconTool)
  toolRegistry.register('get_mini_app_console', getMiniAppConsoleTool)
  toolRegistry.register('edit_mini_app_file', editMiniAppFileTool)
  toolRegistry.register('multi_edit_mini_app_file', multiEditMiniAppFileTool)

  // Plugin management tools (main only, opt-in)
  toolRegistry.register('list_installed_plugins', listInstalledPluginsTool)
  toolRegistry.register('browse_plugin_store', browsePluginStoreTool)
  toolRegistry.register('install_plugin', installPluginTool)
  toolRegistry.register('uninstall_plugin', uninstallPluginTool)
  toolRegistry.register('enable_plugin', enablePluginTool)
  toolRegistry.register('disable_plugin', disablePluginTool)
  toolRegistry.register('configure_plugin', configurePluginTool)
  toolRegistry.register('get_plugin_details', getPluginDetailsTool)
  toolRegistry.register('check_plugin_updates', checkPluginUpdatesTool)
  toolRegistry.register('update_plugin', updatePluginTool)

  // Filesystem tools (main + sub-kin)
  toolRegistry.register('read_file', readFileTool)
  toolRegistry.register('write_file', writeFileTool)
  toolRegistry.register('edit_file', editFileTool)
  toolRegistry.register('multi_edit', multiEditTool)
  toolRegistry.register('list_directory', listDirectoryTool)
  toolRegistry.register('grep', grepTool)

  // Knowledge base tools (main only)
  toolRegistry.register('search_knowledge', searchKnowledgeTool)
  toolRegistry.register('list_knowledge_sources', listKnowledgeSourcesTool)

  log.info({ count: toolRegistry.registeredCount }, 'Native tools registered')
}
