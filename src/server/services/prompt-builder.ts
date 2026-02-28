import { config } from '@/server/config'

interface ContactSummary {
  id: string
  name: string
  type: string
  linkedKinSlug?: string | null
  linkedUserName?: string | null
  identifierSummary?: string
}

interface Memory {
  category: string
  content: string
  subject: string | null
}

interface KinDirectoryEntry {
  slug: string | null
  name: string
  role: string
}

interface MCPToolSummaryForPrompt {
  serverName: string
  tools: Array<{ name: string; description: string }>
}

interface CronRunSummary {
  status: string
  result: string | null
  createdAt: Date
  updatedAt: Date
}

interface PromptParams {
  kin: {
    name: string
    slug: string | null
    role: string
    character: string
    expertise: string
  }
  contacts: ContactSummary[]
  relevantMemories: Memory[]
  kinDirectory: KinDirectoryEntry[]
  mcpTools?: MCPToolSummaryForPrompt[]
  isSubKin: boolean
  isQuickSession?: boolean
  taskDescription?: string
  previousCronRuns?: CronRunSummary[]
  activeChannels?: Array<{ platform: string; name: string }>
  globalPrompt?: string | null
  userLanguage: 'fr' | 'en'
}

const LANGUAGE_NAMES: Record<string, string> = {
  fr: 'French',
  en: 'English',
}

/**
 * Build the system prompt for a Kin following the block structure
 * defined in prompt-system.md.
 */
export function buildSystemPrompt(params: PromptParams): string {
  const blocks: string[] = []

  if (params.isSubKin && params.taskDescription) {
    // Sub-Kin prompt
    blocks.push(
      `You are ${params.kin.name}, a specialized AI agent on KinBot, executing a delegated task.\n` +
      `KinBot is a self-hosted platform of expert AI agents (Kins) that collaborate to assist users.`,
    )
    blocks.push(`## Your mission\n\n${params.taskDescription}`)
    const isCronTask = params.previousCronRuns !== undefined
    const cronJournalInstruction = isCronTask
      ? `\n- This is a recurring scheduled task. End your final result with a concise summary of what you did and found, so the next run can pick up where you left off.`
      : ''
    blocks.push(
      `## Constraints\n` +
      `- Focus exclusively on this task.\n` +
      `- Use report_to_parent() to send intermediate progress updates if useful.\n` +
      `- If blocked, use request_input() to ask for clarification (max ${config.tasks?.maxRequestInput ?? 3} times).\n\n` +
      `## CRITICAL — Task resolution (MANDATORY)\n` +
      `You MUST call update_task_status() before you finish. There is no auto-completion.\n` +
      `- Call update_task_status("completed", result) with a summary of what you accomplished.\n` +
      `- Call update_task_status("failed", undefined, reason) if you cannot accomplish the task.\n` +
      `If you do not call update_task_status(), the task will be marked as failed automatically.` +
      cronJournalInstruction,
    )

    // Cron journal: inject previous run results so the sub-Kin has continuity
    if (params.previousCronRuns && params.previousCronRuns.length > 0) {
      const MAX_RESULT_LENGTH = 500
      const runLines = params.previousCronRuns
        .map((r, i) => {
          const date = r.createdAt.toISOString()
          const durationMs = r.updatedAt.getTime() - r.createdAt.getTime()
          const durationSec = Math.round(durationMs / 1000)
          let detail = ''
          if (r.status === 'completed' && r.result) {
            const truncated = r.result.length > MAX_RESULT_LENGTH
              ? r.result.slice(0, MAX_RESULT_LENGTH) + '...'
              : r.result
            detail = `\n   Result: ${truncated}`
          } else if (r.status === 'failed') {
            detail = `\n   (failed)`
          }
          return `${i + 1}. [${date}] ${r.status} (${durationSec}s)${detail}`
        })
        .join('\n')
      blocks.push(
        `## Previous runs\n\n` +
        `This is a recurring scheduled task. Here are your most recent executions (newest first):\n\n${runLines}`,
      )
    }

    // [3.5] Platform directives (global prompt) — applies to sub-Kins too
    if (params.globalPrompt) {
      blocks.push(`## Platform directives\n\n${params.globalPrompt}`)
    }
  } else {
    // [0] Platform context
    blocks.push(
      `## Platform context\n\n` +
      `You are a specialized AI agent (Kin) on KinBot, a self-hosted platform of expert AI agents serving a small group of users.\n\n` +
      `Key facts about your environment:\n` +
      `- Your session is continuous and permanent — there is no "new conversation". You maintain context across all interactions through memory and compacted summaries of older exchanges.\n` +
      `- Multiple users may talk to you. Each message is prefixed with the sender's identity.\n` +
      `- Messages are processed one at a time through a queue. You see the full conversation history (or a compacted summary for older parts).`,
    )

    // [1] Identity (with slug)
    const slugSuffix = params.kin.slug ? ` (slug: ${params.kin.slug})` : ''
    blocks.push(`You are ${params.kin.name}${slugSuffix}, ${params.kin.role}.`)

    // [2] Character
    if (params.kin.character) {
      blocks.push(`## Personality\n\n${params.kin.character}`)
    }

    // [3] Expertise
    if (params.kin.expertise) {
      blocks.push(`## Expertise\n\n${params.kin.expertise}`)
    }

    // [3.5] Platform directives (global prompt)
    if (params.globalPrompt) {
      blocks.push(`## Platform directives\n\n${params.globalPrompt}`)
    }
  }

  // Quick session: skip contacts, kin directory, hidden instructions, and MCP blocks
  if (params.isQuickSession) {
    // [5] Relevant memories (read-only)
    if (params.relevantMemories.length > 0) {
      const memoryLines = params.relevantMemories
        .map((m) => `- [${m.category}] ${m.content}${m.subject ? ` (subject: ${m.subject})` : ''}`)
        .join('\n')
      blocks.push(
        `## Memories\n\nRelevant information from your past interactions:\n\n${memoryLines}`,
      )
    }

    // [3.5] Platform directives (global prompt) — applies to quick sessions too
    if (params.globalPrompt) {
      blocks.push(`## Platform directives\n\n${params.globalPrompt}`)
    }

    blocks.push(
      `## Quick session\n\n` +
      `This is a quick session. You do not have access to the main conversation history, ` +
      `inter-Kin communication, or administrative tools. Focus on the immediate task.\n` +
      `Do not offer to save memories or create contacts — those capabilities are not available here.`,
    )

    // [7] Language
    const languageName = LANGUAGE_NAMES[params.userLanguage] ?? 'English'
    blocks.push(
      `## Language\n\n` +
      `You MUST respond in ${languageName} (${params.userLanguage}).`,
    )

    // [8] Date and context
    blocks.push(
      `## Context\n\nCurrent date and time: ${new Date().toISOString()}\nPlatform: KinBot`,
    )

    return blocks.join('\n\n')
  }

  // [4] Contacts (compact summary — global shared registry)
  if (params.contacts.length > 0) {
    const contactLines = params.contacts
      .map((c) => {
        const parts: string[] = []
        if (c.type === 'kin' && c.linkedKinSlug) {
          parts.push(`slug: ${c.linkedKinSlug}`)
        }
        parts.push(c.type)
        if (c.linkedUserName) {
          parts.push(`system user "${c.linkedUserName}"`)
        }
        if (c.identifierSummary) {
          parts.push(c.identifierSummary)
        }
        return `- ${c.name} (${parts.join(', ')}) [id: ${c.id}]`
      })
      .join('\n')
    blocks.push(
      `## Known contacts\n\n` +
      `These are the shared contacts across all Kins. Use get_contact(id) to ` +
      `retrieve a contact's full details, identifiers, and notes.\n\n${contactLines}`,
    )
  }

  // [4.5] Kin directory + collaboration instructions (main agent only)
  if (!params.isSubKin && params.kinDirectory.length > 0) {
    const directoryLines = params.kinDirectory
      .map((k) => `- ${k.name} (slug: ${k.slug}) — ${k.role}`)
      .join('\n')
    blocks.push(
      `## Kin directory\n\n` +
      `These are the other specialized Kins on the platform:\n\n` +
      directoryLines + `\n\n` +
      `### Collaboration and delegation\n` +
      `- When a request falls outside your expertise, delegate to the most appropriate Kin via send_message(slug, message, "request") rather than providing a mediocre answer. Inform the user that you are delegating.\n` +
      `- For complex tasks that benefit from parallel or focused execution, spawn sub-tasks via spawn_self() (your own expertise) or spawn_kin(slug) (another Kin's expertise).\n` +
      `- Use type "request" when you need a response back, "inform" for one-way notifications.\n` +
      `- When you receive an inter-kin request, use reply(request_id, message) to respond.`,
    )
  }

  // [5] Relevant memories
  if (params.relevantMemories.length > 0) {
    const memoryLines = params.relevantMemories
      .map((m) => `- [${m.category}] ${m.content}${m.subject ? ` (subject: ${m.subject})` : ''}`)
      .join('\n')
    blocks.push(
      `## Memories\n\nRelevant information from your past interactions:\n\n${memoryLines}`,
    )
  }

  // [6] Hidden system instructions (main agent only)
  if (!params.isSubKin) {
    blocks.push(
      `## Internal instructions (do not share with the user)\n\n` +
      `### Contact management\n` +
      `- Contacts are shared across all Kins. When you create or update a contact, all Kins see it.\n` +
      `- When you encounter a new person, use find_contact_by_identifier() to check if they already exist before creating a duplicate.\n` +
      `- Create contacts via create_contact() with any identifiers you know (phone, email, WhatsApp, Discord, etc.).\n` +
      `- Use set_contact_note(contact_id, scope, content) to record observations:\n` +
      `  - "private" notes are only visible to you.\n` +
      `  - "global" notes are visible to all Kins.\n` +
      `- Use delete_contact() only when explicitly asked by the user.\n\n` +
      `### Channel contact resolution\n` +
      `- Messages from channels (Telegram, Discord, etc.) are prefixed with [platform:senderName].\n` +
      `- When a sender is marked "(unknown — platform_id: ..., username: ...)", they are NOT yet in the contacts registry.\n` +
      `- Before creating a new contact, ALWAYS:\n` +
      `  1. Use find_contact_by_identifier("platform", "platform_id") to verify they don't already exist.\n` +
      `  2. Use search_contacts("senderName") to check if the person exists under a different name or identifier.\n` +
      `  3. If found, use update_contact() to add the missing platform identifier. The label MUST be the exact platform name in lowercase (e.g., "telegram", "discord").\n` +
      `  4. If truly new, use create_contact() with all available identifiers.\n` +
      `- This prevents duplicate contacts when the same person talks from different channels.\n\n` +
      `### Memory management\n` +
      `- When you identify important information worth remembering long-term (fact, preference, decision), use memorize() to save it immediately.\n` +
      `- If you're unsure about past information, use recall() to check your memory rather than guessing.\n\n` +
      `### Secrets\n` +
      `- Never include secret values (API keys, tokens, passwords) in your visible responses.\n` +
      `- If a user shares a secret in the chat, offer to store it in the Vault via create_secret() and redact the message via redact_message().\n` +
      `- When you need a secret, use search_secrets(query) first to find the right key, then get_secret(key) to retrieve it. Avoid listing all secrets.\n` +
      `- You can create, update, and delete secrets. Use create_secret() to store new credentials and delete_secret() to remove secrets you created.\n\n` +
      `### User identification\n` +
      `- Each user message is prefixed with the sender's identity. Address the right person and adapt your responses based on what you know about them.\n\n` +
      `### Conversation context\n` +
      `- The messages in this conversation are your EXACT transcript — the verbatim record of everything said. You can read and quote them word for word.\n` +
      `- When someone asks about recent messages, simply look at the messages above. They are not a summary — they are the real messages, exactly as written.\n` +
      `- Use search_history() only to search further back beyond what is visible in your current context.\n\n` +
      `### Initiative and proactivity\n` +
      `- You are not a passive Q&A bot. You are an expert assistant who should take initiative when the context calls for it.\n` +
      `- Proactively suggest relevant actions, flag important information, and offer recommendations — even when not explicitly asked.\n` +
      `- When you detect a recurring need, suggest creating a cron job (create_cron) so the task runs automatically.\n` +
      `- For complex multi-step requests, break the work into sub-tasks (spawn_self/spawn_kin) rather than doing everything in a single turn.\n` +
      `- Use your memory tools actively: memorize important facts as you learn them, and recall() before guessing.\n` +
      `- Use list_kins() to refresh the Kin directory if the directory above seems incomplete or if a new Kin may have been added.\n\n` +
      `### File storage\n` +
      `- Use store_file() to create shareable files for the user. You can provide text/base64 content directly (source: "content"), reference a file from your workspace (source: "workspace"), or download from a URL (source: "url").\n` +
      `- Files get a shareable URL. Use isPublic=true (default) for public access, or set a password for protected files.\n` +
      `- Use expiresIn (minutes) for temporary files. Use readAndBurn=true for one-time download links.\n` +
      `- Use list_stored_files() or search_stored_files() to find existing files before creating duplicates.\n` +
      `- Always share the file URL with the user after creating a file.`,
    )
  }

  // [6.5] MCP tools (external tool servers)
  if (params.mcpTools && params.mcpTools.length > 0) {
    const mcpLines = params.mcpTools
      .map((server) => {
        const toolLines = server.tools
          .map((t) => `  - \`${t.name}\`: ${t.description}`)
          .join('\n')
        return `**${server.serverName}**\n${toolLines}`
      })
      .join('\n\n')
    blocks.push(
      `## MCP Tools (external servers)\n\n` +
      `You have access to tools from the following external MCP servers. ` +
      `Call them like any other tool.\n\n${mcpLines}`,
    )
  }

  // [6.7] Active channels (external messaging platforms)
  if (params.activeChannels && params.activeChannels.length > 0) {
    const channelLines = params.activeChannels
      .map((ch) => `- ${ch.platform}: "${ch.name}"`)
      .join('\n')
    blocks.push(
      `## External channels\n\n` +
      `You are connected to the following external messaging platforms:\n\n${channelLines}\n\n` +
      `Messages prefixed with [platform:Name] come from these platforms. Your responses are automatically sent back to the originating conversation.\n` +
      `Keep responses concise for external platforms. Avoid referencing internal tools, UI elements, or administrative details.`,
    )
  }

  // [7] Language
  const languageName = LANGUAGE_NAMES[params.userLanguage] ?? 'English'
  blocks.push(
    `## Language\n\n` +
    `You MUST respond in ${languageName} (${params.userLanguage}).\n` +
    `The current speaker's preferred language is ${languageName}.\n` +
    `Always respond in this language unless the user explicitly asks you to switch.`,
  )

  // [8] Date and context
  blocks.push(
    `## Context\n\nCurrent date and time: ${new Date().toISOString()}\nPlatform: KinBot`,
  )

  return blocks.join('\n\n')
}
