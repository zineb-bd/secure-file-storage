import { useEffect, useMemo, useState } from 'react'
import { api } from '@/api/client'
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

interface ShareModalProps {
  doc: DocumentDto
  onClose: () => void
}

const ACCESS_OPTIONS = [
  { value: 'Read', labelKey: 'access.view' as const },
  { value: 'Preview', labelKey: 'access.preview' as const },
  { value: 'Download', labelKey: 'access.download' as const },
  { value: 'Write', labelKey: 'access.edit' as const },
]

function accessLabel(level: string, t: (k: string) => string) {
  const map: Record<string, string> = {
    Owner: t('collab.role.owner'),
    Read: t('access.view'),
    Preview: t('access.preview'),
    Download: t('access.download'),
    Write: t('access.edit'),
  }
  return map[level] || level
}

export function ShareModal({ doc, onClose }: ShareModalProps) {
  const { t, locale } = useI18n()
  const [tab, setTab] = useState<'collaborators' | 'links'>('collaborators')
  const [collaborators, setCollaborators] = useState<DocumentCollaborators | null>(null)
  const [shares, setShares] = useState<DocumentShares | null>(null)
  const [directory, setDirectory] = useState<UserDirectoryEntry[]>([])
  const [selectedEmails, setSelectedEmails] = useState<string[]>([])
  const [userQuery, setUserQuery] = useState('')
  const [accessLevel, setAccessLevel] = useState('Read')
  const [linkResult, setLinkResult] = useState<CreateShareLinkResponse | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

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
    void load().catch((err) => setMsg(err instanceof Error ? err.message : 'Erreur'))
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
      return (
        u.email.toLowerCase().includes(q) ||
        u.fullName.toLowerCase().includes(q)
      )
    })
  }, [directory, userQuery, collaborators])

  const toggleSelect = (email: string) => {
    setSelectedEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    )
  }

  const addCollaborators = async () => {
    if (!selectedEmails.length || !canManage) return
    setBusy(true)
    setMsg('')
    try {
      for (const email of selectedEmails) {
        await api(`/api/documents/${doc.id}/share/user`, {
          method: 'POST',
          body: JSON.stringify({ userEmail: email, accessLevel }),
        })
      }
      setSelectedEmails([])
      setUserQuery('')
      await load()
    } catch (err) {
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
    const result = await api<CreateShareLinkResponse>(`/api/documents/${doc.id}/share/link`, {
      method: 'POST',
      body: JSON.stringify({ accessLevel: 'Download', expiresInHours: 72 }),
    })
    setLinkResult(result)
    await load()
  }

  const revokeLink = async (linkId: string) => {
    await api(`/api/documents/${doc.id}/share/link/${linkId}`, { method: 'DELETE' })
    await load()
  }

  return (
    <Modal title={t('action.collaborate')} onClose={onClose} wide>
      <p className="form-hint">
        {t('collab.document')}: <strong>{doc.fileName}</strong>
      </p>
      {msg && <div className="msg error">{msg}</div>}

      <div className="collab-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`collab-tab${tab === 'collaborators' ? ' active' : ''}`}
          aria-selected={tab === 'collaborators'}
          onClick={() => setTab('collaborators')}
        >
          {t('collab.tab.collaborators')}
        </button>
        {canManage && (
          <button
            type="button"
            role="tab"
            className={`collab-tab${tab === 'links' ? ' active' : ''}`}
            aria-selected={tab === 'links'}
            onClick={() => setTab('links')}
          >
            {t('collab.tab.links')}
          </button>
        )}
      </div>

      {tab === 'collaborators' && (
        <>
          <h4 className="collab-section-title">{t('collab.listTitle')}</h4>
          <ul className="collab-list">
            {collaborators && (
              <li className="collab-item collab-item-owner">
                <div>
                  <strong>{collaborators.owner.userName}</strong>
                  <span className="collab-email">{collaborators.owner.userEmail}</span>
                </div>
                <span className="collab-badge">{t('collab.role.owner')}</span>
              </li>
            )}
            {collaborators?.collaborators.map((s) => (
              <li key={s.permissionId || s.userId || s.userEmail} className="collab-item">
                <div>
                  <strong>{s.userName}</strong>
                  <span className="collab-email">{s.userEmail}</span>
                  {s.isExpired && <span className="collab-expired">{t('collab.expired')}</span>}
                </div>
                <div className="collab-item-actions">
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
                        className="btn btn-sm btn-action-danger"
                        disabled={busy}
                        onClick={() => void revokeUser(s.userId!)}
                      >
                        {t('collab.remove')}
                      </button>
                    </>
                  ) : (
                    <span className="collab-badge">{accessLabel(s.accessLevel, t)}</span>
                  )}
                </div>
              </li>
            ))}
            {collaborators && collaborators.collaborators.length === 0 && (
              <li className="collab-empty">{t('collab.none')}</li>
            )}
          </ul>

          {canManage && (
            <>
              <h4 className="collab-section-title">{t('collab.invite')}</h4>
              <div className="form-group">
                <label htmlFor="collab-search">{t('collab.searchUsers')}</label>
                <input
                  id="collab-search"
                  type="search"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder={t('collab.searchPlaceholder')}
                />
              </div>
              <div className="collab-user-picker">
                {filteredDirectory.slice(0, 8).map((u) => {
                  const checked = selectedEmails.includes(u.email)
                  return (
                    <label key={u.id} className={`collab-user-option${checked ? ' selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelect(u.email)}
                      />
                      <span>
                        <strong>{u.fullName}</strong>
                        <em>{u.email}</em>
                      </span>
                    </label>
                  )
                })}
                {!filteredDirectory.length && (
                  <p className="form-hint">{t('collab.noUsers')}</p>
                )}
              </div>
              <div className="shared-row">
                <select value={accessLevel} onChange={(e) => setAccessLevel(e.target.value)}>
                  {ACCESS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {t(o.labelKey)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busy || !selectedEmails.length}
                  onClick={() => void addCollaborators()}
                >
                  {t('collab.add')}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'links' && canManage && (
        <>
          <h4 className="collab-section-title">{t('collab.linkTitle')}</h4>
          <button type="button" className="btn btn-sm" onClick={() => void createLink()}>
            {t('collab.createLink')}
          </button>
          {linkResult && (
            <p>
              <a href={linkResult.shareUrl} target="_blank" rel="noreferrer">
                {linkResult.shareUrl}
              </a>
            </p>
          )}
          <ul className="share-list">
            {shares?.links.map((l) => (
              <li key={l.id}>
                {l.accessLevel} — {t('collab.expires')} {fmtDate(l.expiresAt, locale)}
                <button
                  type="button"
                  className="btn btn-sm btn-action-danger"
                  onClick={() => void revokeLink(l.id)}
                >
                  {t('collab.revoke')}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="modal-footer">
        <button type="button" className="btn" onClick={onClose}>
          {t('btn.cancel')}
        </button>
      </div>
    </Modal>
  )
}
