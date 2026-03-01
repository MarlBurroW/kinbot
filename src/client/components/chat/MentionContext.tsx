import { createContext, useContext, useMemo } from 'react'
import type { MentionableUser, MentionableKin } from '@/client/hooks/useMentionables'

interface MentionLookup {
  /** Set of lowercase pseudonyms (users) */
  userHandles: Set<string>
  /** Set of lowercase slugs/names (kins) */
  kinHandles: Set<string>
}

const MentionContext = createContext<MentionLookup>({
  userHandles: new Set(),
  kinHandles: new Set(),
})

export function MentionLookupProvider({
  users,
  kins,
  children,
}: {
  users: MentionableUser[]
  kins: MentionableKin[]
  children: React.ReactNode
}) {
  const lookup = useMemo<MentionLookup>(() => {
    const userHandles = new Set(users.map((u) => u.pseudonym.toLowerCase()))
    const kinHandles = new Set<string>()
    for (const k of kins) {
      if (k.slug) kinHandles.add(k.slug.toLowerCase())
      kinHandles.add(k.name.toLowerCase())
    }
    return { userHandles, kinHandles }
  }, [users, kins])

  return (
    <MentionContext.Provider value={lookup}>
      {children}
    </MentionContext.Provider>
  )
}

export function useMentionLookup() {
  return useContext(MentionContext)
}
