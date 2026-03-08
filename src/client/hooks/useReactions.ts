import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/client/lib/api'

export const PRESET_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉']

export function useReactions(kinId: string | null) {
  const { t } = useTranslation()

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!kinId) return
      try {
        await api.post(`/kins/${kinId}/messages/${messageId}/reactions`, { emoji })
      } catch {
        toast.error(t('chat.reactionFailed', 'Failed to toggle reaction'))
      }
    },
    [kinId, t],
  )

  return { toggleReaction, presetEmojis: PRESET_EMOJIS }
}
