import { describe, test, expect, beforeEach, mock, spyOn } from 'bun:test'
import createPlugin from './index'

// ─── Test data ──────────────────────────────────────────────────────────────

const MOCK_ENTRY = {
  word: 'hello',
  phonetic: '/həˈloʊ/',
  phonetics: [
    { text: '/həˈloʊ/', audio: 'https://example.com/hello.mp3' },
    { text: '/hɛˈloʊ/' },
  ],
  meanings: [
    {
      partOfSpeech: 'exclamation',
      definitions: [
        {
          definition: 'Used as a greeting.',
          synonyms: ['hi', 'hey'],
          antonyms: ['goodbye'],
          example: 'Hello, how are you?',
        },
        {
          definition: 'Used to express surprise.',
          synonyms: [],
          antonyms: [],
        },
      ],
      synonyms: ['greetings', 'salutations'],
      antonyms: ['farewell'],
    },
    {
      partOfSpeech: 'noun',
      definitions: [
        {
          definition: 'An utterance of "hello"; a greeting.',
          synonyms: [],
          antonyms: [],
          example: 'She gave a cheerful hello.',
        },
      ],
      synonyms: [],
      antonyms: [],
    },
  ],
  license: { name: 'CC BY-SA 3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0' },
  sourceUrls: ['https://en.wiktionary.org/wiki/hello'],
}

const MOCK_ENTRY_MANY_DEFS = {
  word: 'run',
  phonetic: '/rʌn/',
  phonetics: [],
  meanings: [
    {
      partOfSpeech: 'verb',
      definitions: [
        { definition: 'Move at a speed faster than a walk.', synonyms: ['sprint'], antonyms: ['walk'], example: 'He ran fast.' },
        { definition: 'Travel a specified distance by running.', synonyms: [], antonyms: [] },
        { definition: 'Manage or be in charge of.', synonyms: ['manage'], antonyms: [] },
        { definition: 'Continue or be valid.', synonyms: [], antonyms: [] },
        { definition: 'Flow or cause to flow.', synonyms: ['flow'], antonyms: [] },
      ],
      synonyms: ['dash', 'race'],
      antonyms: ['stop'],
    },
  ],
  license: { name: 'CC BY-SA 3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0' },
  sourceUrls: [],
}

const MOCK_ENTRY_MINIMAL = {
  word: 'test',
  phonetics: [],
  meanings: [
    {
      partOfSpeech: 'noun',
      definitions: [
        { definition: 'A procedure to assess something.', synonyms: [], antonyms: [] },
      ],
      synonyms: [],
      antonyms: [],
    },
  ],
  license: { name: 'CC BY-SA 3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0' },
  sourceUrls: [],
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeCtx(config: Record<string, string> = {}) {
  return {
    config: {
      defaultLanguage: 'en',
      ...config,
    },
  }
}

function mockFetchSuccess(data: unknown[]) {
  return spyOn(globalThis, 'fetch').mockImplementation(() =>
    Promise.resolve(new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })),
  )
}

function mockFetch404() {
  return spyOn(globalThis, 'fetch').mockImplementation(() =>
    Promise.resolve(new Response('{"title":"No Definitions Found"}', {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })),
  )
}

function mockFetchError(status: number) {
  return spyOn(globalThis, 'fetch').mockImplementation(() =>
    Promise.resolve(new Response('Server Error', {
      status,
      statusText: 'Internal Server Error',
      headers: { 'Content-Type': 'text/plain' },
    })),
  )
}

async function executeTool(plugin: ReturnType<typeof createPlugin>, toolName: string, input: any = {}) {
  const toolDef = (plugin.tools as any)[toolName]
  return toolDef.execute(input)
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Dictionary plugin', () => {
  let ctx: ReturnType<typeof makeCtx>
  let plugin: ReturnType<typeof createPlugin>
  let fetchSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    ctx = makeCtx()
    plugin = createPlugin(ctx)
    fetchSpy?.mockRestore()
  })

  test('exports expected tools', () => {
    expect(Object.keys(plugin.tools).sort()).toEqual([
      'define_word',
      'find_antonyms',
      'find_synonyms',
    ])
  })

  // ─── define_word ────────────────────────────────────────────────────────

  describe('define_word', () => {
    test('returns formatted definition for a word', async () => {
      fetchSpy = mockFetchSuccess([MOCK_ENTRY])

      const result = await executeTool(plugin, 'define_word', { word: 'hello' })

      expect(result.definition).toContain('**hello**')
      expect(result.definition).toContain('/həˈloʊ/')
      expect(result.definition).toContain('Used as a greeting.')
      expect(result.definition).toContain('_exclamation_')
      expect(result.definition).toContain('_noun_')
      expect(result.definition).toContain('Hello, how are you?')
      expect(result.error).toBeUndefined()
    })

    test('includes audio URL when available', async () => {
      fetchSpy = mockFetchSuccess([MOCK_ENTRY])

      const result = await executeTool(plugin, 'define_word', { word: 'hello' })

      expect(result.definition).toContain('🔊 Audio: https://example.com/hello.mp3')
    })

    test('includes source URL', async () => {
      fetchSpy = mockFetchSuccess([MOCK_ENTRY])

      const result = await executeTool(plugin, 'define_word', { word: 'hello' })

      expect(result.definition).toContain('Source: https://en.wiktionary.org/wiki/hello')
    })

    test('truncates definitions to 3 per part of speech by default', async () => {
      fetchSpy = mockFetchSuccess([MOCK_ENTRY_MANY_DEFS])

      const result = await executeTool(plugin, 'define_word', { word: 'run' })

      // Should show first 3 definitions
      expect(result.definition).toContain('1. Move at a speed faster than a walk.')
      expect(result.definition).toContain('2. Travel a specified distance by running.')
      expect(result.definition).toContain('3. Manage or be in charge of.')
      // Should NOT show 4th and 5th
      expect(result.definition).not.toContain('4. Continue or be valid.')
      expect(result.definition).not.toContain('5. Flow or cause to flow.')
      // Should indicate more exist
      expect(result.definition).toContain('2 more definitions...')
    })

    test('shows all definitions when verbose=true', async () => {
      fetchSpy = mockFetchSuccess([MOCK_ENTRY_MANY_DEFS])

      const result = await executeTool(plugin, 'define_word', { word: 'run', verbose: true })

      expect(result.definition).toContain('4. Continue or be valid.')
      expect(result.definition).toContain('5. Flow or cause to flow.')
      expect(result.definition).not.toContain('more definitions...')
    })

    test('shows synonyms and antonyms per meaning', async () => {
      fetchSpy = mockFetchSuccess([MOCK_ENTRY])

      const result = await executeTool(plugin, 'define_word', { word: 'hello' })

      expect(result.definition).toContain('Synonyms:')
      expect(result.definition).toContain('Antonyms:')
    })

    test('handles minimal entry without phonetic or audio', async () => {
      fetchSpy = mockFetchSuccess([MOCK_ENTRY_MINIMAL])

      const result = await executeTool(plugin, 'define_word', { word: 'test' })

      expect(result.definition).toContain('**test**')
      expect(result.definition).not.toContain('🔊')
      expect(result.definition).not.toContain('Source:')
    })

    test('mentions additional entries when multiple exist', async () => {
      fetchSpy = mockFetchSuccess([MOCK_ENTRY, MOCK_ENTRY_MINIMAL])

      const result = await executeTool(plugin, 'define_word', { word: 'hello' })

      expect(result.definition).toContain('1 additional entries available')
    })

    test('does not mention additional entries for single result', async () => {
      fetchSpy = mockFetchSuccess([MOCK_ENTRY])

      const result = await executeTool(plugin, 'define_word', { word: 'hello' })

      expect(result.definition).not.toContain('additional entries')
    })

    test('returns error for word not found (404)', async () => {
      fetchSpy = mockFetch404()

      const result = await executeTool(plugin, 'define_word', { word: 'xyzabc' })

      expect(result.error).toContain('not found')
      expect(result.error).toContain('xyzabc')
    })

    test('returns error for API failure', async () => {
      fetchSpy = mockFetchError(500)

      const result = await executeTool(plugin, 'define_word', { word: 'hello' })

      expect(result.error).toContain('500')
    })

    test('returns error for empty results', async () => {
      fetchSpy = mockFetchSuccess([])

      const result = await executeTool(plugin, 'define_word', { word: 'hello' })

      expect(result.error).toContain('No results found')
    })

    test('uses custom language parameter', async () => {
      fetchSpy = mockFetchSuccess([MOCK_ENTRY_MINIMAL])

      await executeTool(plugin, 'define_word', { word: 'bonjour', language: 'fr' })

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const calledUrl = fetchSpy.mock.calls[0][0] as string
      expect(calledUrl).toContain('/fr/')
      expect(calledUrl).toContain('bonjour')
    })

    test('uses default language from config', async () => {
      const frPlugin = createPlugin(makeCtx({ defaultLanguage: 'fr' }))
      fetchSpy = mockFetchSuccess([MOCK_ENTRY_MINIMAL])

      await executeTool(frPlugin, 'define_word', { word: 'test' })

      const calledUrl = fetchSpy.mock.calls[0][0] as string
      expect(calledUrl).toContain('/fr/')
    })

    test('normalizes word to lowercase and trimmed', async () => {
      fetchSpy = mockFetchSuccess([MOCK_ENTRY])

      await executeTool(plugin, 'define_word', { word: '  Hello  ' })

      const calledUrl = fetchSpy.mock.calls[0][0] as string
      expect(calledUrl).toContain('/hello')
    })
  })

  // ─── find_synonyms ─────────────────────────────────────────────────────

  describe('find_synonyms', () => {
    test('collects synonyms from all meanings and definitions', async () => {
      fetchSpy = mockFetchSuccess([MOCK_ENTRY])

      const result = await executeTool(plugin, 'find_synonyms', { word: 'hello' })

      expect(result.synonyms).toBeArray()
      expect(result.synonyms).toContain('hi')
      expect(result.synonyms).toContain('hey')
      expect(result.synonyms).toContain('greetings')
      expect(result.synonyms).toContain('salutations')
      expect(result.count).toBe(result.synonyms.length)
      expect(result.word).toBe('hello')
    })

    test('deduplicates synonyms', async () => {
      // MOCK_ENTRY_MANY_DEFS has 'sprint' in def and 'dash','race' at meaning level
      fetchSpy = mockFetchSuccess([MOCK_ENTRY_MANY_DEFS])

      const result = await executeTool(plugin, 'find_synonyms', { word: 'run' })

      const unique = new Set(result.synonyms)
      expect(unique.size).toBe(result.synonyms.length)
    })

    test('returns message when no synonyms found', async () => {
      fetchSpy = mockFetchSuccess([MOCK_ENTRY_MINIMAL])

      const result = await executeTool(plugin, 'find_synonyms', { word: 'test' })

      expect(result.result).toContain('No synonyms found')
    })

    test('returns error for 404', async () => {
      fetchSpy = mockFetch404()

      const result = await executeTool(plugin, 'find_synonyms', { word: 'xyzabc' })

      expect(result.error).toContain('not found')
    })

    test('collects synonyms across multiple entries', async () => {
      fetchSpy = mockFetchSuccess([MOCK_ENTRY, MOCK_ENTRY_MANY_DEFS])

      const result = await executeTool(plugin, 'find_synonyms', { word: 'hello' })

      // Should have synonyms from both entries
      expect(result.synonyms).toContain('hi')
      expect(result.synonyms).toContain('dash')
    })
  })

  // ─── find_antonyms ─────────────────────────────────────────────────────

  describe('find_antonyms', () => {
    test('collects antonyms from all meanings and definitions', async () => {
      fetchSpy = mockFetchSuccess([MOCK_ENTRY])

      const result = await executeTool(plugin, 'find_antonyms', { word: 'hello' })

      expect(result.antonyms).toBeArray()
      expect(result.antonyms).toContain('goodbye')
      expect(result.antonyms).toContain('farewell')
      expect(result.count).toBe(result.antonyms.length)
      expect(result.word).toBe('hello')
    })

    test('deduplicates antonyms', async () => {
      fetchSpy = mockFetchSuccess([MOCK_ENTRY])

      const result = await executeTool(plugin, 'find_antonyms', { word: 'hello' })

      const unique = new Set(result.antonyms)
      expect(unique.size).toBe(result.antonyms.length)
    })

    test('returns message when no antonyms found', async () => {
      fetchSpy = mockFetchSuccess([MOCK_ENTRY_MINIMAL])

      const result = await executeTool(plugin, 'find_antonyms', { word: 'test' })

      expect(result.result).toContain('No antonyms found')
    })

    test('returns error for API failure', async () => {
      fetchSpy = mockFetchError(503)

      const result = await executeTool(plugin, 'find_antonyms', { word: 'hello' })

      expect(result.error).toContain('503')
    })
  })

  // ─── Config defaults ──────────────────────────────────────────────────

  describe('config', () => {
    test('defaults to english when no language configured', () => {
      const defaultPlugin = createPlugin({ config: {} })
      // Plugin should work without errors
      expect(Object.keys(defaultPlugin.tools)).toHaveLength(3)
    })
  })
})
