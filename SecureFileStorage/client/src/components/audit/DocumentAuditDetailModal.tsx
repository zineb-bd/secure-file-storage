import { useCallback, useEffect, useState } from 'react'
import { api } from '@/api/client'
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/i18n/I18nContext'
import { fmtDate, fmtSize } from '@/utils/format'
import {
  displayActionLabel,
  integrityFromLogs,
  parseCategory,
  parseDocumentName,
  parseVersion,
  timelineLabel,
  type DocumentMeta,
} from '@/utils/documentAuditHelpers'
import { statusKind } from '@/utils/auditHelpers'
import type { AuditLog, DocumentDetail, DocumentVersion } from '@/types'

interface DocumentAuditDetailModalProps {
  log: AuditLog
  meta?: DocumentMeta | null
  onClose: () => void
  onViewDocumentHistory?: (resourceId: string) => void
}

export function DocumentAuditDetailModal({
  log,
  meta,
  onClose,
  onViewDocumentHistory,
}: DocumentAuditDetailModalProps) {
  const { t, locale } = useI18n()
  const status = statusKind(log)
  const resourceId = log.resourceId || ''

  const [docDetail, setDocDetail] = useState<DocumentDetail | null>(null)
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [history, setHistory] = useState<AuditLog[]>([])
  const [selectedVersion, setSelectedVersion] = useState<DocumentVersion | null>(null)
  const [loading, setLoading] = useState(false)

  const loadDocumentData = useCallback(async () => {
    if (!resourceId) return
    setLoading(true)
    try {
      const [detail, vers, audit] = await Promise.all([
        api<DocumentDetail>(`/api/documents/${resourceId}/detail`).catch(() => null),
        api<DocumentVersion[]>(`/api/documents/${resourceId}/versions`).catch(() => []),
        api<{ items: AuditLog[] }>(
          `/api/admin/audit?resourceId=${resourceId}&page=1&pageSize=100`
        ).catch(() => ({ items: [] })),
      ])
      setDocDetail(detail)
      setVersions(vers || [])
      setHistory((audit.items || []).filter((l) => l.resourceId === resourceId))
      if (vers?.length) setSelectedVersion(vers[0])
    } finally {
      setLoading(false)
    }
  }, [resourceId])

  useEffect(() => {
    void loadDocumentData()
  }, [loadDocumentData])

  const effectiveMeta: DocumentMeta | null = docDetail
    ? {
        id: docDetail.id,
        fileName: docDetail.fileName,
        category: docDetail.category,
        contentType: docDetail.contentType,
        currentVersion: docDetail.currentVersion,
      }
    : meta || null

  const integrity = integrityFromLogs(history)
  const docName = parseDocumentName(log, effectiveMeta)

  return (
    <Modal title={t('docAudit.detailsTitle')} onClose={onClose} wide>
      <div className="doc-audit-modal">
        <section className="doc-audit-modal-section">
          <h4 className="doc-audit-section-heading">{t('docAudit.activityDetails')}</h4>
          <div className="audit-detail-grid">
            <div className="audit-detail-item">
              <span className="audit-detail-label">{t('docAudit.colDocument')}</span>
              <span className="audit-detail-value">{docName}</span>
            </div>
            <div className="audit-detail-item">
              <span className="audit-detail-label">{t('audit.colAction')}</span>
              <span className="audit-detail-value">{displayActionLabel(log, t)}</span>
            </div>
            <div className="audit-detail-item">
              <span className="audit-detail-label">{t('audit.colUser')}</span>
              <span className="audit-detail-value">{log.userEmail || t('audit.anonymous')}</span>
            </div>
            <div className="audit-detail-item">
              <span className="audit-detail-label">{t('audit.colDate')}</span>
              <span className="audit-detail-value">{fmtDate(log.timestamp, locale)}</span>
            </div>
            <div className="audit-detail-item">
              <span className="audit-detail-label">{t('docAudit.colCategory')}</span>
              <span className="audit-detail-value">{parseCategory(log, effectiveMeta)}</span>
            </div>
            <div className="audit-detail-item">
              <span className="audit-detail-label">{t('docAudit.colVersion')}</span>
              <span className="audit-detail-value">{parseVersion(log, effectiveMeta)}</span>
            </div>
            <div className="audit-detail-item">
              <span className="audit-detail-label">{t('audit.colStatus')}</span>
              <span className={`audit-badge audit-badge-${status}`}>
                {t(`audit.status.${status}`)}
              </span>
            </div>
            <div className="audit-detail-item">
              <span className="audit-detail-label">{t('audit.colIp')}</span>
              <span className="audit-detail-value">{log.ipAddress || t('users.notAvailable')}</span>
            </div>
            {log.details && (
              <div className="audit-detail-item audit-detail-full">
                <span className="audit-detail-label">{t('audit.additionalDetails')}</span>
                <span className="audit-detail-value">{log.details}</span>
              </div>
            )}
          </div>
        </section>

        {resourceId && (
          <>
            <section className="doc-audit-modal-section">
              <div className="doc-audit-section-header">
                <h4 className="doc-audit-section-heading">
                  {t('docAudit.documentHistory')} — {docName}
                </h4>
              </div>
              {loading ? (
                <p className="doc-audit-loading">{t('archive.loading')}</p>
              ) : !history.length ? (
                <p className="doc-audit-empty">{t('docAudit.noHistory')}</p>
              ) : (
                <ol className="doc-audit-lifecycle-timeline">
                  {[...history]
                    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                    .map((entry) => (
                      <li key={entry.id} className="doc-audit-lifecycle-item">
                        <span className="doc-audit-lifecycle-dot" aria-hidden />
                        <div className="doc-audit-lifecycle-body">
                          <time>
                            {new Date(entry.timestamp).toLocaleTimeString(locale, {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </time>
                          <span>{timelineLabel(entry, t)}</span>
                          {entry.userEmail && (
                            <span className="doc-audit-lifecycle-user">{entry.userEmail}</span>
                          )}
                        </div>
                      </li>
                    ))}
                </ol>
              )}
            </section>

            <section className="doc-audit-modal-section">
              <h4 className="doc-audit-section-heading">{t('docAudit.versionHistory')}</h4>
              {loading ? (
                <p className="doc-audit-loading">{t('archive.loading')}</p>
              ) : !versions.length ? (
                <p className="doc-audit-empty">{t('empty.none')}</p>
              ) : (
                <>
                  <div className="doc-audit-versions-table-wrap">
                    <table className="data-table doc-audit-versions-table">
                      <thead>
                        <tr>
                          <th>{t('docAudit.colVersion')}</th>
                          <th>{t('table.created')}</th>
                          <th>{t('audit.colUser')}</th>
                          <th>{t('table.size')}</th>
                          <th>{t('audit.colStatus')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {versions.map((v) => (
                          <tr
                            key={v.id}
                            className={`doc-audit-version-row${selectedVersion?.id === v.id ? ' selected' : ''}`}
                            onClick={() => setSelectedVersion(v)}
                          >
                            <td>v{v.versionNumber}</td>
                            <td>{fmtDate(v.createdAt, locale)}</td>
                            <td>{v.uploadedByName}</td>
                            <td>{fmtSize(v.sizeBytes)}</td>
                            <td>
                              <span className="audit-badge audit-badge-success">
                                {t('audit.status.success')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {selectedVersion && (
                    <div className="doc-audit-version-detail">
                      <h5>{t('docAudit.versionDetail', { version: String(selectedVersion.versionNumber) })}</h5>
                      <dl className="doc-audit-version-dl">
                        <div>
                          <dt>{t('table.created')}</dt>
                          <dd>{fmtDate(selectedVersion.createdAt, locale)}</dd>
                        </div>
                        <div>
                          <dt>{t('audit.colUser')}</dt>
                          <dd>{selectedVersion.uploadedByName}</dd>
                        </div>
                        <div>
                          <dt>{t('table.size')}</dt>
                          <dd>{fmtSize(selectedVersion.sizeBytes)}</dd>
                        </div>
                        {selectedVersion.changeComment && (
                          <div className="doc-audit-version-dl-full">
                            <dt>{t('audit.description')}</dt>
                            <dd>{selectedVersion.changeComment}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  )}
                </>
              )}
            </section>

            <section className="doc-audit-modal-section">
              <h4 className="doc-audit-section-heading">{t('docAudit.integrityTitle')}</h4>
              <div className={`doc-audit-integrity-card${integrity?.verified === false ? ' failed' : ''}`}>
                {integrity ? (
                  <>
                    <div className="doc-audit-integrity-status">
                      {integrity.verified ? (
                        <>
                          <span className="doc-audit-integrity-icon ok">✓</span>
                          <strong>{t('docAudit.integrityVerified')}</strong>
                        </>
                      ) : (
                        <>
                          <span className="doc-audit-integrity-icon warn">⚠</span>
                          <strong>{t('docAudit.integrityFailed')}</strong>
                        </>
                      )}
                    </div>
                    <p className="doc-audit-integrity-meta">
                      {t('docAudit.lastVerification')}: {fmtDate(integrity.lastCheckAt, locale)}
                    </p>
                    {integrity.details && (
                      <p className="doc-audit-integrity-detail">{integrity.details}</p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="doc-audit-integrity-status">
                      <span className="doc-audit-integrity-icon ok">✓</span>
                      <strong>{t('docAudit.hashAvailable')}</strong>
                    </div>
                    <p className="doc-audit-integrity-meta">{t('docAudit.noVerificationYet')}</p>
                  </>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      <div className="modal-footer">
        {resourceId && onViewDocumentHistory && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              onViewDocumentHistory(resourceId)
              onClose()
            }}
          >
            {t('docAudit.viewInPage')}
          </button>
        )}
        <button type="button" className="btn" onClick={onClose}>
          {t('btn.close')}
        </button>
      </div>
    </Modal>
  )
}
