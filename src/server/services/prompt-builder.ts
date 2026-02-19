import { config } from '@/server/config'

interface ContactSummary {
  id: string
  name: string
  type: string
}

interface Memory {
  category: string
  content: string
  subject: string | null
}

interface PromptParams {
  kin: {
    name: string
    role: string
    character: string
    expertise: string
  }
  contacts: ContactSummary[]
  relevantMemories: Memory[]
  isSubKin: boolean
  taskDescription?: string
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
    blocks.push(`You are ${params.kin.name}, executing a specific task.`)
    blocks.push(`## Your mission\n\n${params.taskDescription}`)
    blocks.push(
      `## Constraints\n` +
      `- Focus exclusively on this task.\n` +
      `- Use report_to_parent() to send intermediate results or the final result.\n` +
      `- Use update_task_status() to signal your progress.\n` +
      `- When done, set your status to "completed" and send the final result.\n` +
      `- If blocked, use request_input() to ask for clarification (max ${config.tasks.maxRequestInput} times).\n` +
      `- If you cannot accomplish the task, set your status to "failed" with an explanation.`,
    )
  } else {
    // [1] Identity
    blocks.push(`You are ${params.kin.name}, ${params.kin.role}.`)

    // [2] Character
    if (params.kin.character) {
      blocks.push(`## Personality\n\n${params.kin.character}`)
    }

    // [3] Expertise
    if (params.kin.expertise) {
      blocks.push(`## Expertise\n\n${params.kin.expertise}`)
    }
  }

  // [4] Contacts (compact summary)
  if (params.contacts.length > 0) {
    const contactLines = params.contacts
      .map((c) => `- ${c.name} (id: ${c.id}, ${c.type})`)
      .join('\n')
    blocks.push(
      `## Known contacts\n\n` +
      `You know the following people and Kins. Use the get_contact(id) tool to ` +
      `retrieve a contact's details when relevant.\n\n${contactLines}`,
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
      `- When you interact with a new person or someone mentions a person you don't know, create a contact via create_contact().\n` +
      `- When you learn an important fact about an existing contact, update their record via update_contact().\n\n` +
      `### Memory management\n` +
      `- When you identify important information worth remembering long-term (fact, preference, decision), use memorize() to save it immediately.\n` +
      `- If you're unsure about past information, use recall() to check your memory rather than guessing.\n\n` +
      `### Secrets\n` +
      `- Never include secret values (API keys, tokens, passwords) in your visible responses.\n` +
      `- If a user shares a secret in the chat, offer to store it in the Vault and redact the message via redact_message().\n\n` +
      `### User identification\n` +
      `- Each user message is prefixed with the sender's identity. Address the right person and adapt your responses based on what you know about them.`,
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
