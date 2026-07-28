import { useI18n } from '@/i18n/I18nContext'
import { fmtDate } from '@/utils/format'
import { actionLabel, statusKind } from '@/utils/auditHelpers'
import { Modal } from '@/components/ui/Modal'
import type { AuditLog } from '@/types'

interface AuditDetailModalProps {
  log: AuditLog
  onClose: () => void
}

export function AuditDetailModal({ log, onClose }: AuditDetailModalProps) {
  const { t, locale } = useI18n()
  const status = statusKind(log)

  return (
    <Modal title={t('audit.detailsTitle')} onClose={onClose} wide>
      <div className="audit-detail-grid">
        <div className="audit-detail-item">
          <span className="audit-detail-label">{t('audit.colUser')}</span>
          <span className="audit-detail-value">{log.userEmail || t('audit.anonymous')}</span>
        </div>
        <div className="audit-detail-item">
          <span className="audit-detail-label">{t('table.email')}</span>
          <span className="audit-detail-value">{log.userEmail || '—'}</span>
        </div>
        <div className="audit-detail-item">
          <span className="audit-detail-label">{t('audit.colAction')}</span>
          <span className="audit-detail-value">{actionLabel(log.action, t)}</span>
        </div>
        <div className="audit-detail-item">
          <span className="audit-detail-label">{t('audit.colDate')}</span>
          <span className="audit-detail-value">{fmtDate(log.timestamp, locale)}</span>
        </div>
        <div className="audit-detail-item">
          <span className="audit-detail-label">{t('audit.colResource')}</span>
          <span className="audit-detail-value">{log.details || '—'}</span>
        </div>
        <div className="audit-detail-item">
          <span className="audit-detail-label">{t('audit.resourceId')}</span>
          <span className="audit-detail-value audit-detail-mono">{log.resourceId || '—'}</span>
        </div>
        <div className="audit-detail-item">
          <span className="audit-detail-label">{t('audit.colResourceType')}</span>
          <span className="audit-detail-value">{log.resourceType}</span>
        </div>
        <div className="audit-detail-item">
          <span className="audit-detail-label">{t('audit.colIp')}</span>
          <span className="audit-detail-value">{log.ipAddress || t('users.notAvailable')}</span>
        </div>
        <div className="audit-detail-item">
          <span className="audit-detail-label">{t('audit.deviceBrowser')}</span>
          <span className="audit-detail-value">{t('users.notAvailable')}</span>
        </div>
        <div className="audit-detail-item">
          <span className="audit-detail-label">{t('audit.colStatus')}</span>
          <span className={`audit-badge audit-badge-${status}`}>
            {t(`audit.status.${status}`)}
          </span>
        </div>
        <div className="audit-detail-item audit-detail-full">
          <span className="audit-detail-label">{t('audit.description')}</span>
          <span className="audit-detail-value">{log.details || '—'}</span>
        </div>
        <div className="audit-detail-item audit-detail-full">
          <span className="audit-detail-label">{t('audit.additionalDetails')}</span>
          <span className="audit-detail-value audit-detail-mono">
            {log.userId ? `UserId: ${log.userId}` : '—'}
            {log.resourceId ? ` · ResourceId: ${log.resourceId}` : ''}
          </span>
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn" onClick={onClose}>{t('btn.close')}</button>
      </div>
    </Modal>
  )
}
