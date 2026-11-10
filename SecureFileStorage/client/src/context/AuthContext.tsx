import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, configureApi } from '@/api/client'
import { TOKEN_KEY, USER_KEY } from '@/constants'
import type { LoginResponse, UserInfo } from '@/types'

interface AuthContextValue {
  token: string | null
  user: UserInfo | null
  isAuthenticated: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<void>
  logout: (callApi?: boolean) => Promise<void>
  patchUser: (patch: Partial<UserInfo>) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function loadUser(): UserInfo | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState<UserInfo | null>(() => loadUser())

  const logout = useCallback(async (callApi = true) => {
    if (callApi && token) {
      try {
        await api('/api/auth/logout', { method: 'POST' })
      } catch {
        /* ignore */
      }
    }
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [token])

  useLayoutEffect(() => {
    configureApi(() => localStorage.getItem(TOKEN_KEY), () => {
      void logout(false)
    })
  }, [logout])

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    const userInfo: UserInfo = {
      email: data.email,
      fullName: data.fullName,
      roles: data.roles,
      expiresAt: data.expiresAt,
    }
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(userInfo))
    setToken(data.token)
    setUser(userInfo)
  }, [])

  const patchUser = useCallback((patch: Partial<UserInfo>) => {
    setUser((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      localStorage.setItem(USER_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const isAdmin = (user?.roles || []).includes('Admin')

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: !!token && !!user,
      isAdmin,
      login,
      logout,
      patchUser,
    }),
    [token, user, isAdmin, login, logout, patchUser]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
