import { useEffect, useMemo, useState } from 'react'
import { api } from '@/api/client'
import { getPublicShareUrl } from '@/api/baseUrl'
import { useI18n } from '@/i18n/I18nContext'
import { fmtDate } from '@/utils/format'
import type {
  CreateShareLinkResponse,
  DocumentCollaborators,
  DocumentDto,
  DocumentShares,
  UserDirectoryEntry,
} from '@/types'
import { Modal } from '@/components/ui/Modal'
import { FileIcon } from '@/components/documents/FileIcon'

interface ShareModalProps {
  doc: DocumentDto
  onClose: () => void
}

const ACCESS_OPTIONS = [
  { value: 'Read', labelKey: 'access.read' as const },
  { value: 'Preview', labelKey: 'access.preview' as const },
  { value: 'Download', labelKey: 'access.download' as const },
  { value: 'Write', labelKey: 'access.write' as const },
]

function accessLabel(level: string, t: (k: string) => string) {
  const map: Record<string, string> = {
    Owner: t('collab.role.owner'),
    Read: t('access.read'),
    Preview: t('access.preview'),
    Download: t('access.download'),
    Write: t('access.write'),
  }
  return map[level] || level
}

function initialsOf(name: string, email: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  if (parts.length === 1 && parts[0].length) return parts[0].slice(0, 2).toUpperCase()
  return (email[0] || '?').toUpperCase()
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function ShareModal({ doc, onClose }: ShareModalProps) {
  const { t, locale } = useI18n()
  const [tab, setTab] = useState<'collaborators' | 'links'>('collaborators')
  const [collaborators, setCollaborators] = useState<DocumentCollaborators | null>(null)
  const [shares, setShares] = useState<DocumentShares | null>(null)
  const [directory, setDirectory] = useState<UserDirectoryEntry[]>([])
  const [selectedEmails, setSelectedEmails] = useState<string[]>([])
  const [userQuery, setUserQuery] = useState('')
  const [emailInvite, setEmailInvite] = useState('')
  const [accessLevel, setAccessLevel] = useState('Read')
  const [linkAccessLevel, setLinkAccessLevel] = useState('Download')
  const [linkExpiresAt, setLinkExpiresAt] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  })
  const [linkResult, setLinkResult] = useState<CreateShareLinkResponse | null>(null)
  const [copied, setCopied] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgOk, setMsgOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const canManage = collaborators?.canManage ?? false

  const load = async () => {
    const [c, d] = await Promise.all([
      api<DocumentCollaborators>(`/api/documents/${doc.id}/collaborators`),
      api<UserDirectoryEntry[]>('/api/users/directory').catch(() => []),
    ])
    setCollaborators(c)
    setDirectory(d)
    if (c.canManage) {
      const s = await api<DocumentShares>(`/api/documents/${doc.id}/shares`).catch(() => null)
      setShares(s)
    }
  }

  useEffect(() => {
    setLoading(true)
    void load()
      .catch((err) => setMsg(err instanceof Error ? err.message : 'Erreur'))
      .finally(() => setLoading(false))
  }, [doc.id])

  const filteredDirectory = useMemo(() => {
    const q = userQuery.trim().toLowerCase()
    const taken = new Set([
      ...(collaborators?.collaborators.map((c) => c.userEmail.toLowerCase()) || []),
      collaborators?.owner.userEmail.toLowerCase() || '',
    ])
    return directory.filter((u) => {
      if (taken.has(u.email.toLowerCase())) return false
      if (!q) return true
      return u.email.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q)
    })
  }, [directory, userQuery, collaborators])

  const toggleSelect = (email: string) => {
    setSelectedEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    )
  }

  const inviteTargets = useMemo(() => {
    const set = new Set(selectedEmails.map((e) => e.toLowerCase()))
    const email = emailInvite.trim()
    if (email && isValidEmail(email) && !set.has(email.toLowerCase())) {
      return [...selectedEmails, email]
    }
    return selectedEmails
  }, [selectedEmails, emailInvite])

  const addCollaborators = async () => {
    if (!inviteTargets.length || !canManage) return
    setBusy(true)
    setMsg('')
    setMsgOk(false)
    try {
      const invited = [...inviteTargets]
      for (const email of invited) {
        await api(`/api/documents/${doc.id}/share/user`, {
          method: 'POST',
          body: JSON.stringify({ userEmail: email, accessLevel }),
        })
      }
      setSelectedEmails([])
      setUserQuery('')
      setEmailInvite('')
      await load()
      setMsgOk(true)
      setMsg(
        t('collab.inviteSent', {
          count: String(invited.length),
          emails: invited.join(', '),
        })
      )
      window.dispatchEvent(new CustomEvent('sfs:notifications-changed'))
    } catch (err) {
      setMsgOk(false)
      setMsg(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  const updateAccess = async (userId: string, nextLevel: string) => {
    if (!canManage) return
    setBusy(true)
    try {
      await api(`/api/documents/${doc.id}/share/user`, {
        method: 'POST',
        body: JSON.stringify({ userId, accessLevel: nextLevel }),
      })
      await load()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  const revokeUser = async (userId: string) => {
    if (!canManage) return
    setBusy(true)
    try {
      await api(`/api/documents/${doc.id}/permissions/${userId}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  const createLink = async () => {
    if (!linkExpiresAt) {
      setMsgOk(false)
      setMsg(t('collab.linkExpiresRequired'))
      return
    }
    const expires = new Date(linkExpiresAt)
    if (Number.isNaN(expires.getTime()) || expires.getTime() <= Date.now()) {
      setMsgOk(false)
      setMsg(t('collab.linkExpiresFuture'))
      return
    }

    setBusy(true)
    setMsg('')
    setMsgOk(false)
    try {
      const result = await api<CreateShareLinkResponse>(`/api/documents/${doc.id}/share/link`, {
        method: 'POST',
        body: JSON.stringify({
          accessLevel: linkAccessLevel,
          expiresAt: expires.toISOString(),
        }),
      })
      // Lien public sur l'API (share.html) — ouvre sans compte, hors de votre PC
      setLinkResult({ ...result, shareUrl: getPublicShareUrl(result.token) })
      setMsgOk(true)
      setMsg(t('collab.linkCreated'))
      await load()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  const revokeLink = async (linkId: string) => {
    setBusy(true)
    try {
      await api(`/api/documents/${doc.id}/share/link/${linkId}`, { method: 'DELETE' })
      if (linkResult?.id === linkId) setLinkResult(null)
      await load()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <Modal title={t('action.collaborate')} onClose={onClose} wide>
      <div className="collab-studio">
        <div className="collab-doc-chip">
          <FileIcon contentType={doc.contentType} fileName={doc.fileName} />
          <div>
            <span className="collab-doc-label">{t('collab.document')}</span>
            <strong>{doc.fileName}</strong>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
              {t('collab.categoryPolicyHint', { category: doc.category || 'General' })}
            </p>
          </div>
        </div>

        {msg && (
          <div className={`collab-alert${msgOk ? ' ok' : ' err'}`} role="status">
            {msg}
          </div>
        )}

        <div className="collab-segment" role="tablist">
          <button
            type="button"
            role="tab"
            className={tab === 'collaborators' ? 'active' : ''}
            aria-selected={tab === 'collaborators'}
            onClick={() => setTab('collaborators')}
          >
            {t('collab.tab.collaborators')}
            {collaborators && (
              <span className="collab-count">{collaborators.collaborators.length + 1}</span>
            )}
          </button>
          {canManage && (
            <button
              type="button"
              role="tab"
              className={tab === 'links' ? 'active' : ''}
              aria-selected={tab === 'links'}
              onClick={() => setTab('links')}
            >
              {t('collab.tab.links')}
              {shares?.links?.length ? <span className="collab-count">{shares.links.length}</span> : null}
            </button>
          )}
        </div>

        {loading && (
          <div className="collab-loading">
            <div className="spinner" />
          </div>
        )}

        {!loading && tab === 'collaborators' && (
          <div className="collab-panel">
            <section className="collab-card">
              <header className="collab-card-head">
                <h4>{t('collab.listTitle')}</h4>
                <span className="collab-card-hint">{t('collab.sharedWith')}</span>
              </header>

              <ul className="collab-people">
                {collaborators && (
                  <li className="collab-person owner">
                    <div
                      className="collab-avatar"
                      aria-hidden
                    >
                      {initialsOf(collaborators.owner.userName, collaborators.owner.userEmail)}
                    </div>
                    <div className="collab-person-meta">
                      <strong>{collaborators.owner.userName}</strong>
                      <span>{collaborators.owner.userEmail}</span>
                    </div>
                    <span className="collab-pill owner">{t('collab.role.owner')}</span>
                  </li>
                )}

                {collaborators?.collaborators.map((s) => (
                  <li key={s.permissionId || s.userId || s.userEmail} className="collab-person">
                    <div className="collab-avatar" aria-hidden>
                      {initialsOf(s.userName, s.userEmail)}
                    </div>
                    <div className="collab-person-meta">
                      <strong>{s.userName}</strong>
                      <span>{s.userEmail}</span>
                      {s.isExpired && <em className="collab-expired">{t('collab.expired')}</em>}
                    </div>
                    <div className="collab-person-actions">
                      {canManage && s.userId ? (
                        <>
                          <select
                            value={s.accessLevel}
                            disabled={busy}
                            onChange={(e) => void updateAccess(s.userId!, e.target.value)}
                            aria-label={t('collab.changeAccess')}
                          >
                            {ACCESS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {t(o.labelKey)}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="collab-icon-btn danger"
                            disabled={busy}
                            title={t('collab.remove')}
                            aria-label={t('collab.remove')}
                            onClick={() => void revokeUser(s.userId!)}
                          >
                            ×
                          </button>
                        </>
                      ) : (
                        <span className="collab-pill">{accessLabel(s.accessLevel, t)}</span>
                      )}
                    </div>
                  </li>
                ))}

                {collaborators && collaborators.collaborators.length === 0 && (
                  <li className="collab-empty-state">
                    <p>{t('collab.none')}</p>
                  </li>
                )}
              </ul>
            </section>

            {canManage && (
              <section className="collab-card">
                <header className="collab-card-head">
                  <h4>{t('collab.invite')}</h4>
                </header>

                <div className="collab-search-wrap">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.75" />
                    <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                  </svg>
                  <input
                    id="collab-search"
                    type="search"
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    placeholder={t('collab.searchPlaceholder')}
                    aria-label={t('collab.searchUsers')}
                  />
                </div>

                <div className="collab-picker">
                  {filteredDirectory.slice(0, 8).map((u) => {
                    const checked = selectedEmails.includes(u.email)
                    return (
                      <button
                        key={u.id}
                        type="button"
                        className={`collab-pick${checked ? ' selected' : ''}`}
                        onClick={() => toggleSelect(u.email)}
                        aria-pressed={checked}
                      >
                        <span className={`collab-check${checked ? ' on' : ''}`} aria-hidden>
                          {checked ? '✓' : ''}
                        </span>
                        <span className="collab-avatar sm" aria-hidden>
                          {initialsOf(u.fullName, u.email)}
                        </span>
                        <span className="collab-person-meta">
                          <strong>{u.fullName}</strong>
                          <span>{u.email}</span>
                        </span>
                      </button>
                    )
                  })}
                  {!filteredDirectory.length && (
                    <p className="collab-empty-hint">{t('collab.noUsers')}</p>
                  )}
                </div>

                <div className="collab-email-row">
                  <label htmlFor="collab-email">{t('collab.inviteByEmail')}</label>
                  <input
                    id="collab-email"
                    type="email"
                    value={emailInvite}
                    onChange={(e) => setEmailInvite(e.target.value)}
                    placeholder={t('collab.emailPlaceholder')}
                  />
                </div>

                <div className="collab-invite-bar">
                  <select
                    value={accessLevel}
                    onChange={(e) => setAccessLevel(e.target.value)}
                    aria-label={t('collab.changeAccess')}
                  >
                    {ACCESS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {t(o.labelKey)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy || !inviteTargets.length}
                    onClick={() => void addCollaborators()}
                  >
                    {t('collab.add')}
                    {inviteTargets.length > 0 ? ` (${inviteTargets.length})` : ''}
                  </button>
                </div>
              </section>
            )}
          </div>
        )}

        {!loading && tab === 'links' && canManage && (
          <div className="collab-panel">
            <section className="collab-card">
              <header className="collab-card-head">
                <h4>{t('collab.linkTitle')}</h4>
              </header>

              <p className="collab-link-hint">{t('collab.linkAnyone')}</p>

              <div className="collab-link-form">
                <div className="form-group">
                  <label htmlFor="collab-link-access">{t('collab.linkAccess')}</label>
                  <select
                    id="collab-link-access"
                    value={linkAccessLevel}
                    onChange={(e) => setLinkAccessLevel(e.target.value)}
                    disabled={busy}
                  >
                    {ACCESS_OPTIONS.filter((o) => o.value !== 'Write').map((o) => (
                      <option key={o.value} value={o.value}>
                        {t(o.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="collab-link-expires">{t('collab.linkExpires')}</label>
                  <input
                    id="collab-link-expires"
                    type="datetime-local"
                    value={linkExpiresAt}
                    onChange={(e) => setLinkExpiresAt(e.target.value)}
                    disabled={busy}
                    required
                  />
                </div>
              </div>

              <div className="collab-invite-bar">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || !linkExpiresAt}
                  onClick={() => void createLink()}
                >
                  {t('collab.createLink')}
                </button>
              </div>

              {linkResult && (
                <div className="collab-link-fresh">
                  <input type="text" readOnly value={linkResult.shareUrl} />
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => void copyLink(linkResult.shareUrl)}
                  >
                    {copied ? t('collab.copied') : t('collab.copy')}
                  </button>
                </div>
              )}

              <ul className="collab-links">
                {(shares?.links || []).map((l) => (
                  <li key={l.id}>
                    <div className="collab-link-meta">
                      <strong>{accessLabel(l.accessLevel, t)}</strong>
                      <span>
                        {t('collab.expires')} {fmtDate(l.expiresAt, locale)}
                        {l.isExpired ? ` · ${t('collab.expired')}` : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-action-danger"
                      disabled={busy}
                      onClick={() => void revokeLink(l.id)}
                    >
                      {t('collab.revoke')}
                    </button>
                  </li>
                ))}
                {!shares?.links?.length && (
                  <li className="collab-empty-state">
                    <p>{t('collab.noLinks')}</p>
                  </li>
                )}
              </ul>
            </section>
          </div>
        )}

        <div className="collab-footer">
          <button type="button" className="btn" onClick={onClose}>
            {t('btn.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {t('btn.done')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
