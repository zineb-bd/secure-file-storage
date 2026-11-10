import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, downloadBlob } from '@/api/client'
import { CATEGORIES } from '@/constants'
import { useI18n } from '@/i18n/I18nContext'
import { fmtDate, fmtSize } from '@/utils/format'
import { canInlinePreview, previewKindOf } from '@/utils/previewHelpers'
import { toggleFavoriteApi } from '@/utils/favoritesApi'
import { loadCustomCategories } from '@/utils/categoryStorage'
import type {
  DocumentCollaborators,
  DocumentDetail,
  DocumentDto,
} from '@/types'
import { Modal } from '@/components/ui/Modal'
import { FileIcon } from '@/components/documents/FileIcon'

interface MetadataModalProps {
  doc: DocumentDto
  onClose: () => void
  onSaved?: () => void
}

function statusLabel(status: string, t: (k: string) => string) {
  const map: Record<string, string> = {
    Active: t('status.active'),
    Archived: t('status.archived'),
    Deleted: t('status.deleted'),
  }
  return map[status] || status || '—'
}

function scanKind(scan: string): 'ok' | 'warn' | 'muted' {
  const s = (scan || '').toLowerCase()
  if (s === 'clean') return 'ok'
  if (s.includes('infect') || s.includes('found') || s.includes('threat')) return 'warn'
  return 'muted'
}

function scanLabel(scan: string, t: (k: string) => string) {
  const s = (scan || '').toLowerCase()
  if (s === 'clean') return t('details.scan.clean')
  if (s === 'skipped') return t('details.scan.skipped')
  if (s.includes('infect') || s.includes('found') || s.includes('threat')) return t('details.scan.threat')
  if (s === 'pending' || s === 'scanning') return t('details.scan.pending')
  return scan || t('details.scan.unknown')
}

function fileTypeLabel(contentType: string, ext: string, t: (k: string) => string) {
  const e = ext.replace(/^\./, '').toLowerCase()
  const names: Record<string, string> = {
    pdf: 'PDF', doc: 'Word', docx: 'Word', xls: 'Excel', xlsx: 'Excel',
    ppt: 'PowerPoint', pptx: 'PowerPoint', png: 'PNG', jpg: 'JPEG', jpeg: 'JPEG',
    gif: 'GIF', webp: 'WebP', txt: t('details.typeText'), csv: 'CSV', zip: 'ZIP',
    mp4: 'MP4', mp3: 'MP3',
  }
  if (names[e]) return names[e]
  if (contentType.startsWith('image/')) return t('details.typeImage')
  if (contentType.startsWith('video/')) return t('details.typeVideo')
  if (contentType.startsWith('audio/')) return t('details.typeAudio')
  return e ? e.toUpperCase() : contentType || '—'
}

function accessRank(level: string | null | undefined, isOwner: boolean) {
  if (isOwner) return 5
  const map: Record<string, number> = { Read: 1, Preview: 2, Download: 3, Write: 4, Owner: 5 }
  return map[level || ''] || 0
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd title={value}>{value}</dd>
    </div>
  )
}

function DocumentPreviewPane({ doc }: { doc: DocumentDto }) {
  const { t } = useI18n()
  const kind = useMemo(() => previewKindOf(doc.contentType || '', doc.fileName || ''), [doc])
  const canInline = canInlinePreview(kind)
  const ext = (doc.fileName || '').split('.').pop()?.toUpperCase() || 'FILE'
  const [url, setUrl] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(canInline)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    if (!canInline) {
      setLoading(false)
      return
    }
    let active = true
    let createdUrl: string | null = null
    void (async () => {
      setLoading(true)
      setError('')
      setUrl(null)
      setText('')
      try {
        const endpoint = kind === 'text'
          ? `/api/documents/${doc.id}/download`
          : `/api/documents/${doc.id}/preview`
        const res = await api<Response>(endpoint, { raw: true })
        if (res.status === 401) throw new Error(t('preview.sessionExpired'))
        if (!res.ok) throw new Error(t('preview.unavailable'))
        const blob = await res.blob()
        if (kind === 'text') {
          const body = await blob.text()
          if (active) setText(body.slice(0, 80_000))
          return
        }
        const objectUrl = URL.createObjectURL(blob)
        if (!active) {
          URL.revokeObjectURL(objectUrl)
          return
        }
        createdUrl = objectUrl
        setUrl(objectUrl)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : t('preview.unavailable'))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [doc.id, t, retryKey, canInline, kind])

  if (!canInline) {
    return (
      <div className="fiche-preview-empty">
        <span className="fiche-preview-ext">{ext}</span>
        <p>{kind === 'office' ? t('preview.officeDesc') : t('preview.unsupportedType')}</p>
      </div>
    )
  }
  if (loading) return <div className="fiche-preview-empty">{t('preview.loading')}</div>
  if (error) {
    return (
      <div className="fiche-preview-empty">
        <p>{error}</p>
        <button type="button" className="btn btn-sm btn-outline" onClick={() => setRetryKey((n) => n + 1)}>
          {t('preview.retry')}
        </button>
      </div>
    )
  }
  if (url && kind === 'pdf') return <iframe src={url} title={doc.fileName} className="fiche-preview-frame" />
  if (url && kind === 'image') return <img src={url} alt={doc.fileName} className="fiche-preview-image" />
  if (url && kind === 'video') return <video src={url} controls className="fiche-preview-media" title={doc.fileName} />
  if (url && kind === 'audio') return <audio src={url} controls className="fiche-preview-audio" title={doc.fileName} />
  if (kind === 'text') return <pre className="fiche-preview-text">{text}</pre>
  return null
}

export function MetadataModal({ doc, onClose, onSaved }: MetadataModalProps) {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<DocumentDetail | null>(null)
  const [collaborators, setCollaborators] = useState<DocumentCollaborators | null>(null)
  const [integrity, setIntegrity] = useState<{ ok: boolean } | null>(null)
  const [category, setCategory] = useState(doc.category)
  const [description, setDescription] = useState(doc.description || '')
  const [favorite, setFavorite] = useState(!!doc.isFavorite)
  const [editing, setEditing] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const moreRef = useRef<HTMLDivElement>(null)

  const categories = [...new Set([...CATEGORIES, ...loadCustomCategories().map((c) => c.name), doc.category])]
  const canModify = detail?.canModify ?? doc.canModify
  const isOwner = doc.isOwner
  const status = detail?.status || doc.status
  const isArchived = status === 'Archived'
  const isDeleted = status === 'Deleted'
  const rank = accessRank(doc.myAccessLevel, isOwner)
  const canDownload = !doc.isFolder && rank >= 3
  const canFavorite = !doc.isFolder && !isDeleted

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const load = async () => {
      const [detailResult, collabResult] = await Promise.allSettled([
        api<DocumentDetail>(`/api/documents/${doc.id}/detail`),
        api<DocumentCollaborators>(`/api/documents/${doc.id}/collaborators`),
      ])
      if (cancelled) return
      if (detailResult.status === 'fulfilled') {
        setDetail(detailResult.value)
        setCategory(detailResult.value.category)
        setDescription(detailResult.value.description || '')
      }
      if (collabResult.status === 'fulfilled') setCollaborators(collabResult.value)
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [doc.id])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const r = await api<{ isValid: boolean }>(`/api/documents/${doc.id}/integrity`)
        if (!cancelled) setIntegrity({ ok: r.isValid })
      } catch {
        if (!cancelled) setIntegrity(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [doc.id])

  const fileName = detail?.fileName || doc.fileName
  const contentType = detail?.contentType || doc.contentType || ''
  const size = detail?.sizeBytes ?? doc.sizeBytes
  const owner = collaborators?.owner.userName || detail?.ownerName || doc.ownerName
  const ownerEmail = collaborators?.owner.userEmail || ''
  const created = detail?.createdAt || doc.createdAt
  const updated = detail?.updatedAt || doc.updatedAt
  const ext = detail?.extension || (fileName.includes('.') ? fileName.split('.').pop() : '') || ''
  const scan = detail?.lastScanResult || doc.lastScanResult || ''
  const version = detail?.currentVersion ?? doc.currentVersion
  const visibility = detail?.visibility || doc.visibility
  const isEncrypted = detail?.isEncrypted ?? true
  const isLocked = detail?.isLocked ?? doc.isLocked
  const sharedCount = collaborators?.collaborators.length ?? 0
  const isShared = sharedCount > 0 || visibility === 'Public'
  const isConfidential = visibility === 'Private'
  const scanOk = scanKind(scan) === 'ok'
  const typeLabel = fileTypeLabel(contentType, ext, t)

  const notify = (text: string) => {
    setMsg(text)
    window.setTimeout(() => setMsg(''), 3500)
  }

  const afterChange = () => {
    onSaved?.()
  }

  const saveMeta = async () => {
    if (!canModify) return
    setSaving(true)
    try {
      await api(`/api/documents/${doc.id}/metadata`, {
        method: 'PUT',
        body: JSON.stringify({ category, description }),
      })
      notify(t('details.saved'))
      setEditing(false)
      afterChange()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const onDownload = () => void downloadBlob(`/api/documents/${doc.id}/download`, fileName)

  const onToggleFavorite = async () => {
    const result = await toggleFavoriteApi(doc.id, favorite)
    setFavorite(result.isFavorite)
    notify(result.isFavorite ? t('favorites.added') : t('favorites.removed'))
    afterChange()
  }

  const onArchive = async () => {
    await api(`/api/documents/${doc.id}/archive`, { method: 'POST' })
    afterChange()
    onClose()
  }

  const onRestore = async () => {
    await api(`/api/documents/${doc.id}/restore`, { method: 'POST' })
    afterChange()
    onClose()
  }

  const onTrash = async () => {
    if (!window.confirm(t('details.confirmTrash'))) return
    await api(`/api/documents/${doc.id}`, { method: 'DELETE' })
    afterChange()
    onClose()
  }

  const infoCard = (
    <section className="fiche-card">
      <header className="fiche-card-head">
        <h4>{t('details.infoTitle')}</h4>
      </header>
      <dl className="fiche-facts">
        <Fact label={t('table.name')} value={fileName} />
        <Fact label={t('details.type')} value={typeLabel} />
        <Fact label={t('table.size')} value={fmtSize(size)} />
        <Fact label={t('filter.category')} value={category || '—'} />
        <Fact label={t('table.owner')} value={ownerEmail ? `${owner}` : owner} />
        <Fact label={t('table.created')} value={fmtDate(created, locale)} />
        <Fact label={t('details.updated')} value={updated ? fmtDate(updated, locale) : '—'} />
        <Fact label={t('details.version')} value={`v${version}`} />
      </dl>
    </section>
  )

  const securityCard = (
    <section className="fiche-card">
      <header className="fiche-card-head">
        <h4>{t('details.securityTitle')}</h4>
      </header>
      <ul className="fiche-security">
        <li className={scanOk ? 'ok' : scanKind(scan) === 'warn' ? 'warn' : ''}>
          <span className="fiche-dot" aria-hidden />
          <div>
            <strong>{t('details.antivirus')}</strong>
            <span>{scanOk ? t('details.avSecure') : scanLabel(scan, t)}</span>
          </div>
        </li>
        <li className={integrity?.ok ? 'ok' : integrity && !integrity.ok ? 'warn' : ''}>
          <span className="fiche-dot" aria-hidden />
          <div>
            <strong>{t('details.integrityTitle')}</strong>
            <span>
              {integrity?.ok
                ? t('details.integrityVerified')
                : integrity
                  ? t('details.integrityFailed')
                  : t('details.integrityPending')}
            </span>
          </div>
        </li>
        <li className={isEncrypted ? 'ok' : ''}>
          <span className="fiche-dot" aria-hidden />
          <div>
            <strong>{t('details.encryptionStatus')}</strong>
            <span>{isEncrypted ? t('details.encryptedOk') : t('details.notEncrypted')}</span>
          </div>
        </li>
      </ul>
    </section>
  )

  return (
    <>
      <Modal title={fileName} onClose={onClose} xl bare>
        <div className="doc-fiche">
          <header className="fiche-header">
            <FileIcon contentType={contentType} fileName={fileName} />
            <div className="fiche-header-text">
              <h2 title={fileName}>{fileName}</h2>
              <div className="fiche-badges">
                {scanOk && <span className="fiche-badge ok">{t('details.badge.secure')}</span>}
                {isConfidential && (
                  <span className="fiche-badge lock">{t('details.badge.confidential')}</span>
                )}
                {isShared && <span className="fiche-badge info">{t('details.badge.shared')}</span>}
                {isArchived && <span className="fiche-badge warn">{t('details.badge.archived')}</span>}
                {isDeleted && <span className="fiche-badge danger">{statusLabel(status, t)}</span>}
                {isLocked && <span className="fiche-badge warn">{t('details.locked')}</span>}
              </div>
            </div>
            <div className="fiche-header-actions">
              {canDownload && (
                <button type="button" className="btn btn-primary" onClick={onDownload}>
                  {t('action.download')}
                </button>
              )}
              {canFavorite && (
                <button
                  type="button"
                  className={`btn${favorite ? ' fiche-fav-on' : ''}`}
                  onClick={() => void onToggleFavorite()}
                >
                  {favorite ? t('action.unfavorite') : t('action.favorite')}
                </button>
              )}
              <div className="fiche-more" ref={moreRef}>
                {(canModify && !isDeleted) && (
                  <>
                <button
                  type="button"
                  className="btn fiche-more-btn"
                  aria-label={t('action.more')}
                  onClick={() => setMoreOpen((v) => !v)}
                >
                  ⋮
                </button>
                {moreOpen && (
                  <div className="fiche-more-menu" role="menu">
                    {canModify && !isDeleted && !isArchived && (
                      <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); setEditing(true) }}>
                        {t('action.edit')}
                      </button>
                    )}
                    {canModify && !isDeleted && !isArchived && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMoreOpen(false)
                          onClose()
                          navigate(`/documents/upload?documentId=${encodeURIComponent(doc.id)}`)
                        }}
                      >
                        {t('action.newVersion')}
                      </button>
                    )}
                    {canModify && !isDeleted && !isArchived && (
                      <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); void onArchive() }}>
                        {t('action.archive')}
                      </button>
                    )}
                    {canModify && isArchived && (
                      <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); void onRestore() }}>
                        {t('action.restore')}
                      </button>
                    )}
                    {canModify && !isDeleted && (
                      <button type="button" role="menuitem" className="danger" onClick={() => { setMoreOpen(false); void onTrash() }}>
                        {t('action.trash')}
                      </button>
                    )}
                  </div>
                )}
                  </>
                )}
              </div>
              <button type="button" className="modal-close" onClick={onClose} aria-label={t('btn.close')}>
                &times;
              </button>
            </div>
          </header>

          {msg && <div className="fiche-toast" role="status">{msg}</div>}

          {loading && (
            <div className="details-loading-inline">
              <div className="spinner" />
              <span>{t('details.loading')}</span>
            </div>
          )}

          {!loading && (
            <div className="fiche-split">
              <div className="fiche-preview">
                {doc.isFolder ? (
                  <div className="fiche-preview-empty">{t('details.folderNoPreview')}</div>
                ) : (
                  <DocumentPreviewPane doc={doc} />
                )}
              </div>
              <div className="fiche-side">
                {infoCard}
                {securityCard}
                {editing && canModify && !isDeleted && (
                  <section className="fiche-card">
                    <header className="fiche-card-head">
                      <h4>{t('details.edit')}</h4>
                    </header>
                    <div className="details-form">
                      <div className="form-group">
                        <label htmlFor="meta-category">{t('filter.category')}</label>
                        <select id="meta-category" value={category} onChange={(e) => setCategory(e.target.value)} disabled={saving}>
                          {categories.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group details-form-full">
                        <label htmlFor="meta-desc">{t('upload.description')}</label>
                        <textarea
                          id="meta-desc"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          rows={3}
                          disabled={saving}
                          placeholder={t('details.descPlaceholder')}
                        />
                      </div>
                    </div>
                    <div className="fiche-card-actions">
                      <button type="button" className="btn" onClick={() => setEditing(false)}>
                        {t('btn.cancel')}
                      </button>
                      <button type="button" className="btn btn-primary" onClick={() => void saveMeta()} disabled={saving}>
                        {saving ? t('details.saving') : t('btn.save')}
                      </button>
                    </div>
                  </section>
                )}
                {!editing && description.trim() && (
                  <section className="fiche-card">
                    <header className="fiche-card-head">
                      <h4>{t('upload.description')}</h4>
                    </header>
                    <p className="details-description">{description}</p>
                  </section>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
