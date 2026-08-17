import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/i18n/I18nContext'
import { askChatbot } from '@/utils/chatApi'
import { getSuggestionEntries, matchFaq, type ChatFaqEntry } from './chatFaq'

type Role = 'user' | 'assistant'

interface ChatMessage {
  id: string
  role: Role
  text: string
}

function firstName(fullName?: string | null): string {
  if (!fullName?.trim()) return ''
  return fullName.trim().split(/\s+/)[0] ?? ''
}

export function ChatWidget() {
  const { user } = useAuth()
  const { t, lang } = useI18n()
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestions = getSuggestionEntries()

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
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, busy, open])

  const pushAssistant = (text: string) => {
    setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', text }])
  }

  const handleSend = async (raw: string) => {
    const text = raw.trim()
    if (!text || busy) return

    setInput('')
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text }])

    const faq = matchFaq(text)
    if (faq) {
      pushAssistant(t(faq.replyKey))
      return
    }

    setBusy(true)
    try {
      const res = await askChatbot(text, lang)
      pushAssistant(res.reply?.trim() || t('chat.fallback'))
    } catch {
      pushAssistant(t('chat.error'))
    } finally {
      setBusy(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void handleSend(input)
  }

  const onSuggestion = (entry: ChatFaqEntry) => {
    void handleSend(t(entry.suggestionKey))
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
                <span className="chat-panel-sub">SecureDocs</span>
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
                {m.text}
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

          {!busy && (
            <div className="chat-suggestions">
              {suggestions.map((s) => (
                <button
                  key={s.intent}
                  type="button"
                  className="chat-suggestion"
                  onClick={() => onSuggestion(s)}
                >
                  {t(s.suggestionKey)}
                </button>
              ))}
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
