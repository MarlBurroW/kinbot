import { describe, expect, it } from 'bun:test'
import { parseModelEnv, guessProviderType } from './model-ref'

describe('parseModelEnv', () => {
  it('returns empty for undefined', () => {
    expect(parseModelEnv(undefined)).toEqual({})
  })

  it('returns empty for empty string', () => {
    expect(parseModelEnv('')).toEqual({})
  })

  it('parses bare model id', () => {
    expect(parseModelEnv('claude-3-sonnet')).toEqual({ model: 'claude-3-sonnet' })
  })

  it('parses providerId:modelId format', () => {
    expect(parseModelEnv('my-provider:claude-3-sonnet')).toEqual({
      providerId: 'my-provider',
      model: 'claude-3-sonnet',
    })
  })

  it('handles model with multiple colons (first colon is separator)', () => {
    expect(parseModelEnv('prov:model:extra')).toEqual({
      providerId: 'prov',
      model: 'model:extra',
    })
  })
})

describe('guessProviderType', () => {
  it('detects anthropic models', () => {
    expect(guessProviderType('claude-3-sonnet')).toBe('anthropic')
    expect(guessProviderType('claude-3.5-opus')).toBe('anthropic')
  })

  it('detects openai models', () => {
    expect(guessProviderType('gpt-4')).toBe('openai')
    expect(guessProviderType('gpt-4o-mini')).toBe('openai')
    expect(guessProviderType('chatgpt-4o-latest')).toBe('openai')
    expect(guessProviderType('o1-preview')).toBe('openai')
    expect(guessProviderType('o3-mini')).toBe('openai')
    expect(guessProviderType('o4-mini')).toBe('openai')
  })

  it('returns null for unknown models', () => {
    expect(guessProviderType('llama-3')).toBeNull()
    expect(guessProviderType('mistral-large')).toBeNull()
    expect(guessProviderType('gemini-pro')).toBeNull()
    expect(guessProviderType('deepseek-chat')).toBeNull()
    expect(guessProviderType('openai/gpt-4o')).toBeNull()
    expect(guessProviderType('')).toBeNull()
  })
})
