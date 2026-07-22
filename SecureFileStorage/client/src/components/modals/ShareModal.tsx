import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { useI18n } from '@/i18n/I18nContext'
import { fmtDate } from '@/utils/format'
import type { CreateShareLinkResponse, DocumentDto, DocumentShares, UserDirectoryEntry } from '@/types'
import { Modal } from '@/components/ui/Modal'

interface ShareModalProps {
  doc: DocumentDto
  onClose: () => void
}

export function ShareModal({ doc, onClose }: ShareModalProps) {
  const { t, locale } = useI18n()
  const [shares, setShares] = useState<DocumentShares | null>(null)
  const [directory, setDirectory] = useState<UserDirectoryEntry[]>([])
  const [email, setEmail] = useState('')
  const [accessLevel, setAccessLevel] = useState('Read')
  const [linkResult, setLinkResult] = useState<CreateShareLinkResponse | null>(null)
  const [msg, setMsg] = useState('')

  const load = async () => {
    const [s, d] = await Promise.all([
      api<DocumentShares>(`/api/documents/${doc.id}/shares`),
      api<UserDirectoryEntry[]>('/api/users/directory').catch(() => []),
    ])
    setShares(s)
    setDirectory(d)
  }

  useEffect(() => {
    void load().catch((err) => setMsg(err instanceof Error ? err.message : 'Erreur'))
  }, [doc.id])

  const shareWithUser = async () => {
    if (!email) return
    await api(`/api/documents/${doc.id}/share/user`, {
      method: 'POST',
      body: JSON.stringify({ userEmail: email, accessLevel }),
    })
    setEmail('')
    await load()
  }

  const createLink = async () => {
    const result = await api<CreateShareLinkResponse>(`/api/documents/${doc.id}/share/link`, {
      method: 'POST',
      body: JSON.stringify({ accessLevel: 'Download', expiresInHours: 72 }),
    })
    setLinkResult(result)
  }

  const revokeUser = async (userId: string) => {
    await api(`/api/documents/${doc.id}/permissions/${userId}`, { method: 'DELETE' })
    await load()
  }

  const revokeLink = async (linkId: string) => {
    await api(`/api/documents/${doc.id}/share/link/${linkId}`, { method: 'DELETE' })
    await load()
  }

  return (
    <Modal title={t('action.share')} onClose={onClose} wide>
      <p className="form-hint">{doc.fileName}</p>
      {msg && <div className="msg error">{msg}</div>}

      <h4>Partager avec un utilisateur</h4>
      <div className="shared-row">
        <input type="email" list="share-user-list" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@entreprise.local" />
        <select value={accessLevel} onChange={(e) => setAccessLevel(e.target.value)}>
          <option value="Read">{t('access.read')}</option>
          <option value="Preview">{t('access.preview')}</option>
          <option value="Download">{t('access.download')}</option>
          <option value="Write">{t('access.write')}</option>
        </select>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => void shareWithUser()}>
          Ajouter
        </button>
      </div>
      <datalist id="share-user-list">
        {directory.map((u) => (
          <option key={u.id} value={u.email}>
            {u.fullName}
          </option>
        ))}
      </datalist>

      <ul className="share-list">
        {shares?.userShares.map((s) => (
          <li key={s.id}>
            {s.userName} ({s.userEmail}) — {s.accessLevel}
            <button type="button" className="btn btn-sm btn-action-danger" onClick={() => void revokeUser(s.userId)}>
              {t('btn.delete')}
            </button>
          </li>
        ))}
      </ul>

      <h4>Lien de partage</h4>
      <button type="button" className="btn btn-sm" onClick={() => void createLink()}>
        Créer un lien
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
            {l.accessLevel} — expire {fmtDate(l.expiresAt, locale)}
            <button type="button" className="btn btn-sm btn-action-danger" onClick={() => void revokeLink(l.id)}>
              Révoquer
            </button>
          </li>
        ))}
      </ul>

      <div className="modal-footer">
        <button type="button" className="btn" onClick={onClose}>
          {t('btn.cancel')}
        </button>
      </div>
    </Modal>
  )
}
