import { useEffect, useState } from 'react'
import { api, downloadBlob } from '@/api/client'
import { Modal } from '@/components/ui/Modal'
import { StatusBadge, VisibilityBadge } from '@/components/documents/DocActionButtons'
import { useI18n } from '@/i18n/I18nContext'
import { fmtDate, fmtSize } from '@/utils/format'
import type { DocumentDetail, DocumentDto, DocumentVersion } from '@/types'

interface ArchiveDetailModalProps {
  doc: DocumentDto
  onClose: () => void
  onRestore: () => void
  onPreview: () => void
  canPermDelete?: boolean
  onPermDelete?: () => void
}

export function ArchiveDetailModal({
  doc,
  onClose,
  onRestore,
  onPreview,
  canPermDelete,
  onPermDelete,
}: ArchiveDetailModalProps) {
  const { t, locale } = useI18n()
  const [detail, setDetail] = useState<DocumentDetail | null>(null)
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const [d, v] = await Promise.all([
          api<DocumentDetail>(`/api/documents/${doc.id}/detail`),
          api<DocumentVersion[]>(`/api/documents/${doc.id}/versions`),
        ])
        setDetail(d)
        setVersions(v || [])
      } finally {
        setLoading(false)
      }
    })()
  }, [doc.id])

  const archivedAt = doc.updatedAt || doc.createdAt

  return (
    <Modal title={t('archive.detailsTitle')} onClose={onClose} wide>
      {loading ? (
        <div className="archive-detail-loading">{t('archive.loading')}</div>
      ) : (
        <>
          <div className="archive-detail-header">
            <h4>{detail?.fileName || doc.fileName}</h4>
            <div className="archive-detail-badges">
              <StatusBadge status="Archived" />
              <VisibilityBadge visibility={doc.visibility} />
            </div>
          </div>
          <dl className="archive-detail-grid">
            <div>
              <dt>{t('table.type')}</dt>
              <dd>{detail?.contentType || doc.contentType || '—'}</dd>
            </div>
            <div>
              <dt>{t('table.size')}</dt>
              <dd>{fmtSize(detail?.sizeBytes ?? doc.sizeBytes)}</dd>
            </div>
            <div>
              <dt>{t('table.owner')}</dt>
              <dd>{detail?.ownerName || doc.ownerName || '—'}</dd>
            </div>
            <div>
              <dt>{t('table.category')}</dt>
              <dd>{detail?.category || doc.category || '—'}</dd>
            </div>
            <div>
              <dt>{t('table.created')}</dt>
              <dd>{fmtDate(detail?.createdAt || doc.createdAt, locale)}</dd>
            </div>
            <div>
              <dt>{t('archive.archivedDate')}</dt>
              <dd>{fmtDate(archivedAt, locale)}</dd>
            </div>
            <div>
              <dt>{t('table.version')}</dt>
              <dd>v{detail?.currentVersion ?? doc.currentVersion ?? 1}</dd>
            </div>
            <div>
              <dt>{t('cat.filterVisibility')}</dt>
              <dd>{doc.visibility || 'Private'}</dd>
            </div>
          </dl>

          <section className="archive-detail-section">
            <h5>{t('archive.versionHistory')}</h5>
            {!versions.length ? (
              <p className="archive-detail-empty">{t('empty.none')}</p>
            ) : (
              <ul className="archive-version-list">
                {versions.slice(0, 5).map((v) => (
                  <li key={v.id}>
                    <span>v{v.versionNumber}</span>
                    <span>{fmtSize(v.sizeBytes)}</span>
                    <span>{v.uploadedByName}</span>
                    <time>{fmtDate(v.createdAt, locale)}</time>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <div className="modal-footer">
        <button type="button" className="btn" onClick={onClose}>
          {t('btn.cancel')}
        </button>
        <button type="button" className="btn btn-outline" onClick={onPreview}>
          {t('action.preview')}
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => void downloadBlob(`/api/documents/${doc.id}/download`, doc.fileName)}
        >
          {t('action.download')}
        </button>
        {doc.canModify !== false && (
          <button type="button" className="btn btn-primary" onClick={onRestore}>
            {t('action.restore')}
          </button>
        )}
        {canPermDelete && onPermDelete && (
          <button type="button" className="btn btn-danger" onClick={onPermDelete}>
            {t('action.permDelete')}
          </button>
        )}
      </div>
    </Modal>
  )
}
