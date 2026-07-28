import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { CATEGORIES } from '@/constants'
import { useI18n } from '@/i18n/I18nContext'
import { fmtDate, fmtSize } from '@/utils/format'
import type { DocumentCollaborators, DocumentDetail, DocumentDto } from '@/types'
import { Modal } from '@/components/ui/Modal'

interface MetadataModalProps {
  doc: DocumentDto
  onClose: () => void
  onSaved?: () => void
}

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

export function MetadataModal({ doc, onClose, onSaved }: MetadataModalProps) {
  const { t, locale } = useI18n()
  const [detail, setDetail] = useState<DocumentDetail | null>(null)
  const [collaborators, setCollaborators] = useState<DocumentCollaborators | null>(null)
  const [category, setCategory] = useState(doc.category)
  const [description, setDescription] = useState(doc.description || '')
  const [msg, setMsg] = useState('')
  const [integrity, setIntegrity] = useState<string>('')

  useEffect(() => {
    void api<DocumentDetail>(`/api/documents/${doc.id}/detail`).then(setDetail)
    void api<DocumentCollaborators>(`/api/documents/${doc.id}/collaborators`)
      .then(setCollaborators)
      .catch(() => setCollaborators(null))
  }, [doc.id])

  const save = async () => {
    setMsg('')
    try {
      await api(`/api/documents/${doc.id}/metadata`, {
        method: 'PUT',
        body: JSON.stringify({ category, description }),
      })
      onSaved?.()
      onClose()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const checkIntegrity = async () => {
    try {
      const r = await api<{ isValid: boolean; message: string }>(`/api/documents/${doc.id}/integrity`)
      setIntegrity(r.isValid ? `✓ ${r.message}` : `✗ ${r.message}`)
    } catch (err) {
      setIntegrity(err instanceof Error ? err.message : 'Erreur')
    }
  }

  return (
    <Modal title={t('action.details')} onClose={onClose} wide>
      <div className="metadata-grid">
        <div>
          <strong>{t('table.name')}</strong>
          <p>{detail?.fileName || doc.fileName}</p>
        </div>
        <div>
          <strong>{t('table.size')}</strong>
          <p>{fmtSize(detail?.sizeBytes ?? doc.sizeBytes)}</p>
        </div>
        <div>
          <strong>{t('table.owner')}</strong>
          <p>{detail?.ownerName || doc.ownerName}</p>
        </div>
        <div>
          <strong>{t('table.created')}</strong>
          <p>{fmtDate(detail?.createdAt || doc.createdAt, locale)}</p>
        </div>
        <div className="form-group">
          <label htmlFor="meta-category">{t('filter.category')}</label>
          <select id="meta-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="meta-desc">Description</label>
          <textarea id="meta-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
      </div>

      {collaborators && (
        <div className="shared-with-section">
          <h4>{t('collab.sharedWith')}</h4>
          <ul className="collab-list">
            <li className="collab-item collab-item-owner">
              <div>
                <strong>{collaborators.owner.userName}</strong>
                <span className="collab-email">{collaborators.owner.userEmail}</span>
              </div>
              <span className="collab-badge">{t('collab.role.owner')}</span>
            </li>
            {collaborators.collaborators.map((c) => (
              <li key={c.permissionId || c.userId || c.userEmail} className="collab-item">
                <div>
                  <strong>{c.userName}</strong>
                  <span className="collab-email">{c.userEmail}</span>
                </div>
                <span className="collab-badge">{accessLabel(c.accessLevel, t)}</span>
              </li>
            ))}
            {!collaborators.collaborators.length && (
              <li className="collab-empty">{t('collab.none')}</li>
            )}
          </ul>
        </div>
      )}

      <button type="button" className="btn btn-sm" onClick={() => void checkIntegrity()}>
        Vérifier l&apos;intégrité
      </button>
      {integrity && <p className="form-hint">{integrity}</p>}
      {msg && <div className="msg error">{msg}</div>}
      <div className="modal-footer">
        <button type="button" className="btn" onClick={onClose}>
          {t('btn.cancel')}
        </button>
        <button type="button" className="btn btn-primary" onClick={() => void save()}>
          {t('btn.save')}
        </button>
      </div>
    </Modal>
  )
}
