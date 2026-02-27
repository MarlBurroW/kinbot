import { describe, it, expect } from 'bun:test'
import {
  PROVIDER_TYPES,
  AI_PROVIDER_TYPES,
  SEARCH_PROVIDER_TYPES,
  PROVIDER_CAPABILITIES,
  PROVIDER_DISPLAY_NAMES,
  PROVIDERS_WITHOUT_API_KEY,
  REQUIRED_CAPABILITIES,
  MEMORY_CATEGORIES,
  MESSAGE_SOURCES,
  CHANNEL_PLATFORMS,
  TASK_STATUSES,
  NOTIFICATION_TYPES,
  PALETTE_IDS,
  TOOL_DOMAIN_META,
  TOOL_DOMAIN_MAP,
  CONTACT_IDENTIFIER_SUGGESTIONS,
  SUPPORTED_LANGUAGES,
} from '@/shared/constants'
import { PROVIDER_META, type ProviderType, type ProviderMeta } from '@/shared/provider-metadata'

// ─── Provider-derived constants ──────────────────────────────────────────────

describe('PROVIDER_TYPES', () => {
  it('contains all keys from PROVIDER_META', () => {
    const metaKeys = Object.keys(PROVIDER_META)
    expect(PROVIDER_TYPES as string[]).toEqual(metaKeys)
  })

  it('is non-empty', () => {
    expect(PROVIDER_TYPES.length).toBeGreaterThan(0)
  })

  it('contains known providers', () => {
    expect(PROVIDER_TYPES).toContain('openai')
    expect(PROVIDER_TYPES).toContain('anthropic')
    expect(PROVIDER_TYPES).toContain('gemini')
  })
})

describe('AI_PROVIDER_TYPES', () => {
  it('includes providers with llm capability', () => {
    expect(AI_PROVIDER_TYPES).toContain('openai')
    expect(AI_PROVIDER_TYPES).toContain('anthropic')
  })

  it('includes providers with embedding capability', () => {
    expect(AI_PROVIDER_TYPES).toContain('voyage')
    expect(AI_PROVIDER_TYPES).toContain('jina')
    expect(AI_PROVIDER_TYPES).toContain('nomic')
  })

  it('excludes search-only providers', () => {
    expect(AI_PROVIDER_TYPES).not.toContain('brave-search')
    expect(AI_PROVIDER_TYPES).not.toContain('tavily')
  })

  it('is a subset of PROVIDER_TYPES', () => {
    for (const p of AI_PROVIDER_TYPES) {
      expect(PROVIDER_TYPES).toContain(p)
    }
  })
})

describe('SEARCH_PROVIDER_TYPES', () => {
  it('includes search-capable providers', () => {
    expect(SEARCH_PROVIDER_TYPES).toContain('brave-search')
    expect(SEARCH_PROVIDER_TYPES).toContain('tavily')
  })

  it('excludes LLM-only providers', () => {
    expect(SEARCH_PROVIDER_TYPES).not.toContain('anthropic')
    expect(SEARCH_PROVIDER_TYPES).not.toContain('openai')
  })

  it('every entry has search capability in PROVIDER_META', () => {
    for (const p of SEARCH_PROVIDER_TYPES) {
      const meta = PROVIDER_META[p as ProviderType]
      expect(meta.capabilities).toContain('search')
    }
  })
})

describe('PROVIDER_CAPABILITIES', () => {
  it('has an entry for every provider type', () => {
    for (const p of PROVIDER_TYPES) {
      expect(PROVIDER_CAPABILITIES[p]).toBeDefined()
      expect(Array.isArray(PROVIDER_CAPABILITIES[p])).toBe(true)
    }
  })

  it('matches PROVIDER_META capabilities', () => {
    for (const [key, meta] of Object.entries(PROVIDER_META)) {
      expect(PROVIDER_CAPABILITIES[key]).toEqual(meta.capabilities)
    }
  })

  it('openai has llm, embedding, and image', () => {
    expect(PROVIDER_CAPABILITIES['openai']).toContain('llm')
    expect(PROVIDER_CAPABILITIES['openai']).toContain('embedding')
    expect(PROVIDER_CAPABILITIES['openai']).toContain('image')
  })
})

describe('PROVIDER_DISPLAY_NAMES', () => {
  it('has a display name for every provider', () => {
    for (const p of PROVIDER_TYPES) {
      expect(typeof PROVIDER_DISPLAY_NAMES[p]).toBe('string')
      expect(PROVIDER_DISPLAY_NAMES[p]!.length).toBeGreaterThan(0)
    }
  })

  it('matches PROVIDER_META displayName', () => {
    for (const [key, meta] of Object.entries(PROVIDER_META)) {
      expect(PROVIDER_DISPLAY_NAMES[key]).toBe(meta.displayName)
    }
  })
})

describe('PROVIDERS_WITHOUT_API_KEY', () => {
  it('includes ollama', () => {
    expect(PROVIDERS_WITHOUT_API_KEY).toContain('ollama')
  })

  it('includes anthropic-oauth', () => {
    expect(PROVIDERS_WITHOUT_API_KEY).toContain('anthropic-oauth')
  })

  it('excludes providers that need API keys', () => {
    expect(PROVIDERS_WITHOUT_API_KEY).not.toContain('openai')
    expect(PROVIDERS_WITHOUT_API_KEY).not.toContain('anthropic')
  })

  it('every entry has noApiKey=true in PROVIDER_META', () => {
    for (const p of PROVIDERS_WITHOUT_API_KEY) {
      const meta = PROVIDER_META[p as ProviderType] as ProviderMeta
      expect(meta.noApiKey).toBe(true)
    }
  })
})

// ─── AI + Search partition ───────────────────────────────────────────────────

describe('AI + Search provider partition', () => {
  it('every provider is in at least one of AI or Search lists', () => {
    for (const p of PROVIDER_TYPES) {
      const inAI = AI_PROVIDER_TYPES.includes(p as any)
      const inSearch = SEARCH_PROVIDER_TYPES.includes(p as any)
      expect(inAI || inSearch).toBe(true)
    }
  })
})

// ─── Static arrays ───────────────────────────────────────────────────────────

describe('MEMORY_CATEGORIES', () => {
  it('contains expected categories', () => {
    expect(MEMORY_CATEGORIES).toContain('fact')
    expect(MEMORY_CATEGORIES).toContain('preference')
    expect(MEMORY_CATEGORIES).toContain('decision')
    expect(MEMORY_CATEGORIES).toContain('knowledge')
  })

  it('has exactly 4 entries', () => {
    expect(MEMORY_CATEGORIES.length).toBe(4)
  })
})

describe('TASK_STATUSES', () => {
  it('includes terminal states', () => {
    expect(TASK_STATUSES).toContain('completed')
    expect(TASK_STATUSES).toContain('failed')
    expect(TASK_STATUSES).toContain('cancelled')
  })

  it('includes active states', () => {
    expect(TASK_STATUSES).toContain('pending')
    expect(TASK_STATUSES).toContain('in_progress')
    expect(TASK_STATUSES).toContain('awaiting_human_input')
  })
})

describe('CHANNEL_PLATFORMS', () => {
  it('includes telegram and discord', () => {
    expect(CHANNEL_PLATFORMS).toContain('telegram')
    expect(CHANNEL_PLATFORMS).toContain('discord')
  })
})

describe('SUPPORTED_LANGUAGES', () => {
  it('includes en and fr', () => {
    expect(SUPPORTED_LANGUAGES).toContain('en')
    expect(SUPPORTED_LANGUAGES).toContain('fr')
  })
})

// ─── TOOL_DOMAIN_META ────────────────────────────────────────────────────────

describe('TOOL_DOMAIN_META', () => {
  it('every domain has required fields', () => {
    for (const [domain, meta] of Object.entries(TOOL_DOMAIN_META)) {
      expect(typeof meta.icon).toBe('string')
      expect(meta.icon.length).toBeGreaterThan(0)
      expect(typeof meta.bg).toBe('string')
      expect(typeof meta.text).toBe('string')
      expect(typeof meta.border).toBe('string')
      expect(typeof meta.labelKey).toBe('string')
      expect(meta.labelKey).toStartWith('tools.domains.')
    }
  })

  it('has common domains', () => {
    expect(TOOL_DOMAIN_META).toHaveProperty('search')
    expect(TOOL_DOMAIN_META).toHaveProperty('memory')
    expect(TOOL_DOMAIN_META).toHaveProperty('tasks')
    expect(TOOL_DOMAIN_META).toHaveProperty('custom')
  })
})

// ─── TOOL_DOMAIN_MAP ─────────────────────────────────────────────────────────

describe('TOOL_DOMAIN_MAP', () => {
  it('every mapped domain exists in TOOL_DOMAIN_META', () => {
    const validDomains = Object.keys(TOOL_DOMAIN_META)
    for (const [tool, domain] of Object.entries(TOOL_DOMAIN_MAP)) {
      expect(validDomains).toContain(domain)
    }
  })

  it('maps known tools correctly', () => {
    expect(TOOL_DOMAIN_MAP['web_search']).toBe('search')
    expect(TOOL_DOMAIN_MAP['recall']).toBe('memory')
    expect(TOOL_DOMAIN_MAP['memorize']).toBe('memory')
    expect(TOOL_DOMAIN_MAP['spawn_self']).toBe('tasks')
    expect(TOOL_DOMAIN_MAP['generate_image']).toBe('images')
    expect(TOOL_DOMAIN_MAP['run_shell']).toBe('shell')
    expect(TOOL_DOMAIN_MAP['execute_sql']).toBe('database')
  })

  it('has no empty string domains', () => {
    for (const [tool, domain] of Object.entries(TOOL_DOMAIN_MAP)) {
      expect(domain.length).toBeGreaterThan(0)
    }
  })
})

// ─── CONTACT_IDENTIFIER_SUGGESTIONS ──────────────────────────────────────────

describe('CONTACT_IDENTIFIER_SUGGESTIONS', () => {
  it('includes common identifiers', () => {
    expect(CONTACT_IDENTIFIER_SUGGESTIONS).toContain('email')
    expect(CONTACT_IDENTIFIER_SUGGESTIONS).toContain('phone')
    expect(CONTACT_IDENTIFIER_SUGGESTIONS).toContain('github')
  })

  it('has no duplicates', () => {
    const unique = new Set(CONTACT_IDENTIFIER_SUGGESTIONS)
    expect(unique.size).toBe(CONTACT_IDENTIFIER_SUGGESTIONS.length)
  })
})
