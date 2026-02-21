import { Hono } from 'hono'
import { uploadFile } from '@/server/services/files'
import type { AppVariables } from '@/server/app'
import { createLogger } from '@/server/logger'

const log = createLogger('routes:files')

export const fileRoutes = new Hono<{ Variables: AppVariables }>()

// POST /api/files/upload — upload a file
fileRoutes.post('/upload', async (c) => {
  const user = c.get('user') as { id: string; name: string }

  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const kinId = formData.get('kinId') as string | null

  if (!file || !(file instanceof File)) {
    return c.json(
      { error: { code: 'INVALID_FILE', message: 'A file is required' } },
      400,
    )
  }

  if (!kinId) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'kinId is required' } },
      400,
    )
  }

  try {
    const result = await uploadFile({
      kinId,
      uploadedBy: user.id,
      file,
    })

    log.info({ fileId: result.id, kinId, fileName: file.name, size: file.size }, 'File uploaded')
    return c.json({ file: result }, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    const code = message.includes('too large') ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR'
    return c.json({ error: { code, message } }, 400)
  }
})
