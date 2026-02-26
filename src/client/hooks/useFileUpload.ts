import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

export interface PendingFile {
  /** Client-side unique ID for React keys and removal */
  localId: string
  /** Server-assigned UUID after successful upload */
  serverId: string | null
  /** Server URL for the uploaded file (e.g. /api/uploads/messages/...) */
  serverUrl: string | null
  file: File
  name: string
  mimeType: string
  size: number
  /** Object URL for image previews */
  previewUrl: string | null
  status: 'uploading' | 'done' | 'error'
  error?: string
}

/**
 * Manages file uploads for the chat input.
 * Files are uploaded immediately to `POST /api/files/upload`, then their IDs
 * are passed alongside the message content on send.
 */
export function useFileUpload(kinId: string) {
  const { t } = useTranslation()
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const kinIdRef = useRef(kinId)
  kinIdRef.current = kinId

  const addFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList)
      const entries: PendingFile[] = files.map((file) => {
        const isImage = file.type.startsWith('image/')
        return {
          localId: `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          serverId: null,
          serverUrl: null,
          file,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          previewUrl: isImage ? URL.createObjectURL(file) : null,
          status: 'uploading' as const,
        }
      })

      setPendingFiles((prev) => [...prev, ...entries])

      // Upload each file in parallel
      for (const entry of entries) {
        uploadSingleFile(entry, kinIdRef.current, setPendingFiles)
      }
    },
    [], // kinId accessed via ref to avoid stale closure
  )

  const removeFile = useCallback((localId: string) => {
    setPendingFiles((prev) => {
      const file = prev.find((f) => f.localId === localId)
      if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl)
      return prev.filter((f) => f.localId !== localId)
    })
  }, [])

  const clearFiles = useCallback(() => {
    setPendingFiles((prev) => {
      for (const f of prev) {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl)
      }
      return []
    })
  }, [])

  // Clear files when switching Kins
  useEffect(() => {
    return () => {
      setPendingFiles((prev) => {
        for (const f of prev) {
          if (f.previewUrl) URL.revokeObjectURL(f.previewUrl)
        }
        return []
      })
    }
  }, [kinId])

  const isUploading = pendingFiles.some((f) => f.status === 'uploading')

  return { pendingFiles, addFiles, removeFile, clearFiles, isUploading }
}

async function uploadSingleFile(
  entry: PendingFile,
  kinId: string,
  setPendingFiles: React.Dispatch<React.SetStateAction<PendingFile[]>>,
) {
  try {
    const formData = new FormData()
    formData.append('file', entry.file)
    formData.append('kinId', kinId)

    const res = await fetch('/api/files/upload', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      const message = data?.error?.message ?? t('errors.uploadFailed')
      setPendingFiles((prev) =>
        prev.map((f) =>
          f.localId === entry.localId ? { ...f, status: 'error' as const, error: message } : f,
        ),
      )
      return
    }

    const data = await res.json()
    const serverId = data.file.id as string
    const serverUrl = data.file.url as string

    setPendingFiles((prev) =>
      prev.map((f) =>
        f.localId === entry.localId ? { ...f, status: 'done' as const, serverId, serverUrl } : f,
      ),
    )
  } catch {
    setPendingFiles((prev) =>
      prev.map((f) =>
        f.localId === entry.localId ? { ...f, status: 'error' as const, error: t('errors.uploadFailed') } : f,
      ),
    )
  }
}
