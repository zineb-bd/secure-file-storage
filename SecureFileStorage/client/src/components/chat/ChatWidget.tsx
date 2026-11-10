import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/i18n/I18nContext'
import { askChatbot } from '@/utils/chatApi'
import { matchFaq } from './chatFaq'

type Role = 'user' | 'assistant'

interface ChatMessage {
  id: string
  role: Role
  text: string
  route?: string | null
}

function firstName(fullName?: string | null): string {
  if (!fullName?.trim()) return ''
  return fullName.trim().split(/\s+/)[0] ?? ''
}

function pageLabel(route: string, t: (key: string) => string): string {
  if (route.startsWith('/documents/upload')) return t('nav.upload')
  if (route.startsWith('/documents')) return t('nav.documents')
  if (route.startsWith('/favorites')) return t('nav.favorites')
  if (route.startsWith('/shared')) return t('nav.shared')
  if (route.startsWith('/categories')) return t('nav.categories')
  if (route.startsWith('/archived')) return t('nav.archived')
  if (route.startsWith('/trash')) return t('nav.trash')
  if (route.includes('tab=users')) return t('nav.users')
  if (route.includes('tab=groups')) return t('nav.groups')
  if (route.startsWith('/annuaire')) return t('nav.annuaire')
  if (route.startsWith('/admin/audit')) return t('nav.audit')
  if (route.startsWith('/admin/config')) return t('nav.config')
  if (route === '/') return t('nav.dashboard')
  return t('chat.openPage')
}

export function ChatWidget() {
  const { user } = useAuth()
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const name = firstName(user?.fullName)
    const namePart = name ? ` ${name}` : ''
    setMessages((prev) => {
      if (prev.length > 0) return prev
      return [{ id: 'welcome', role: 'assistant', text: t('chat.welcome', { name: namePart }) }]
    })
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80)
    return () => window.clearTimeout(timer)
  }, [open, t, user?.fullName])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, busy, open])

  const pushAssistant = (text: string, route?: string | null) => {
    setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', text, route }])
  }

  const handleSend = async (raw: string) => {
    const text = raw.trim()
    if (!text || busy) return

    setInput('')
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text }])
    setBusy(true)

    try {
      const res = await askChatbot(text, lang)
      const faq = matchFaq(text)
      if (res.source === 'fallback' && faq) {
        pushAssistant(t(faq.replyKey), faq.route)
        return
      }
      pushAssistant(res.reply?.trim() || t('chat.fallback'), res.route || faq?.route)
    } catch {
      const faq = matchFaq(text)
      if (faq) {
        pushAssistant(t(faq.replyKey), faq.route)
      } else {
        pushAssistant(t('chat.error'))
      }
    } finally {
      setBusy(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void handleSend(input)
  }

  const openRoute = (route: string) => {
    const [pathname, query] = route.split('?')
    navigate({ pathname, search: query ? `?${query}` : '' })
    // Fermer après le clic, sinon le souris-up tombe sur le bouton sous le panneau.
    window.setTimeout(() => setOpen(false), 0)
  }

  return createPortal(
    <div className={`chat-widget${open ? ' is-open' : ''}`}>
      {open && (
        <section
          className="chat-panel"
          id={panelId}
          role="dialog"
          aria-label={t('chat.title')}
          aria-modal="false"
        >
          <header className="chat-panel-header">
            <div className="chat-panel-title">
              <span className="chat-panel-avatar" aria-hidden="true">
                <ChatBotIcon />
              </span>
              <div>
                <strong>{t('chat.title')}</strong>
                <span className="chat-panel-sub">{t('chat.statusReady')}</span>
              </div>
            </div>
            <button
              type="button"
              className="chat-icon-btn"
              aria-label={t('chat.close')}
              onClick={() => setOpen(false)}
            >
              <CloseIcon />
            </button>
          </header>

          <div className="chat-messages" ref={listRef}>
            {messages.map((m) => (
              <div key={m.id} className={`chat-bubble chat-bubble-${m.role}`}>
                <p className="chat-bubble-text">{m.text}</p>
                {m.role === 'assistant' && m.route && (
                  <button
                    type="button"
                    className="chat-open-page"
                    onClick={() => openRoute(m.route!)}
                  >
                    {t('chat.openPage')} · {pageLabel(m.route, t)}
                  </button>
                )}
              </div>
            ))}
            {busy && (
              <div className="chat-bubble chat-bubble-assistant chat-typing" aria-live="polite">
                <span />
                <span />
                <span />
                <span className="sr-only">{t('chat.typing')}</span>
              </div>
            )}
          </div>

          {!busy && messages.length <= 1 && (
            <div className="chat-suggestions">
              <span className="chat-example-label">{t('chat.exampleLabel')}</span>
              <button
                type="button"
                className="chat-suggestion"
                onClick={() => void handleSend(t('chat.exampleQuestion'))}
              >
                {t('chat.exampleQuestion')}
              </button>
            </div>
          )}

          <p className="chat-privacy-note">{t('chat.privacy')}</p>

          <form className="chat-composer" onSubmit={onSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('chat.placeholder')}
              disabled={busy}
              autoComplete="off"
              aria-label={t('chat.placeholder')}
            />
            <button type="submit" className="chat-send-btn" disabled={busy || !input.trim()} aria-label={t('chat.send')}>
              <SendIcon />
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className="chat-fab"
        aria-label={open ? t('chat.close') : t('chat.open')}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <CloseIcon /> : <ChatBotIcon />}
      </button>
    </div>,
    document.body
  )
}

function ChatBotIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3a1 1 0 0 1 1 1v1.06A7.002 7.002 0 0 1 19 12v2a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-2a7.002 7.002 0 0 1 6-6.94V4a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle cx="9.5" cy="12.5" r="1.1" fill="currentColor" />
      <circle cx="14.5" cy="12.5" r="1.1" fill="currentColor" />
      <path d="M9 18.5v1.2a3 3 0 0 0 6 0v-1.2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12h12M12 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
