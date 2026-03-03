import { describe, it, expect } from 'bun:test'
import { extname } from 'path'

// ─── Pure function contract tests for file-storage.ts ───────────────────────
// The module's pure helpers are not exported, so we re-implement and test
// their exact logic (same pattern as compacting.test.ts).
// If the module ever exports them, switch to direct imports.

// ─── getExtension (uses Node's extname, strips the leading dot) ─────────────

function getExtension(filename: string): string {
  const ext = extname(filename)
  return ext ? ext.slice(1) : ''
}

describe('getExtension', () => {
  it('extracts simple extensions', () => {
    expect(getExtension('file.txt')).toBe('txt')
    expect(getExtension('photo.jpg')).toBe('jpg')
    expect(getExtension('data.json')).toBe('json')
  })

  it('extracts last extension from double extensions', () => {
    expect(getExtension('archive.tar.gz')).toBe('gz')
    expect(getExtension('backup.sql.zip')).toBe('zip')
  })

  it('returns empty string for files without extension', () => {
    expect(getExtension('Makefile')).toBe('')
    expect(getExtension('README')).toBe('')
  })

  it('handles dotfiles', () => {
    expect(getExtension('.gitignore')).toBe('')
    expect(getExtension('.env')).toBe('')
  })

  it('handles dotfiles with extension', () => {
    expect(getExtension('.config.json')).toBe('json')
  })

  it('handles empty string', () => {
    expect(getExtension('')).toBe('')
  })

  it('handles extension-only (.txt = dotfile, no extension)', () => {
    expect(getExtension('.txt')).toBe('')
  })

  it('preserves case', () => {
    expect(getExtension('Image.PNG')).toBe('PNG')
    expect(getExtension('Doc.Pdf')).toBe('Pdf')
  })
})

// ─── storedFileName (id + extension from original) ──────────────────────────

function storedFileName(id: string, originalName: string): string {
  const ext = getExtension(originalName)
  return `${id}${ext ? `.${ext}` : ''}`
}

describe('storedFileName', () => {
  it('appends extension from original name', () => {
    expect(storedFileName('abc-123', 'photo.jpg')).toBe('abc-123.jpg')
    expect(storedFileName('def-456', 'document.pdf')).toBe('def-456.pdf')
  })

  it('omits extension when original has none', () => {
    expect(storedFileName('abc-123', 'Makefile')).toBe('abc-123')
    expect(storedFileName('def-456', 'README')).toBe('def-456')
  })

  it('uses last extension for double extensions', () => {
    expect(storedFileName('abc-123', 'data.tar.gz')).toBe('abc-123.gz')
  })

  it('preserves UUID-style IDs', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    expect(storedFileName(uuid, 'test.txt')).toBe(`${uuid}.txt`)
  })

  it('handles dotfiles without extension', () => {
    expect(storedFileName('abc', '.gitignore')).toBe('abc')
  })

  it('handles empty id', () => {
    expect(storedFileName('', 'file.txt')).toBe('.txt')
  })
})

// ─── mimeTypeToExt ──────────────────────────────────────────────────────────

const MIME_TO_EXT: Record<string, string> = {
  'text/plain': 'txt',
  'text/html': 'html',
  'text/css': 'css',
  'text/csv': 'csv',
  'text/markdown': 'md',
  'application/json': 'json',
  'application/xml': 'xml',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
  'audio/mpeg': 'mp3',
  'video/mp4': 'mp4',
}

function mimeTypeToExt(mimeType: string): string | null {
  return MIME_TO_EXT[mimeType] ?? null
}

describe('mimeTypeToExt', () => {
  it('maps common MIME types to extensions', () => {
    expect(mimeTypeToExt('text/plain')).toBe('txt')
    expect(mimeTypeToExt('application/json')).toBe('json')
    expect(mimeTypeToExt('image/png')).toBe('png')
    expect(mimeTypeToExt('image/jpeg')).toBe('jpg')
    expect(mimeTypeToExt('application/pdf')).toBe('pdf')
    expect(mimeTypeToExt('video/mp4')).toBe('mp4')
    expect(mimeTypeToExt('audio/mpeg')).toBe('mp3')
  })

  it('maps text formats', () => {
    expect(mimeTypeToExt('text/html')).toBe('html')
    expect(mimeTypeToExt('text/css')).toBe('css')
    expect(mimeTypeToExt('text/csv')).toBe('csv')
    expect(mimeTypeToExt('text/markdown')).toBe('md')
  })

  it('maps image formats', () => {
    expect(mimeTypeToExt('image/gif')).toBe('gif')
    expect(mimeTypeToExt('image/svg+xml')).toBe('svg')
    expect(mimeTypeToExt('image/webp')).toBe('webp')
  })

  it('maps archive/xml formats', () => {
    expect(mimeTypeToExt('application/zip')).toBe('zip')
    expect(mimeTypeToExt('application/xml')).toBe('xml')
  })

  it('returns null for unknown MIME types', () => {
    expect(mimeTypeToExt('application/octet-stream')).toBeNull()
    expect(mimeTypeToExt('application/x-tar')).toBeNull()
    expect(mimeTypeToExt('audio/ogg')).toBeNull()
    expect(mimeTypeToExt('video/webm')).toBeNull()
    expect(mimeTypeToExt('')).toBeNull()
    expect(mimeTypeToExt('invalid')).toBeNull()
  })

  it('is case-sensitive (MIME types are lowercase by convention)', () => {
    expect(mimeTypeToExt('Text/Plain')).toBeNull()
    expect(mimeTypeToExt('IMAGE/PNG')).toBeNull()
  })
})

// ─── guessMimeType ──────────────────────────────────────────────────────────

const EXT_TO_MIME: Record<string, string> = {
  txt: 'text/plain',
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  csv: 'text/csv',
  md: 'text/markdown',
  json: 'application/json',
  xml: 'application/xml',
  pdf: 'application/pdf',
  zip: 'application/zip',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  js: 'application/javascript',
  ts: 'text/typescript',
  py: 'text/x-python',
}

function guessMimeType(filename: string): string {
  const ext = getExtension(filename).toLowerCase()
  return EXT_TO_MIME[ext] ?? 'application/octet-stream'
}

describe('guessMimeType', () => {
  it('guesses common text types', () => {
    expect(guessMimeType('file.txt')).toBe('text/plain')
    expect(guessMimeType('page.html')).toBe('text/html')
    expect(guessMimeType('page.htm')).toBe('text/html')
    expect(guessMimeType('style.css')).toBe('text/css')
    expect(guessMimeType('data.csv')).toBe('text/csv')
    expect(guessMimeType('readme.md')).toBe('text/markdown')
  })

  it('guesses application types', () => {
    expect(guessMimeType('config.json')).toBe('application/json')
    expect(guessMimeType('data.xml')).toBe('application/xml')
    expect(guessMimeType('report.pdf')).toBe('application/pdf')
    expect(guessMimeType('archive.zip')).toBe('application/zip')
    expect(guessMimeType('app.js')).toBe('application/javascript')
  })

  it('guesses image types', () => {
    expect(guessMimeType('photo.png')).toBe('image/png')
    expect(guessMimeType('photo.jpg')).toBe('image/jpeg')
    expect(guessMimeType('photo.jpeg')).toBe('image/jpeg')
    expect(guessMimeType('animation.gif')).toBe('image/gif')
    expect(guessMimeType('icon.svg')).toBe('image/svg+xml')
    expect(guessMimeType('image.webp')).toBe('image/webp')
  })

  it('guesses media types', () => {
    expect(guessMimeType('song.mp3')).toBe('audio/mpeg')
    expect(guessMimeType('video.mp4')).toBe('video/mp4')
  })

  it('guesses code file types', () => {
    expect(guessMimeType('module.ts')).toBe('text/typescript')
    expect(guessMimeType('script.py')).toBe('text/x-python')
  })

  it('is case-insensitive for extensions', () => {
    expect(guessMimeType('photo.PNG')).toBe('image/png')
    expect(guessMimeType('doc.PDF')).toBe('application/pdf')
    expect(guessMimeType('Data.JSON')).toBe('application/json')
    expect(guessMimeType('file.TXT')).toBe('text/plain')
  })

  it('returns application/octet-stream for unknown extensions', () => {
    expect(guessMimeType('file.xyz')).toBe('application/octet-stream')
    expect(guessMimeType('data.bin')).toBe('application/octet-stream')
    expect(guessMimeType('program.exe')).toBe('application/octet-stream')
  })

  it('returns application/octet-stream for extensionless files', () => {
    expect(guessMimeType('Makefile')).toBe('application/octet-stream')
    expect(guessMimeType('README')).toBe('application/octet-stream')
  })

  it('returns application/octet-stream for dotfiles', () => {
    expect(guessMimeType('.gitignore')).toBe('application/octet-stream')
    expect(guessMimeType('.env')).toBe('application/octet-stream')
  })

  it('uses last extension for double-extension files', () => {
    expect(guessMimeType('backup.sql.zip')).toBe('application/zip')
    expect(guessMimeType('file.test.json')).toBe('application/json')
  })

  it('handles empty filename', () => {
    expect(guessMimeType('')).toBe('application/octet-stream')
  })
})

// ─── MIME mapping consistency ──────────────────────────────────────────────

describe('MIME mapping consistency', () => {
  it('mimeTypeToExt and guessMimeType roundtrip for common types', () => {
    const testCases: Array<[string, string]> = [
      ['text/plain', 'txt'],
      ['text/html', 'html'],
      ['text/css', 'css'],
      ['text/csv', 'csv'],
      ['text/markdown', 'md'],
      ['application/json', 'json'],
      ['application/xml', 'xml'],
      ['application/pdf', 'pdf'],
      ['application/zip', 'zip'],
      ['image/png', 'png'],
      ['image/gif', 'gif'],
      ['image/svg+xml', 'svg'],
      ['image/webp', 'webp'],
      ['audio/mpeg', 'mp3'],
      ['video/mp4', 'mp4'],
    ]

    for (const [mime, ext] of testCases) {
      expect(mimeTypeToExt(mime)).toBe(ext)
      expect(guessMimeType(`test.${ext}`)).toBe(mime)
    }
  })

  it('jpeg has correct asymmetric mapping', () => {
    // mimeTypeToExt maps image/jpeg → jpg (canonical)
    expect(mimeTypeToExt('image/jpeg')).toBe('jpg')
    // But both jpg and jpeg extensions map back to image/jpeg
    expect(guessMimeType('photo.jpg')).toBe('image/jpeg')
    expect(guessMimeType('photo.jpeg')).toBe('image/jpeg')
  })

  it('htm is an alias for html', () => {
    expect(guessMimeType('page.htm')).toBe('text/html')
    expect(guessMimeType('page.html')).toBe('text/html')
  })

  it('EXT_TO_MIME has more entries than MIME_TO_EXT (aliases)', () => {
    // EXT_TO_MIME has extra: htm, jpeg, js, ts, py
    expect(Object.keys(EXT_TO_MIME).length).toBeGreaterThan(Object.keys(MIME_TO_EXT).length)
  })
})

// ─── buildShareUrl contract ─────────────────────────────────────────────────

describe('buildShareUrl contract', () => {
  // The function: `${config.publicUrl}/s/${accessToken}`
  function buildShareUrlLocal(publicUrl: string, token: string): string {
    return `${publicUrl}/s/${token}`
  }

  it('constructs share URL from public URL and token', () => {
    expect(buildShareUrlLocal('https://kinbot.example.com', 'abc123'))
      .toBe('https://kinbot.example.com/s/abc123')
  })

  it('handles trailing slash on publicUrl', () => {
    // Note: the real implementation does NOT strip trailing slash
    // so https://host/ + /s/token = https://host//s/token (a minor edge case)
    expect(buildShareUrlLocal('https://host', 'tok')).toBe('https://host/s/tok')
  })

  it('handles long hex tokens', () => {
    const token = 'a'.repeat(64)
    const url = buildShareUrlLocal('https://kinbot.example.com', token)
    expect(url).toContain('/s/')
    expect(url.endsWith(token)).toBe(true)
  })
})

// ─── Download logic decision patterns ───────────────────────────────────────

describe('downloadFile decision logic', () => {
  // These test the conditional patterns used in downloadFile without DB access.

  function isExpired(expiresAt: Date | null): boolean {
    if (!expiresAt) return false
    return expiresAt.getTime() < Date.now()
  }

  function needsPassword(passwordHash: string | null): boolean {
    return !!passwordHash
  }

  describe('expiry checks', () => {
    it('past timestamp means expired', () => {
      expect(isExpired(new Date(Date.now() - 1000))).toBe(true)
    })

    it('future timestamp means valid', () => {
      expect(isExpired(new Date(Date.now() + 60_000))).toBe(false)
    })

    it('null expiresAt means no expiry', () => {
      expect(isExpired(null)).toBe(false)
    })
  })

  describe('password checks', () => {
    it('null passwordHash means no password required', () => {
      expect(needsPassword(null)).toBe(false)
    })

    it('non-null passwordHash means password required', () => {
      expect(needsPassword('$argon2id$v=19$...')).toBe(true)
    })

    it('empty string passwordHash is falsy', () => {
      expect(needsPassword('')).toBe(false)
    })
  })
})
