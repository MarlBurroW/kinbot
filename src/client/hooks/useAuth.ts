import { useState, useEffect, useCallback } from 'react'
import { api } from '@/client/lib/api'
import i18n from '@/client/lib/i18n'

interface UserProfile {
  id: string
  email: string
  firstName: string
  lastName: string
  pseudonym: string
  language: 'en' | 'fr'
  role: 'admin' | 'member'
  avatarUrl: string | null
  kinOrder: string | null
}

interface AuthState {
  user: UserProfile | null
  isLoading: boolean
  isAuthenticated: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  })

  const fetchUser = useCallback(async () => {
    try {
      const user = await api.get<UserProfile>('/me')
      if (user.language && user.language !== i18n.language) {
        await i18n.changeLanguage(user.language)
      }
      setState({ user, isLoading: false, isAuthenticated: true })
    } catch {
      setState({ user: null, isLoading: false, isAuthenticated: false })
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body?.message ?? 'Login failed')
    }

    // Verify the session was actually established — throws if not
    const user = await api.get<UserProfile>('/me')
    if (user.language && user.language !== i18n.language) {
      await i18n.changeLanguage(user.language)
    }
    setState({ user, isLoading: false, isAuthenticated: true })
  }

  const register = async (data: {
    name: string
    email: string
    password: string
  }) => {
    const response = await fetch('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw error
    }

    await fetchUser()
  }

  const logout = async () => {
    await fetch('/api/auth/sign-out', {
      method: 'POST',
      credentials: 'include',
    })
    window.location.href = '/'
  }

  return {
    ...state,
    login,
    register,
    logout,
    refetch: fetchUser,
  }
}
