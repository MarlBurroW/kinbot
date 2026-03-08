import { useState, useEffect, useCallback } from 'react'
import { api } from '@/client/lib/api'
import { useSSE } from '@/client/hooks/useSSE'

export interface TeamMember {
  kinId: string
  kinName: string
  kinSlug: string | null
  kinRole: string
  kinAvatarPath: string | null
  teamRole: string
  joinedAt: string
}

export interface Team {
  id: string
  name: string
  slug: string | null
  description: string | null
  icon: string | null
  color: string | null
  hubKinId: string
  createdBy: string | null
  createdAt: string
  updatedAt: string
  members: TeamMember[]
}

export interface CreateTeamInput {
  name: string
  slug?: string
  description?: string
  icon?: string
  color?: string
  hubKinId: string
  memberKinIds?: string[]
}

export interface UpdateTeamInput {
  name?: string
  slug?: string
  description?: string | null
  icon?: string | null
  color?: string | null
  hubKinId?: string
}

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchTeams = useCallback(async () => {
    try {
      const data = await api.get<{ teams: Team[] }>('/teams')
      setTeams(data.teams)
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTeams()
  }, [fetchTeams])

  // Listen for SSE events
  useSSE({
    'team:created': () => fetchTeams(),
    'team:updated': () => fetchTeams(),
    'team:deleted': () => fetchTeams(),
    'team:member_added': () => fetchTeams(),
    'team:member_removed': () => fetchTeams(),
  })

  const createTeam = useCallback(async (input: CreateTeamInput) => {
    const data = await api.post<{ team: Team }>('/teams', input)
    return data.team
  }, [])

  const updateTeam = useCallback(async (teamId: string, input: UpdateTeamInput) => {
    const data = await api.patch<{ team: Team }>(`/teams/${teamId}`, input)
    return data.team
  }, [])

  const deleteTeam = useCallback(async (teamId: string) => {
    await api.delete(`/teams/${teamId}`)
  }, [])

  const addMember = useCallback(async (teamId: string, kinId: string) => {
    await api.post(`/teams/${teamId}/members`, { kinId })
  }, [])

  const removeMember = useCallback(async (teamId: string, kinId: string) => {
    await api.delete(`/teams/${teamId}/members/${kinId}`)
  }, [])

  // Helper: get the team a kin belongs to (first match)
  const getTeamForKin = useCallback((kinId: string) => {
    return teams.find((t) => t.members.some((m) => m.kinId === kinId)) || null
  }, [teams])

  // Helper: get kin IDs that belong to any team
  const teamedKinIds = new Set(teams.flatMap((t) => t.members.map((m) => m.kinId)))

  return {
    teams,
    isLoading,
    createTeam,
    updateTeam,
    deleteTeam,
    addMember,
    removeMember,
    getTeamForKin,
    teamedKinIds,
    refetch: fetchTeams,
  }
}
