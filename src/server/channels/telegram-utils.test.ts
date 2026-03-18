import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'
import { resolveFileUrl, extractAttachments } from '@/server/channels/telegram-utils'

// ─── Fetch mock helpers ─────────────────────────────────────────────────────

const originalFetch = globalThis.fetch

function mockFetchSequence(responses: Array<() => Response | Promise<Response>>) {
  let callIndex = 0
  globalThis.fetch = mock(async () => {
    const fn = responses[callIndex] ?? responses[responses.length - 1]!
    callIndex++
    return fn()
  }) as unknown as typeof fetch
}

function mockFetchAlways(responseFn: () => Response) {
  globalThis.fetch = mock(async () => responseFn()) as unknown as typeof fetch
}

function telegramOk(filePath: string) {
  return () =>
    new Response(JSON.stringify({ ok: true, result: { file_path: filePath } }), {
      headers: { 'Content-Type': 'application/json' },
    })
}

function telegramFail(description = 'Bad Request') {
  return () =>
    new Response(JSON.stringify({ ok: false, description }), {
      headers: { 'Content-Type': 'application/json' },
    })
}

function telegramNetworkError() {
  return () => {
    throw new Error('Network error')
  }
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

// ─── resolveFileUrl ─────────────────────────────────────────────────────────

describe('resolveFileUrl', () => {
  it('returns URL on first success', async () => {
    mockFetchAlways(telegramOk('photos/file_42.jpg'))

    const url = await resolveFileUrl('test-token', 'file-id-1')
    expect(url).toBe('https://api.telegram.org/file/bottest-token/photos/file_42.jpg')
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('retries once and succeeds on second attempt', async () => {
    mockFetchSequence([telegramFail(), telegramOk('docs/report.pdf')])

    const url = await resolveFileUrl('test-token', 'file-id-2')
    expect(url).toBe('https://api.telegram.org/file/bottest-token/docs/report.pdf')
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('returns null after two failures (non-ok response)', async () => {
    mockFetchAlways(telegramFail('File not found'))

    const url = await resolveFileUrl('test-token', 'file-id-3')
    expect(url).toBeNull()
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('retries on network error and succeeds', async () => {
    mockFetchSequence([telegramNetworkError() as unknown as () => Response, telegramOk('audio/voice.ogg')])

    const url = await resolveFileUrl('test-token', 'file-id-4')
    expect(url).toBe('https://api.telegram.org/file/bottest-token/audio/voice.ogg')
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('returns null after two network errors', async () => {
    mockFetchAlways(telegramNetworkError() as unknown as () => Response)

    const url = await resolveFileUrl('test-token', 'file-id-5')
    expect(url).toBeNull()
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('returns null when file_path is missing from response', async () => {
    mockFetchAlways(
      () =>
        new Response(JSON.stringify({ ok: true, result: {} }), {
          headers: { 'Content-Type': 'application/json' },
        }),
    )

    const url = await resolveFileUrl('test-token', 'file-id-6')
    expect(url).toBeNull()
  })
})

// ─── extractAttachments ─────────────────────────────────────────────────────

describe('extractAttachments', () => {
  beforeEach(() => {
    // Mock all getFile calls to succeed
    mockFetchAlways(telegramOk('files/test_file'))
  })

  it('returns empty array for message with no attachments', async () => {
    const result = await extractAttachments({ text: 'Hello' }, 'token')
    expect(result).toEqual([])
  })

  it('extracts photo — picks largest from array', async () => {
    const message = {
      photo: [
        { file_id: 'small', file_unique_id: 's', width: 100, height: 100, file_size: 1000 },
        { file_id: 'medium', file_unique_id: 'm', width: 320, height: 320, file_size: 5000 },
        { file_id: 'large', file_unique_id: 'l', width: 800, height: 800, file_size: 20000 },
      ],
    }

    const result = await extractAttachments(message, 'token')
    expect(result).toHaveLength(1)
    expect(result[0]!.platformFileId).toBe('large')
    expect(result[0]!.mimeType).toBe('image/jpeg')
    expect(result[0]!.fileSize).toBe(20000)
    expect(result[0]!.url).toContain('api.telegram.org')
  })

  it('extracts document with mime type and filename', async () => {
    const message = {
      document: {
        file_id: 'doc-1',
        file_unique_id: 'd1',
        file_name: 'report.pdf',
        mime_type: 'application/pdf',
        file_size: 50000,
      },
    }

    const result = await extractAttachments(message, 'token')
    expect(result).toHaveLength(1)
    expect(result[0]!.platformFileId).toBe('doc-1')
    expect(result[0]!.mimeType).toBe('application/pdf')
    expect(result[0]!.fileName).toBe('report.pdf')
  })

  it('extracts audio with default mime', async () => {
    const message = {
      audio: {
        file_id: 'audio-1',
        file_unique_id: 'a1',
        duration: 120,
        title: 'My Song',
      },
    }

    const result = await extractAttachments(message, 'token')
    expect(result).toHaveLength(1)
    expect(result[0]!.platformFileId).toBe('audio-1')
    expect(result[0]!.mimeType).toBe('audio/mpeg')
    expect(result[0]!.fileName).toBe('My Song.mp3')
  })

  it('extracts video', async () => {
    const message = {
      video: {
        file_id: 'video-1',
        file_unique_id: 'v1',
        duration: 30,
        width: 1920,
        height: 1080,
        mime_type: 'video/mp4',
      },
    }

    const result = await extractAttachments(message, 'token')
    expect(result).toHaveLength(1)
    expect(result[0]!.platformFileId).toBe('video-1')
    expect(result[0]!.mimeType).toBe('video/mp4')
  })

  it('extracts voice message', async () => {
    const message = {
      voice: {
        file_id: 'voice-1',
        file_unique_id: 'vo1',
        duration: 5,
      },
    }

    const result = await extractAttachments(message, 'token')
    expect(result).toHaveLength(1)
    expect(result[0]!.platformFileId).toBe('voice-1')
    expect(result[0]!.mimeType).toBe('audio/ogg')
  })

  it('extracts video note', async () => {
    const message = {
      video_note: {
        file_id: 'vn-1',
        file_unique_id: 'vn1',
        duration: 10,
        length: 240,
      },
    }

    const result = await extractAttachments(message, 'token')
    expect(result).toHaveLength(1)
    expect(result[0]!.platformFileId).toBe('vn-1')
    expect(result[0]!.mimeType).toBe('video/mp4')
  })

  it('extracts static sticker but skips animated', async () => {
    const message = {
      sticker: {
        file_id: 'sticker-1',
        file_unique_id: 'st1',
        width: 512,
        height: 512,
        is_animated: true,
        is_video: false,
      },
    }

    const result = await extractAttachments(message, 'token')
    expect(result).toHaveLength(0)
  })

  it('extracts static sticker', async () => {
    const message = {
      sticker: {
        file_id: 'sticker-2',
        file_unique_id: 'st2',
        width: 512,
        height: 512,
        is_animated: false,
        is_video: false,
      },
    }

    const result = await extractAttachments(message, 'token')
    expect(result).toHaveLength(1)
    expect(result[0]!.platformFileId).toBe('sticker-2')
    expect(result[0]!.mimeType).toBe('image/webp')
  })

  it('handles resolveFileUrl returning null (url is undefined)', async () => {
    mockFetchAlways(telegramFail('File too large'))

    const message = {
      document: {
        file_id: 'big-file',
        file_unique_id: 'bf1',
        file_name: 'huge.zip',
        mime_type: 'application/zip',
        file_size: 100_000_000,
      },
    }

    const result = await extractAttachments(message, 'token')
    expect(result).toHaveLength(1)
    expect(result[0]!.platformFileId).toBe('big-file')
    expect(result[0]!.url).toBeUndefined()
    expect(result[0]!.fileName).toBe('huge.zip')
  })

  it('extracts multiple attachment types from one message', async () => {
    const message = {
      photo: [
        { file_id: 'photo-1', file_unique_id: 'p1', width: 800, height: 600 },
      ],
      caption: 'Check this photo',
    }

    const result = await extractAttachments(message, 'token')
    expect(result).toHaveLength(1)
    expect(result[0]!.platformFileId).toBe('photo-1')
  })
})
