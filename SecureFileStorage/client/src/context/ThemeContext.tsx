import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { THEME_KEY } from '@/constants'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() =>
    localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
  )

  const applyTheme = useCallback((t: Theme) => {
    if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
    else document.documentElement.removeAttribute('data-theme')
    localStorage.setItem(THEME_KEY, t)
    setThemeState(t)
  }, [])

  useEffect(() => {
    applyTheme(theme)
  }, [applyTheme, theme])

  const toggleTheme = useCallback(() => {
    applyTheme(theme === 'dark' ? 'light' : 'dark')
  }, [applyTheme, theme])

  const value = useMemo(
    () => ({ theme, toggleTheme, setTheme: applyTheme }),
    [theme, toggleTheme, applyTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
