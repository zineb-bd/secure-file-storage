import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { CATEGORIES } from '@/constants'
import { useI18n } from '@/i18n/I18nContext'
import { fmtDate, fmtSize } from '@/utils/format'
import type { DocumentCollaborators, DocumentDetail, DocumentDto, DocumentVersion } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { FileIcon } from '@/components/documents/FileIcon'
import { loadCustomCategories } from '@/utils/categoryStorage'

interface MetadataModalProps {
  doc: DocumentDto
  onClose: () => void
  onSaved?: () => void
}

type DetailsTab = 'info' | 'security' | 'access'

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

function visibilityLabel(value: string, t: (k: string) => string) {
  const map: Record<string, string> = {
    Private: t('vis.private'),
    Public: t('vis.public'),
  }
  return map[value] || value
}

function initialsOf(name: string, email: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  if (parts.length === 1 && parts[0].length) return parts[0].slice(0, 2).toUpperCase()
  return (email[0] || '?').toUpperCase()
}

function shortId(id: string) {
  if (!id) return '—'
  return id.length > 12 ? `${id.slice(0, 8)}…` : id
}

function statusLabel(status: string, t: (k: string) => string) {
  const map: Record<string, string> = {
    Active: t('status.active'),
    Archived: t('status.archived'),
    Deleted: t('status.deleted'),
  }
  return map[status] || status || '—'
}

export function MetadataModal({ doc, onClose, onSaved }: MetadataModalProps) {
  const { t, locale } = useI18n()
  const [tab, setTab] = useState<DetailsTab>('info')
  const [detail, setDetail] = useState<DocumentDetail | null>(null)
  const [collaborators, setCollaborators] = useState<DocumentCollaborators | null>(null)
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [category, setCategory] = useState(doc.category)
  const [description, setDescription] = useState(doc.description || '')
  const [msg, setMsg] = useState('')
  const [msgOk, setMsgOk] = useState(false)
  const [saving, setSaving] = useState(false)
  const [integrity, setIntegrity] = useState<{ ok: boolean; message: string } | null>(null)
  const [checking, setChecking] = useState(false)
  const [loading, setLoading] = useState(true)

  const categories = [...new Set([...CATEGORIES, ...loadCustomCategories().map((c) => c.name), doc.category])]
  const canModify = detail?.canModify ?? doc.canModify

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setDetail(null)
    setCollaborators(null)
    setVersions([])

    const load = async () => {
      const [detailResult, collabResult, versionsResult] = await Promise.allSettled([
        api<DocumentDetail>(`/api/documents/${doc.id}/detail`),
        api<DocumentCollaborators>(`/api/documents/${doc.id}/collaborators`),
        api<DocumentVersion[]>(`/api/documents/${doc.id}/versions`),
      ])

      if (cancelled) return

      if (detailResult.status === 'fulfilled') {
        setDetail(detailResult.value)
        setCategory(detailResult.value.category)
        setDescription(detailResult.value.description || '')
      }

      if (collabResult.status === 'fulfilled') {
        setCollaborators(collabResult.value)
      }

      if (versionsResult.status === 'fulfilled') {
        setVersions(versionsResult.value || [])
      }

      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [doc.id])

  const save = async () => {
    if (!canModify) return
    setMsg('')
    setMsgOk(false)
    setSaving(true)
    try {
      await api(`/api/documents/${doc.id}/metadata`, {
        method: 'PUT',
        body: JSON.stringify({ category, description }),
      })
      setMsgOk(true)
      setMsg(t('details.saved'))
      onSaved?.()
      onClose()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const checkIntegrity = async () => {
    setChecking(true)
    setIntegrity(null)
    try {
      const r = await api<{ isValid: boolean; message: string }>(`/api/documents/${doc.id}/integrity`)
      setIntegrity({ ok: r.isValid, message: r.message })
    } catch (err) {
      setIntegrity({
        ok: false,
        message: err instanceof Error ? err.message : 'Erreur',
      })
    } finally {
      setChecking(false)
    }
  }

  const fileName = detail?.fileName || doc.fileName
  const size = detail?.sizeBytes ?? doc.sizeBytes
  const owner = detail?.ownerName || doc.ownerName
  const ownerId = detail?.ownerId || doc.ownerId
  const created = detail?.createdAt || doc.createdAt
  const updated = detail?.updatedAt || doc.updatedAt
  const ext = detail?.extension || (fileName.includes('.') ? fileName.split('.').pop() : '') || '—'
  const hash = detail?.sha256Hash || doc.sha256Hash
  const scan = detail?.lastScanResult || doc.lastScanResult
  const version = detail?.currentVersion ?? doc.currentVersion
  const visibility = detail?.visibility || doc.visibility
  const isEncrypted = detail?.isEncrypted ?? true
  const isCompressed = detail?.isCompressed ?? false
  const encryptionAlgo = detail?.encryptionAlgorithm || 'AesCbcLegacy'
  const isLocked = detail?.isLocked ?? doc.isLocked
  const myAccess = doc.myAccessLevel || (doc.isOwner ? 'Owner' : null)
  const peopleCount = collaborators ? collaborators.collaborators.length + 1 : 0
  const scanOk = (scan || '').toLowerCase() === 'clean'
  const status = detail?.status || doc.status
  const createdMs = created ? new Date(created).getTime() : NaN
  const ageDays = Number.isNaN(createdMs)
    ? null
    : Math.max(0, Math.floor((Date.now() - createdMs) / 86_400_000))

  return (
    <Modal title={t('action.details')} onClose={onClose} wide>
      <div className="details-studio">
        <div className="details-doc-chip">
          <FileIcon contentType={detail?.contentType || doc.contentType} fileName={fileName} />
          <div className="details-doc-chip-text">
            <span className="details-doc-label">{t('details.document')}</span>
            <strong title={fileName}>{fileName}</strong>
            <span className="details-doc-sub">
              .{ext} · v{version} · {visibilityLabel(visibility, t)}
              {myAccess ? ` · ${accessLabel(myAccess, t)}` : ''}
            </span>
          </div>
          <div className="details-chip-badges">
            {scan && (
              <span className={`details-scan-pill ${scanOk ? 'ok' : 'warn'}`}>{scan}</span>
            )}
            {isLocked && <span className="details-scan-pill lock">{t('details.locked')}</span>}
          </div>
        </div>

        <div className="details-segment collab-segment" role="tablist" aria-label={t('action.details')}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'info'}
            className={tab === 'info' ? 'active' : ''}
            onClick={() => setTab('info')}
          >
            {t('details.tab.info')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'security'}
            className={tab === 'security' ? 'active' : ''}
            onClick={() => setTab('security')}
          >
            {t('details.tab.security')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'access'}
            className={tab === 'access' ? 'active' : ''}
            onClick={() => setTab('access')}
          >
            {t('details.tab.access')}
            {peopleCount > 0 && <span className="collab-count">{peopleCount}</span>}
          </button>
        </div>

        {loading && (
          <div className="details-loading-inline" aria-live="polite">
            <div className="spinner" />
            <span>{t('details.loading')}</span>
          </div>
        )}

        {tab === 'info' && (
          <div className="details-panel">
            <div className="details-kpis">
              <div className="details-kpi">
                <span className="details-kpi-label">{t('table.size')}</span>
                <strong className="details-kpi-value">{fmtSize(size)}</strong>
                <span className="details-kpi-sub">.{ext}</span>
              </div>
              <div className="details-kpi">
                <span className="details-kpi-label">{t('details.version')}</span>
                <strong className="details-kpi-value">v{version}</strong>
                <span className="details-kpi-sub">
                  {versions.length
                    ? `${versions.length} ${t('details.versionsCount')}`
                    : t('details.singleVersion')}
                </span>
              </div>
              <div className="details-kpi">
                <span className="details-kpi-label">{t('table.status')}</span>
                <strong className="details-kpi-value">{statusLabel(status, t)}</strong>
                <span className="details-kpi-sub">{visibilityLabel(visibility, t)}</span>
              </div>
              <div className="details-kpi">
                <span className="details-kpi-label">{t('details.age')}</span>
                <strong className="details-kpi-value">
                  {ageDays !== null ? `${ageDays} ${t('details.days')}` : '—'}
                </strong>
                <span className="details-kpi-sub">
                  {updated ? t('details.updatedShort') : t('details.neverUpdated')}
                </span>
              </div>
            </div>

            <section className="details-card">
              <header className="details-card-head">
                <h4>{t('details.overview')}</h4>
              </header>
              <dl className="details-stats">
                <div>
                  <dt>{t('table.name')}</dt>
                  <dd title={fileName}>{fileName}</dd>
                </div>
                <div>
                  <dt>{t('details.type')}</dt>
                  <dd title={detail?.contentType || doc.contentType || undefined}>
                    {detail?.contentType || doc.contentType || '—'}
                  </dd>
                </div>
                <div>
                  <dt>{t('table.owner')}</dt>
                  <dd title={ownerId ? `${owner} (${ownerId})` : owner}>{owner}</dd>
                </div>
                <div>
                  <dt>{t('details.ownerId')}</dt>
                  <dd className="details-mono" title={ownerId}>
                    {shortId(ownerId)}
                  </dd>
                </div>
                <div>
                  <dt>{t('table.created')}</dt>
                  <dd>{fmtDate(created, locale)}</dd>
                </div>
                <div>
                  <dt>{t('details.updated')}</dt>
                  <dd>{updated ? fmtDate(updated, locale) : '—'}</dd>
                </div>
                <div>
                  <dt>{t('filter.category')}</dt>
                  <dd>{category || '—'}</dd>
                </div>
                <div>
                  <dt>{t('details.docId')}</dt>
                  <dd className="details-mono" title={doc.id}>
                    {shortId(doc.id)}
                  </dd>
                </div>
              </dl>
            </section>

            {!canModify && (
              <section className="details-card">
                <header className="details-card-head">
                  <h4>{t('upload.description')}</h4>
                  <span className="details-readonly-pill">{t('details.readOnly')}</span>
                </header>
                {description.trim() ? (
                  <p className="details-description">{description}</p>
                ) : (
                  <p className="details-empty">{t('details.noDescription')}</p>
                )}
              </section>
            )}

            <section className="details-card">
              <header className="details-card-head">
                <h4>{t('details.recentVersions')}</h4>
                <span className="details-count">{versions.length}</span>
              </header>
              {versions.length ? (
                <ol className="details-versions">
                  {[...versions]
                    .sort((a, b) => b.versionNumber - a.versionNumber)
                    .slice(0, 4)
                    .map((v) => (
                      <li key={v.id} className={v.versionNumber === version ? 'current' : ''}>
                        <span className="details-version-tag">v{v.versionNumber}</span>
                        <div className="details-version-body">
                          <strong>{v.uploadedByName}</strong>
                          <span>
                            {fmtSize(v.sizeBytes)} · {fmtDate(v.createdAt, locale)}
                          </span>
                          {v.changeComment && <em>{v.changeComment}</em>}
                        </div>
                      </li>
                    ))}
                </ol>
              ) : (
                <p className="details-empty">{t('empty.none')}</p>
              )}
            </section>

            {canModify && (
              <section className="details-card">
                <header className="details-card-head">
                  <h4>{t('details.edit')}</h4>
                </header>
                <div className="details-form">
                  <div className="form-group">
                    <label htmlFor="meta-category">{t('filter.category')}</label>
                    <select
                      id="meta-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      disabled={saving}
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
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
              </section>
            )}
          </div>
        )}

        {tab === 'security' && (
          <div className="details-panel">
            <section className="details-card">
              <header className="details-card-head">
                <h4>{t('details.protection')}</h4>
              </header>
              <div className="details-protect-grid">
                <div className={`details-protect-item ${isEncrypted ? 'ok' : ''}`}>
                  <span className="details-protect-label">{t('details.encryptionStatus')}</span>
                  <strong>
                    {isEncrypted
                      ? `${t('details.encrypted')} (${encryptionAlgo})`
                      : t('details.notEncrypted')}
                  </strong>
                </div>
                <div className={`details-protect-item ${isCompressed ? 'ok' : ''}`}>
                  <span className="details-protect-label">{t('details.compressionStatus')}</span>
                  <strong>
                    {isCompressed ? t('details.compressed') : t('details.notCompressed')}
                  </strong>
                </div>
                <div className={`details-protect-item ${scanOk ? 'ok' : scan ? 'warn' : ''}`}>
                  <span className="details-protect-label">{t('details.antivirus')}</span>
                  <strong>{scan || '—'}</strong>
                </div>
                <div className={`details-protect-item ${isLocked ? 'warn' : ''}`}>
                  <span className="details-protect-label">{t('details.lockStatus')}</span>
                  <strong>
                    {isLocked
                      ? `${t('details.locked')}${detail?.lockedByName || doc.lockedByName ? ` · ${detail?.lockedByName || doc.lockedByName}` : ''}`
                      : t('details.unlocked')}
                  </strong>
                </div>
              </div>
            </section>

            <section className="details-card">
              <header className="details-card-head">
                <h4>{t('details.decryptIntegrityTitle')}</h4>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={checking}
                  onClick={() => void checkIntegrity()}
                >
                  {checking ? t('details.checking') : t('details.decryptAndVerify')}
                </button>
              </header>
              <p className="details-hint">{t('details.integrityHint')}</p>
              <p className="details-hash-label">{t('upload.studio.hashLabel')}</p>
              <p className="details-hash">{hash || '—'}</p>
              {integrity && (
                <div className={`details-integrity-result ${integrity.ok ? 'ok' : 'err'}`}>
                  <strong>{integrity.ok ? t('details.integrityOk') : t('details.integrityFail')}</strong>
                  <span>{integrity.message}</span>
                </div>
              )}
            </section>
          </div>
        )}

        {tab === 'access' && (
          <div className="details-panel">
            <section className="details-card">
              <header className="details-card-head">
                <h4>{t('details.visibility')}</h4>
              </header>
              <dl className="details-stats details-stats-compact">
                <div>
                  <dt>{t('details.visibility')}</dt>
                  <dd>{visibilityLabel(visibility, t)}</dd>
                </div>
                <div>
                  <dt>{t('details.publicAccess')}</dt>
                  <dd>
                    {visibility === 'Public'
                      ? accessLabel(detail?.publicAccessLevel || doc.publicAccessLevel, t)
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt>{t('details.myAccess')}</dt>
                  <dd>{myAccess ? accessLabel(myAccess, t) : '—'}</dd>
                </div>
                <div>
                  <dt>{t('filter.category')}</dt>
                  <dd>{category || '—'}</dd>
                </div>
              </dl>
              <p className="details-hint">{t('details.categoryAccessHint')}</p>
            </section>

            <section className="details-card">
              <header className="details-card-head">
                <h4>{t('collab.sharedWith')}</h4>
                <span className="details-count">{peopleCount || 0}</span>
              </header>
              {collaborators ? (
                <ul className="details-people">
                  <li className="details-person owner">
                    <span className="collab-avatar" aria-hidden>
                      {initialsOf(collaborators.owner.userName, collaborators.owner.userEmail)}
                    </span>
                    <div className="collab-person-meta">
                      <strong>{collaborators.owner.userName}</strong>
                      <span>{collaborators.owner.userEmail}</span>
                    </div>
                    <span className="collab-pill owner">{t('collab.role.owner')}</span>
                  </li>
                  {collaborators.collaborators.map((c) => (
                    <li key={c.permissionId || c.userId || c.userEmail} className="details-person">
                      <span className="collab-avatar" aria-hidden>
                        {initialsOf(c.userName, c.userEmail)}
                      </span>
                      <div className="collab-person-meta">
                        <strong>{c.userName}</strong>
                        <span>{c.userEmail}</span>
                      </div>
                      <span className="collab-pill">{accessLabel(c.accessLevel, t)}</span>
                    </li>
                  ))}
                  {!collaborators.collaborators.length && (
                    <li className="details-empty">{t('collab.none')}</li>
                  )}
                </ul>
              ) : (
                <p className="details-empty">{t('details.accessUnavailable')}</p>
              )}
            </section>
          </div>
        )}

        {msg && (
          <div className={`collab-alert${msgOk ? ' ok' : ' err'}`} role="status">
            {msg}
          </div>
        )}

        <div className="details-footer">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            {canModify && tab === 'info' ? t('btn.cancel') : t('btn.close')}
          </button>
          {canModify && tab === 'info' && (
            <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving}>
              {saving ? t('details.saving') : t('btn.save')}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
