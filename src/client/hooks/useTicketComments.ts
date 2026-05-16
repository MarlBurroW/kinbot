import { useState, useEffect, useCallback } from 'react'
import { api } from '@/client/lib/api'
import { useSSE } from '@/client/hooks/useSSE'
import type { TicketComment } from '@/shared/types'

interface ListResponse {
  comments: TicketComment[]
  hasMore: boolean
}

export function useTicketComments(ticketId: string | null) {
  const [comments, setComments] = useState<TicketComment[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const refetch = useCallback(async () => {
    if (!ticketId) {
      setComments([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const data = await api.get<ListResponse>(`/tickets/${ticketId}/comments`)
      setComments(data.comments)
    } catch {
      setComments([])
    } finally {
      setIsLoading(false)
    }
  }, [ticketId])

  useEffect(() => {
    refetch()
  }, [refetch])

  useSSE({
    'ticket:comment-added': (data) => {
      const comment = data.comment as TicketComment
      if (comment.ticketId !== ticketId) return
      setComments((prev) => {
        if (prev.some((c) => c.id === comment.id)) return prev
        // Keep chronological order — newest goes at the end.
        return [...prev, comment]
      })
    },
    'ticket:comment-updated': (data) => {
      const comment = data.comment as TicketComment
      if (comment.ticketId !== ticketId) return
      setComments((prev) => prev.map((c) => (c.id === comment.id ? comment : c)))
    },
    'ticket:comment-deleted': (data) => {
      const { commentId, ticketId: tid } = data as { commentId: string; ticketId: string }
      if (tid !== ticketId) return
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    },
  })

  const createComment = useCallback(
    async (content: string): Promise<TicketComment | null> => {
      if (!ticketId) return null
      const data = await api.post<{ comment: TicketComment }>(
        `/tickets/${ticketId}/comments`,
        { content },
      )
      return data.comment
    },
    [ticketId],
  )

  const updateComment = useCallback(
    async (commentId: string, content: string): Promise<TicketComment | null> => {
      if (!ticketId) return null
      const data = await api.patch<{ comment: TicketComment }>(
        `/tickets/${ticketId}/comments/${commentId}`,
        { content },
      )
      return data.comment
    },
    [ticketId],
  )

  const deleteComment = useCallback(
    async (commentId: string): Promise<void> => {
      if (!ticketId) return
      await api.delete(`/tickets/${ticketId}/comments/${commentId}`)
    },
    [ticketId],
  )

  return {
    comments,
    isLoading,
    refetch,
    createComment,
    updateComment,
    deleteComment,
  }
}
