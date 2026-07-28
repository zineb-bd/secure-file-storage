import { useEffect, useState } from 'react'
import { api, downloadBlob } from '@/api/client'
import { Modal } from '@/components/ui/Modal'
import { StatusBadge, VisibilityBadge } from '@/components/documents/DocActionButtons'
import { useI18n } from '@/i18n/I18nContext'
import { fmtDate, fmtSize } from '@/utils/format'
import type { DocumentDetail, DocumentDto, DocumentVersion } from '@/types'

interface TrashDetailModalProps {
  doc: DocumentDto
  onClose: () => void
  onRestore: () => void
  onPreview: () => void
  canPermDelete?: boolean
  onPermDelete?: () => void
}

function deletedAt(doc: DocumentDto) {
  return doc.deletedAt || doc.updatedAt || doc.createdAt
}

export function TrashDetailModal({
  doc,
  onClose,
  onRestore,
  onPreview,
  canPermDelete,
  onPermDelete,
}: TrashDetailModalProps) {
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

  return (
    <Modal title={t('trash.detailsTitle')} onClose={onClose} wide>
      {loading ? (
        <div className="trash-detail-loading">{t('trash.loading')}</div>
      ) : (
        <>
          <div className="trash-detail-header">
            <h4>{detail?.fileName || doc.fileName}</h4>
            <div className="trash-detail-badges">
              <StatusBadge status="Deleted" />
              <VisibilityBadge visibility={doc.visibility} />
            </div>
          </div>
          <dl className="trash-detail-grid">
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
              <dt>{t('trash.originalCategory')}</dt>
              <dd>{detail?.category || doc.category || '—'}</dd>
            </div>
            <div>
              <dt>{t('table.created')}</dt>
              <dd>{fmtDate(detail?.createdAt || doc.createdAt, locale)}</dd>
            </div>
            <div>
              <dt>{t('trash.deletedDate')}</dt>
              <dd>{fmtDate(deletedAt(doc), locale)}</dd>
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
          <section className="trash-detail-section">
            <h5>{t('trash.versionHistory')}</h5>
            {!versions.length ? (
              <p className="trash-detail-empty">{t('empty.none')}</p>
            ) : (
              <ul className="trash-version-list">
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
        <button type="button" className="btn" onClick={onClose}>{t('btn.cancel')}</button>
        <button type="button" className="btn btn-outline" onClick={onPreview}>{t('action.preview')}</button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => void downloadBlob(`/api/documents/${doc.id}/download`, doc.fileName)}
        >
          {t('action.download')}
        </button>
        {doc.canModify !== false && (
          <button type="button" className="btn btn-primary" onClick={onRestore}>{t('action.restore')}</button>
        )}
        {canPermDelete && onPermDelete && (
          <button type="button" className="btn btn-danger" onClick={onPermDelete}>{t('action.permDelete')}</button>
        )}
      </div>
    </Modal>
  )
}
