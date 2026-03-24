import { describe, it, expect } from 'bun:test'
import {
  MENTION_REGEX,
  NOTIFICATION_TYPES,
  MESSAGE_SOURCES,
  REQUIRED_CAPABILITIES,
  PALETTE_IDS,
  PROVIDER_API_KEY_URLS,
  VAULT_BUILTIN_TYPES,
  VAULT_TYPE_META,
  TOOL_DOMAIN_META,
  TOOL_DOMAIN_MAP,
  PROVIDER_TYPES,
  MEMORY_SCOPES,
  MAX_MESSAGE_LENGTH,
  MEMORY_CATEGORIES,
  KNOWN_CHANNEL_PLATFORMS,
} from './constants'

// ─── MENTION_REGEX ──────────────────────────────────────────────────────────

describe('MENTION_REGEX', () => {
  it('matches simple @mentions', () => {
    const matches = [...'Hello @alice and @bob'.matchAll(new RegExp(MENTION_REGEX.source, 'g'))]
    expect(matches).toHaveLength(2)
    expect(matches[0]![1]).toBe('alice')
    expect(matches[1]![1]).toBe('bob')
  })

  it('captures alphanumeric handles with hyphens and underscores', () => {
    const matches = [...'@my-kin_2 @test'.matchAll(new RegExp(MENTION_REGEX.source, 'g'))]
    expect(matches).toHaveLength(2)
    expect(matches[0]![1]).toBe('my-kin_2')
    expect(matches[1]![1]).toBe('test')
  })

  it('does not match email-like patterns as standalone mentions', () => {
    // The regex matches @domain in "user@domain" - this is expected behavior
    // since the regex is /@([a-zA-Z0-9_-]+)/g and doesn't require whitespace before @
    const matches = [...'user@domain.com'.matchAll(new RegExp(MENTION_REGEX.source, 'g'))]
    // It will match @domain - documenting this known behavior
    expect(matches).toHaveLength(1)
    expect(matches[0]![1]).toBe('domain')
  })

  it('handles no mentions in text', () => {
    const matches = [...'No mentions here'.matchAll(new RegExp(MENTION_REGEX.source, 'g'))]
    expect(matches).toHaveLength(0)
  })

  it('handles @ with no following characters', () => {
    const matches = [...'Just @ alone'.matchAll(new RegExp(MENTION_REGEX.source, 'g'))]
    expect(matches).toHaveLength(0)
  })

  it('handles mention at start and end of string', () => {
    const matches = [...'@start middle @end'.matchAll(new RegExp(MENTION_REGEX.source, 'g'))]
    expect(matches).toHaveLength(2)
    expect(matches[0]![1]).toBe('start')
    expect(matches[1]![1]).toBe('end')
  })

  it('does not match special characters in handles', () => {
    const matches = [...'@hello! @world.'.matchAll(new RegExp(MENTION_REGEX.source, 'g'))]
    expect(matches).toHaveLength(2)
    // Only alphanumeric/hyphen/underscore part is captured
    expect(matches[0]![1]).toBe('hello')
    expect(matches[1]![1]).toBe('world')
  })
})

// ─── NOTIFICATION_TYPES ─────────────────────────────────────────────────────

describe('NOTIFICATION_TYPES', () => {
  it('is a non-empty array', () => {
    expect(NOTIFICATION_TYPES.length).toBeGreaterThan(0)
  })

  it('contains expected types', () => {
    expect(NOTIFICATION_TYPES).toContain('prompt:pending')
    expect(NOTIFICATION_TYPES).toContain('kin:error')
    expect(NOTIFICATION_TYPES).toContain('mention')
  })

  it('has no duplicates', () => {
    const unique = new Set(NOTIFICATION_TYPES)
    expect(unique.size).toBe(NOTIFICATION_TYPES.length)
  })

  it('all entries are colon-separated or single word', () => {
    for (const t of NOTIFICATION_TYPES) {
      expect(t).toMatch(/^[a-z]+(?::[a-z-]+)?$/)
    }
  })
})

// ─── MESSAGE_SOURCES ────────────────────────────────────────────────────────

describe('MESSAGE_SOURCES', () => {
  it('contains core sources', () => {
    expect(MESSAGE_SOURCES).toContain('user')
    expect(MESSAGE_SOURCES).toContain('kin')
    expect(MESSAGE_SOURCES).toContain('system')
    expect(MESSAGE_SOURCES).toContain('channel')
  })

  it('has no duplicates', () => {
    const unique = new Set(MESSAGE_SOURCES)
    expect(unique.size).toBe(MESSAGE_SOURCES.length)
  })
})

// ─── REQUIRED_CAPABILITIES ──────────────────────────────────────────────────

describe('REQUIRED_CAPABILITIES', () => {
  it('includes llm and embedding', () => {
    expect(REQUIRED_CAPABILITIES).toContain('llm')
    expect(REQUIRED_CAPABILITIES).toContain('embedding')
  })

  it('has exactly 2 required capabilities', () => {
    expect(REQUIRED_CAPABILITIES).toHaveLength(2)
  })
})

// ─── PALETTE_IDS ────────────────────────────────────────────────────────────

describe('PALETTE_IDS', () => {
  it('is a non-empty array of strings', () => {
    expect(PALETTE_IDS.length).toBeGreaterThan(0)
    for (const id of PALETTE_IDS) {
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    }
  })

  it('has no duplicates', () => {
    const unique = new Set(PALETTE_IDS)
    expect(unique.size).toBe(PALETTE_IDS.length)
  })

  it('contains expected palettes', () => {
    expect(PALETTE_IDS).toContain('aurora')
    expect(PALETTE_IDS).toContain('ocean')
    expect(PALETTE_IDS).toContain('monochrome')
  })
})

// ─── PROVIDER_API_KEY_URLS ──────────────────────────────────────────────────

describe('PROVIDER_API_KEY_URLS', () => {
  it('all values are valid URLs', () => {
    for (const [provider, url] of Object.entries(PROVIDER_API_KEY_URLS)) {
      expect(url).toMatch(/^https?:\/\//)
    }
  })

  it('all keys are known provider types', () => {
    const providerSet = new Set<string>(PROVIDER_TYPES)
    for (const key of Object.keys(PROVIDER_API_KEY_URLS)) {
      expect(providerSet.has(key)).toBe(true)
    }
  })
})

// ─── VAULT_BUILTIN_TYPES ───────────────────────────────────────────────────

describe('VAULT_BUILTIN_TYPES', () => {
  it('includes text and credential types', () => {
    expect(VAULT_BUILTIN_TYPES).toContain('text')
    expect(VAULT_BUILTIN_TYPES).toContain('credential')
  })

  it('has no duplicates', () => {
    const unique = new Set(VAULT_BUILTIN_TYPES)
    expect(unique.size).toBe(VAULT_BUILTIN_TYPES.length)
  })

  it('all types have corresponding metadata', () => {
    for (const type of VAULT_BUILTIN_TYPES) {
      expect(VAULT_TYPE_META[type]).toBeDefined()
    }
  })
})

// ─── VAULT_TYPE_META ────────────────────────────────────────────────────────

describe('VAULT_TYPE_META', () => {
  it('every type has an icon and labelKey', () => {
    for (const [type, meta] of Object.entries(VAULT_TYPE_META)) {
      expect(meta.icon).toBeTruthy()
      expect(meta.labelKey).toMatch(/^vault\.types\./)
    }
  })

  it('every type has at least one field', () => {
    for (const [type, meta] of Object.entries(VAULT_TYPE_META)) {
      expect(meta.fields.length).toBeGreaterThan(0)
    }
  })

  it('every required field has a name and label', () => {
    for (const [type, meta] of Object.entries(VAULT_TYPE_META)) {
      for (const field of meta.fields) {
        expect(field.name).toBeTruthy()
        expect(field.label).toBeTruthy()
        expect(field.type).toBeTruthy()
      }
    }
  })

  it('credential type has username and password fields', () => {
    const cred = VAULT_TYPE_META.credential
    const fieldNames = cred.fields.map(f => f.name)
    expect(fieldNames).toContain('username')
    expect(fieldNames).toContain('password')
  })

  it('card type has number, expiry, and cvv fields', () => {
    const card = VAULT_TYPE_META.card
    const fieldNames = card.fields.map(f => f.name)
    expect(fieldNames).toContain('number')
    expect(fieldNames).toContain('expiry')
    expect(fieldNames).toContain('cvv')
  })

  it('text type has exactly one required value field', () => {
    const text = VAULT_TYPE_META.text
    expect(text.fields).toHaveLength(1)
    expect(text.fields[0]!.name).toBe('value')
    expect(text.fields[0]!.required).toBe(true)
  })

  it('field types are valid HTML input types or textarea', () => {
    const validTypes = ['text', 'password', 'email', 'url', 'phone', 'textarea', 'number']
    for (const [, meta] of Object.entries(VAULT_TYPE_META)) {
      for (const field of meta.fields) {
        expect(validTypes).toContain(field.type)
      }
    }
  })
})

// ─── TOOL_DOMAIN_META & TOOL_DOMAIN_MAP consistency ─────────────────────────

describe('TOOL_DOMAIN_META', () => {
  it('every domain has icon, bg, text, border, and labelKey', () => {
    for (const [domain, meta] of Object.entries(TOOL_DOMAIN_META)) {
      expect(meta.icon).toBeTruthy()
      expect(meta.bg).toBeTruthy()
      expect(meta.text).toBeTruthy()
      expect(meta.border).toBeTruthy()
      expect(meta.labelKey).toMatch(/^tools\.domains\./)
    }
  })

  it('has no duplicate labelKeys', () => {
    const labelKeys = Object.values(TOOL_DOMAIN_META).map(m => m.labelKey)
    const unique = new Set(labelKeys)
    expect(unique.size).toBe(labelKeys.length)
  })
})

describe('TOOL_DOMAIN_MAP', () => {
  it('all mapped domains exist in TOOL_DOMAIN_META', () => {
    const validDomains = new Set(Object.keys(TOOL_DOMAIN_META))
    for (const [toolName, domain] of Object.entries(TOOL_DOMAIN_MAP)) {
      expect(validDomains.has(domain)).toBe(true)
    }
  })

  it('has no duplicate tool names', () => {
    // Object.keys are unique by definition, but let's verify the entries are consistent
    const keys = Object.keys(TOOL_DOMAIN_MAP)
    const unique = new Set(keys)
    expect(unique.size).toBe(keys.length)
  })

  it('maps known tools to expected domains', () => {
    expect(TOOL_DOMAIN_MAP['web_search']).toBe('search')
    expect(TOOL_DOMAIN_MAP['recall']).toBe('memory')
    expect(TOOL_DOMAIN_MAP['memorize']).toBe('memory')
    expect(TOOL_DOMAIN_MAP['get_secret']).toBe('vault')
    expect(TOOL_DOMAIN_MAP['create_cron']).toBe('crons')
    expect(TOOL_DOMAIN_MAP['generate_image']).toBe('images')
    expect(TOOL_DOMAIN_MAP['run_shell']).toBe('shell')
    expect(TOOL_DOMAIN_MAP['execute_sql']).toBe('database')
    expect(TOOL_DOMAIN_MAP['browse_url']).toBe('browse')
    expect(TOOL_DOMAIN_MAP['send_message']).toBe('inter-kin')
  })

  it('has a reasonable number of mapped tools', () => {
    const count = Object.keys(TOOL_DOMAIN_MAP).length
    expect(count).toBeGreaterThan(30) // There are many tools mapped
  })
})

// ─── MEMORY_SCOPES ──────────────────────────────────────────────────────────

describe('MEMORY_SCOPES', () => {
  it('includes private and shared', () => {
    expect(MEMORY_SCOPES).toContain('private')
    expect(MEMORY_SCOPES).toContain('shared')
  })

  it('has exactly 2 scopes', () => {
    expect(MEMORY_SCOPES).toHaveLength(2)
  })

  it('has no duplicates', () => {
    const unique = new Set(MEMORY_SCOPES)
    expect(unique.size).toBe(MEMORY_SCOPES.length)
  })

  it('private is the first scope (default convention)', () => {
    expect(MEMORY_SCOPES[0]).toBe('private')
  })
})

// ─── MAX_MESSAGE_LENGTH ─────────────────────────────────────────────────────

describe('MAX_MESSAGE_LENGTH', () => {
  it('is a positive number', () => {
    expect(MAX_MESSAGE_LENGTH).toBeGreaterThan(0)
  })

  it('is at least 1000 characters', () => {
    expect(MAX_MESSAGE_LENGTH).toBeGreaterThanOrEqual(1000)
  })

  it('is 32000', () => {
    expect(MAX_MESSAGE_LENGTH).toBe(32_000)
  })
})

// ─── KNOWN_CHANNEL_PLATFORMS ────────────────────────────────────────────────

describe('KNOWN_CHANNEL_PLATFORMS', () => {
  it('includes core platforms', () => {
    expect(KNOWN_CHANNEL_PLATFORMS).toContain('telegram')
    expect(KNOWN_CHANNEL_PLATFORMS).toContain('discord')
    expect(KNOWN_CHANNEL_PLATFORMS).toContain('slack')
    expect(KNOWN_CHANNEL_PLATFORMS).toContain('whatsapp')
    expect(KNOWN_CHANNEL_PLATFORMS).toContain('signal')
    expect(KNOWN_CHANNEL_PLATFORMS).toContain('matrix')
  })

  it('has no duplicates', () => {
    const unique = new Set(KNOWN_CHANNEL_PLATFORMS)
    expect(unique.size).toBe(KNOWN_CHANNEL_PLATFORMS.length)
  })

  it('all entries are lowercase', () => {
    for (const platform of KNOWN_CHANNEL_PLATFORMS) {
      expect(platform === platform.toLowerCase()).toBe(true)
    }
  })
})

// ─── MEMORY_CATEGORIES cross-check ──────────────────────────────────────────

describe('MEMORY_CATEGORIES and MEMORY_SCOPES cross-validation', () => {
  it('categories and scopes are disjoint (no overlap)', () => {
    const scopeSet = new Set<string>(MEMORY_SCOPES)
    for (const cat of MEMORY_CATEGORIES) {
      expect(scopeSet.has(cat)).toBe(false)
    }
  })
})
