import { describe, it, expect, beforeAll, mock } from 'bun:test'

// Mock config before importing the module under test
const TEST_KEY = 'a'.repeat(64)
mock.module('@/server/config', () => ({
  config: {
    encryptionKey: TEST_KEY,
  },
}))

import { encrypt, decrypt, _resetKeyCache } from './encryption'

describe('encryption service', () => {
  beforeAll(() => {
    // Reset cached key to ensure our mocked config is used,
    // even if another test file imported encryption.ts first
    _resetKeyCache()
  })

  it('encrypts and decrypts a simple string', async () => {
    const plaintext = 'hello world'
    const encrypted = await encrypt(plaintext)
    const decrypted = await decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it('returns a base64 string', async () => {
    const encrypted = await encrypt('test')
    // base64 only contains [A-Za-z0-9+/=]
    expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+$/)
  })

  it('produces different ciphertexts for the same input (random IV)', async () => {
    const a = await encrypt('same input')
    const b = await encrypt('same input')
    expect(a).not.toBe(b)
  })

  it('both ciphertexts decrypt to the same plaintext', async () => {
    const plaintext = 'deterministic output'
    const a = await encrypt(plaintext)
    const b = await encrypt(plaintext)
    expect(await decrypt(a)).toBe(plaintext)
    expect(await decrypt(b)).toBe(plaintext)
  })

  it('handles empty string', async () => {
    const encrypted = await encrypt('')
    const decrypted = await decrypt(encrypted)
    expect(decrypted).toBe('')
  })

  it('handles unicode characters', async () => {
    const plaintext = '🔑 clé secrète à décrypter 日本語'
    const encrypted = await encrypt(plaintext)
    const decrypted = await decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it('handles long strings', async () => {
    const plaintext = 'x'.repeat(10000)
    const encrypted = await encrypt(plaintext)
    const decrypted = await decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it('fails to decrypt tampered ciphertext', async () => {
    const encrypted = await encrypt('sensitive data')
    // Tamper with the base64 string (flip a character in the middle)
    const chars = encrypted.split('')
    const mid = Math.floor(chars.length / 2)
    chars[mid] = chars[mid] === 'A' ? 'B' : 'A'
    const tampered = chars.join('')

    await expect(decrypt(tampered)).rejects.toThrow()
  })

  it('fails to decrypt garbage input', async () => {
    await expect(decrypt('not-valid-base64!!!')).rejects.toThrow()
  })

  it('fails to decrypt truncated ciphertext', async () => {
    const encrypted = await encrypt('hello')
    // Take only the first few characters (just the IV, no ciphertext)
    const truncated = encrypted.slice(0, 16)
    await expect(decrypt(truncated)).rejects.toThrow()
  })
})
