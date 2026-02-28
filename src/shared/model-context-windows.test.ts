import { describe, it, expect } from 'bun:test'
import { getModelContextWindow } from './model-context-windows'

describe('getModelContextWindow', () => {
  // ── Exact matches ──

  it('returns correct window for exact model IDs', () => {
    expect(getModelContextWindow('gpt-4')).toBe(8_192)
    expect(getModelContextWindow('gpt-3.5-turbo')).toBe(16_385)
    expect(getModelContextWindow('deepseek-chat')).toBe(64_000)
    expect(getModelContextWindow('command-r-plus')).toBe(128_000)
    expect(getModelContextWindow('command-a')).toBe(256_000)
    expect(getModelContextWindow('codestral')).toBe(256_000)
  })

  // ── Prefix matching ──

  it('matches Anthropic models by prefix', () => {
    expect(getModelContextWindow('claude-sonnet-4-20250514')).toBe(200_000)
    expect(getModelContextWindow('claude-opus-4-20250514')).toBe(200_000)
    expect(getModelContextWindow('claude-3-5-sonnet-20241022')).toBe(200_000)
    expect(getModelContextWindow('claude-3-5-haiku-20241022')).toBe(200_000)
    expect(getModelContextWindow('claude-3-opus-20240229')).toBe(200_000)
  })

  it('matches OpenAI models by prefix', () => {
    expect(getModelContextWindow('gpt-4o-2024-08-06')).toBe(128_000)
    expect(getModelContextWindow('gpt-4o-mini')).toBe(128_000)
    expect(getModelContextWindow('gpt-4-0125-preview')).toBe(128_000)
    expect(getModelContextWindow('gpt-4.1-nano')).toBe(1_047_576)
    expect(getModelContextWindow('gpt-4.1-mini')).toBe(1_047_576)
    expect(getModelContextWindow('chatgpt-4o-latest')).toBe(128_000)
    expect(getModelContextWindow('o3-mini')).toBe(200_000)
    expect(getModelContextWindow('o4-mini-2025')).toBe(200_000)
  })

  it('matches Google Gemini models by prefix', () => {
    expect(getModelContextWindow('gemini-2.5-pro')).toBe(1_000_000)
    expect(getModelContextWindow('gemini-2.5-flash')).toBe(1_000_000)
    expect(getModelContextWindow('gemini-2.0-flash')).toBe(1_000_000)
    expect(getModelContextWindow('gemini-1.5-pro-latest')).toBe(2_000_000)
    expect(getModelContextWindow('gemini-1.5-flash-8b')).toBe(1_000_000)
  })

  it('matches xAI Grok models by prefix', () => {
    expect(getModelContextWindow('grok-2')).toBe(131_072)
    expect(getModelContextWindow('grok-beta')).toBe(131_072)
  })

  it('matches Meta Llama models by prefix', () => {
    expect(getModelContextWindow('llama-3.3-70b')).toBe(128_000)
    expect(getModelContextWindow('llama-3.1-8b')).toBe(128_000)
    expect(getModelContextWindow('llama-3-70b')).toBe(8_192)
    expect(getModelContextWindow('llama3-8b')).toBe(8_192)
  })

  it('matches Perplexity Sonar models by prefix', () => {
    expect(getModelContextWindow('sonar-pro')).toBe(128_000)
    expect(getModelContextWindow('sonar-small-chat')).toBe(128_000)
  })

  // ── Longest prefix matching ──

  it('prefers longest prefix match', () => {
    // "gpt-4o" (6 chars) should beat "gpt-4-" (6 chars) or "gpt-4" (5 chars)
    // gpt-4o = 128k, gpt-4 = 8k
    expect(getModelContextWindow('gpt-4o-mini-2024')).toBe(128_000)

    // "gpt-4-0125" (10 chars) should beat "gpt-4-" (6 chars)
    expect(getModelContextWindow('gpt-4-0125-preview')).toBe(128_000)

    // "llama-3.3" should beat "llama-3-"
    expect(getModelContextWindow('llama-3.3-70b-instruct')).toBe(128_000)
  })

  // ── Default fallback ──

  it('returns 128k default for unknown models', () => {
    expect(getModelContextWindow('some-unknown-model')).toBe(128_000)
    expect(getModelContextWindow('')).toBe(128_000)
    expect(getModelContextWindow('phi-3-mini')).toBe(128_000)
    expect(getModelContextWindow('qwen-72b')).toBe(128_000)
  })

  // ── Edge cases ──

  it('handles model IDs that are substrings of known keys', () => {
    // "o1" is an exact key
    expect(getModelContextWindow('o1')).toBe(200_000)
    // "o1-mini" should match "o1" prefix
    expect(getModelContextWindow('o1-mini')).toBe(200_000)
    // "o3" is an exact key
    expect(getModelContextWindow('o3')).toBe(200_000)
  })

  it('is case-sensitive', () => {
    // Model IDs are lowercase by convention; uppercase should fall to default
    expect(getModelContextWindow('GPT-4')).toBe(128_000)
    expect(getModelContextWindow('Claude-3-opus')).toBe(128_000)
  })

  it('handles Mistral models', () => {
    expect(getModelContextWindow('mistral-large-latest')).toBe(128_000)
    expect(getModelContextWindow('mistral-small-latest')).toBe(128_000)
    expect(getModelContextWindow('open-mistral-nemo-2407')).toBe(128_000)
    expect(getModelContextWindow('pixtral-large-latest')).toBe(128_000)
  })

  it('handles DeepSeek models', () => {
    expect(getModelContextWindow('deepseek-chat')).toBe(64_000)
    expect(getModelContextWindow('deepseek-reasoner')).toBe(64_000)
    expect(getModelContextWindow('deepseek-coder-v2')).toBe(128_000)
  })

  it('handles Cohere models', () => {
    expect(getModelContextWindow('command-r-plus')).toBe(128_000)
    expect(getModelContextWindow('command-r')).toBe(128_000)
    expect(getModelContextWindow('command-a-03-2025')).toBe(256_000)
  })
})
