import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import messages from './messages.json'
import { PREF_LANG_KEY } from '@/constants'

type Lang = 'fr' | 'en'
type Messages = Record<string, { fr: string; en: string }>

interface I18nContextValue {
  lang: Lang
  locale: string
  t: (key: string, params?: Record<string, string>) => string
  setLang: (lang: Lang) => void
}

const I18nContext = createContext<I18nContextValue | null>(null)
const M = messages as Messages

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() =>
    localStorage.getItem(PREF_LANG_KEY) === 'en' ? 'en' : 'fr'
  )

  const t = useCallback(
    (key: string, params?: Record<string, string>) => {
      let s = M[key]?.[lang] || M[key]?.fr || key
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
        })
      }
      return s
    },
    [lang]
  )

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    localStorage.setItem(PREF_LANG_KEY, l)
  }, [])

  const locale = lang === 'en' ? 'en-US' : 'fr-FR'

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = t('app.title')
  }, [lang, t])

  const value = useMemo(() => ({ lang, locale, t, setLang }), [lang, locale, t, setLang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
