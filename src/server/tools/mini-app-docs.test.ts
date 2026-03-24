import { describe, it, expect } from 'bun:test'
import { getMiniAppDocsTool } from './mini-app-docs'
import type { ToolExecutionContext } from '@/server/tools/types'

const ctx: ToolExecutionContext = {
  kinId: 'test-kin-id',
  userId: 'test-user-id',
  isSubKin: false,
}

// Create the tool instance once
const toolInstance = getMiniAppDocsTool.create(ctx)

// Helper to execute the tool
async function execute(section: string) {
  // The AI SDK tool's execute function expects the parsed input
  return (toolInstance as any).execute({ section }, {} as any)
}

// ─── Registration metadata ───────────────────────────────────────────────────

describe('getMiniAppDocsTool registration', () => {
  it('is available to main agents only', () => {
    expect(getMiniAppDocsTool.availability).toEqual(['main'])
  })

  it('is not default disabled', () => {
    expect(getMiniAppDocsTool.defaultDisabled).toBeUndefined()
  })

  it('creates a tool with description', () => {
    const t = getMiniAppDocsTool.create(ctx) as any
    expect(t.description).toBeDefined()
    expect(typeof t.description).toBe('string')
    expect(t.description.length).toBeGreaterThan(10)
  })
})

// ─── Individual sections ─────────────────────────────────────────────────────

const KNOWN_SECTIONS = [
  'overview',
  'getting-started',
  'hooks',
  'components',
  'sdk',
  'backend',
  'guidelines',
]

describe('getMiniAppDocsTool sections', () => {
  for (const section of KNOWN_SECTIONS) {
    describe(`section "${section}"`, () => {
      it('returns title and content', async () => {
        const result = await execute(section)
        expect(result.title).toBeDefined()
        expect(typeof result.title).toBe('string')
        expect(result.title.length).toBeGreaterThan(0)
      })

      it('returns docsUrl starting with https', async () => {
        const result = await execute(section)
        expect(result.docsUrl).toBeDefined()
        expect(result.docsUrl).toMatch(/^https:\/\//)
      })

      it('returns non-empty content', async () => {
        const result = await execute(section)
        expect(result.content).toBeDefined()
        expect(typeof result.content).toBe('string')
        expect(result.content.length).toBeGreaterThan(50)
      })

      it('content starts with a markdown heading', async () => {
        const result = await execute(section)
        expect(result.content.trimStart()).toMatch(/^#/)
      })

      it('does not return an error field', async () => {
        const result = await execute(section)
        expect(result.error).toBeUndefined()
      })
    })
  }
})

// ─── "all" section ───────────────────────────────────────────────────────────

describe('getMiniAppDocsTool "all" section', () => {
  it('returns a title', async () => {
    const result = await execute('all')
    expect(result.title).toBe('Complete Mini-App SDK Reference')
  })

  it('returns a docsUrl', async () => {
    const result = await execute('all')
    expect(result.docsUrl).toMatch(/^https:\/\//)
  })

  it('returns combined content from all sections', async () => {
    const result = await execute('all')
    expect(result.content).toBeDefined()
    expect(result.content.length).toBeGreaterThan(500)
  })

  it('content includes text from each individual section', async () => {
    const allResult = await execute('all')
    for (const section of KNOWN_SECTIONS) {
      const sectionResult = await execute(section)
      // Each section's content should appear in the combined output
      // Check that the section's actual content is included (not just the title)
      expect(allResult.content).toContain(sectionResult.content)
    }
  })

  it('returns a sections array listing all individual sections', async () => {
    const result = await execute('all')
    expect(result.sections).toBeDefined()
    expect(Array.isArray(result.sections)).toBe(true)
    expect(result.sections.length).toBe(KNOWN_SECTIONS.length)
  })

  it('each section in the array has id, title, and url', async () => {
    const result = await execute('all')
    for (const s of result.sections) {
      expect(typeof s.id).toBe('string')
      expect(typeof s.title).toBe('string')
      expect(typeof s.url).toBe('string')
      expect(s.url).toMatch(/^https:\/\//)
    }
  })

  it('section ids match known sections', async () => {
    const result = await execute('all')
    const ids = result.sections.map((s: any) => s.id)
    for (const section of KNOWN_SECTIONS) {
      expect(ids).toContain(section)
    }
  })

  it('"all" itself is not listed in the sections array', async () => {
    const result = await execute('all')
    const ids = result.sections.map((s: any) => s.id)
    expect(ids).not.toContain('all')
  })
})

// ─── Edge cases ──────────────────────────────────────────────────────────────

describe('getMiniAppDocsTool edge cases', () => {
  it('docs URLs all point to the same base', async () => {
    for (const section of KNOWN_SECTIONS) {
      const result = await execute(section)
      expect(result.docsUrl).toContain('marlburrow.github.io/kinbot')
    }
  })

  it('no section has empty content (except "all" which is assembled)', async () => {
    for (const section of KNOWN_SECTIONS) {
      const result = await execute(section)
      expect(result.content.trim().length).toBeGreaterThan(0)
    }
  })

  it('hooks section mentions useKinBot', async () => {
    const result = await execute('hooks')
    expect(result.content).toContain('useKinBot')
  })

  it('components section mentions Button', async () => {
    const result = await execute('components')
    expect(result.content).toContain('Button')
  })

  it('backend section mentions Hono', async () => {
    const result = await execute('backend')
    expect(result.content).toContain('Hono')
  })

  it('getting-started section mentions app.json', async () => {
    const result = await execute('getting-started')
    expect(result.content).toContain('app.json')
  })

  it('guidelines section mentions dark mode', async () => {
    const result = await execute('guidelines')
    expect(result.content).toMatch(/dark/i)
  })

  it('sdk section mentions toast', async () => {
    const result = await execute('sdk')
    expect(result.content).toContain('toast')
  })

  it('overview section mentions React', async () => {
    const result = await execute('overview')
    expect(result.content).toContain('React')
  })
})
