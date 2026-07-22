import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { CATEGORIES } from '@/constants'
import { useI18n } from '@/i18n/I18nContext'
import type { UserDirectoryEntry } from '@/types'
import { Modal } from '@/components/ui/Modal'

interface UploadModalProps {
  onClose: () => void
  onUploaded?: () => void
}

interface SharedRow {
  email: string
  level: string
}

export function UploadModal({ onClose, onUploaded }: UploadModalProps) {
  const { t } = useI18n()
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState('General')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState('Private')
  const [publicLevel, setPublicLevel] = useState('Download')
  const [sharedRows, setSharedRows] = useState<SharedRow[]>([])
  const [directory, setDirectory] = useState<UserDirectoryEntry[]>([])
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void api<UserDirectoryEntry[]>('/api/users/directory')
      .then(setDirectory)
      .catch(() => setDirectory([]))
  }, [])

  useEffect(() => {
    if (visibility === 'Shared' && !sharedRows.length) {
      setSharedRows([{ email: '', level: 'Read' }])
    }
  }, [visibility, sharedRows.length])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setMsg('Sélectionnez un fichier.')
      return
    }
    setLoading(true)
    setMsg('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('category', category)
      form.append('description', description)
      form.append('visibility', visibility)
      if (visibility === 'Public') form.append('publicAccessLevel', publicLevel)
      if (visibility === 'Shared') {
        sharedRows.forEach((r, i) => {
          if (r.email) {
            form.append(`sharedUsers[${i}].userEmail`, r.email)
            form.append(`sharedUsers[${i}].accessLevel`, r.level)
          }
        })
      }
      await api('/api/documents', { method: 'POST', body: form })
      onUploaded?.()
      onClose()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  const visHint =
    visibility === 'Private'
      ? t('upload.vis.private')
      : visibility === 'Shared'
        ? t('upload.vis.shared')
        : t('upload.vis.public')

  return (
    <Modal title={t('btn.upload')} onClose={onClose} wide>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="upload-file">Fichier</label>
          <input id="upload-file" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
        </div>
        <div className="form-group">
          <label htmlFor="upload-category">{t('filter.category')}</label>
          <select id="upload-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="upload-desc">Description</label>
          <textarea id="upload-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <fieldset className="form-group">
          <legend>Visibilité</legend>
          {(['Private', 'Shared', 'Public'] as const).map((v) => (
            <label key={v} className="radio-inline">
              <input type="radio" name="visibility" value={v} checked={visibility === v} onChange={() => setVisibility(v)} />
              {t(`vis.${v.toLowerCase()}` as 'vis.private')}
            </label>
          ))}
          <p className="form-hint">{visHint}</p>
        </fieldset>
        {visibility === 'Shared' && (
          <div className="form-group">
            {sharedRows.map((row, i) => (
              <div key={i} className="shared-row">
                <input
                  type="email"
                  list="upload-user-list"
                  placeholder="collegue@entreprise.local"
                  value={row.email}
                  onChange={(e) => {
                    const next = [...sharedRows]
                    next[i] = { ...next[i], email: e.target.value }
                    setSharedRows(next)
                  }}
                />
                <select
                  value={row.level}
                  onChange={(e) => {
                    const next = [...sharedRows]
                    next[i] = { ...next[i], level: e.target.value }
                    setSharedRows(next)
                  }}
                >
                  <option value="Read">{t('access.read')}</option>
                  <option value="Preview">{t('access.preview')}</option>
                  <option value="Download">{t('access.download')}</option>
                  <option value="Write">{t('access.write')}</option>
                </select>
                <button type="button" className="btn btn-sm btn-icon-only" onClick={() => setSharedRows(sharedRows.filter((_, j) => j !== i))}>
                  &times;
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-sm" onClick={() => setSharedRows([...sharedRows, { email: '', level: 'Read' }])}>
              + Utilisateur
            </button>
            <datalist id="upload-user-list">
              {directory.map((u) => (
                <option key={u.id} value={u.email}>
                  {u.fullName}
                </option>
              ))}
            </datalist>
          </div>
        )}
        {visibility === 'Public' && (
          <div className="form-group">
            <label htmlFor="upload-public-level">Niveau d&apos;accès public</label>
            <select id="upload-public-level" value={publicLevel} onChange={(e) => setPublicLevel(e.target.value)}>
              <option value="Read">{t('access.read')}</option>
              <option value="Preview">{t('access.preview')}</option>
              <option value="Download">{t('access.download')}</option>
            </select>
          </div>
        )}
        {msg && <div className="msg error">{msg}</div>}
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>
            {t('btn.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '…' : t('btn.upload')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
