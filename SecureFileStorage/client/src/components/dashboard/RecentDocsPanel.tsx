import { Link } from 'react-router-dom'
import { FileIcon } from '@/components/documents/FileIcon'
import { VisibilityBadge } from '@/components/documents/DocActionButtons'
import { useI18n } from '@/i18n/I18nContext'
import { fmtDate, fmtSize } from '@/utils/format'
import type { DocumentDto } from '@/types'

interface RecentDocsPanelProps {
  documents: DocumentDto[]
  title?: string
  className?: string
  showOwner?: boolean
}

export function RecentDocsPanel({
  documents,
  title,
  className = '',
  showOwner = false,
}: RecentDocsPanelProps) {
  const { t, locale } = useI18n()
  const heading = title || t('home.recentDocs')

  return (
    <section className={`recent-docs-panel ${className}`.trim()}>
      <div className="recent-docs-header">
        <div>
          <h2>{heading}</h2>
          <p className="recent-docs-subtitle">{t('recentDocs.subtitle')}</p>
        </div>
        <Link to="/documents" className="recent-docs-all">
          {t('home.viewAllDocs')}
          <span aria-hidden>→</span>
        </Link>
      </div>

      {!documents.length ? (
        <p className="recent-docs-empty">{t('empty.documents')}</p>
      ) : (
        <ul className="recent-docs-list">
          {documents.map((d) => (
            <li key={d.id}>
              <Link to="/documents" className="recent-docs-item">
                <div className="recent-docs-icon">
                  <FileIcon contentType={d.contentType} fileName={d.fileName} />
                </div>
                <div className="recent-docs-body">
                  <strong className="recent-docs-name" title={d.fileName}>
                    {d.fileName}
                  </strong>
                  <div className="recent-docs-meta">
                    {d.category && (
                      <span className="recent-docs-chip">{d.category}</span>
                    )}
                    <span className="recent-docs-chip recent-docs-chip-muted">
                      {fmtSize(d.sizeBytes)}
                    </span>
                    <span className="recent-docs-chip recent-docs-chip-muted">
                      v{d.currentVersion}
                    </span>
                    {showOwner && d.ownerName && (
                      <span className="recent-docs-chip recent-docs-chip-muted">
                        {d.ownerName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="recent-docs-side">
                  <VisibilityBadge visibility={d.visibility} />
                  <time dateTime={d.updatedAt || d.createdAt}>
                    {fmtDate(d.updatedAt || d.createdAt, locale)}
                  </time>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
