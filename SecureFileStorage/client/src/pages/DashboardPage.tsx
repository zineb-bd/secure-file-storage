import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { FileIcon } from '@/components/documents/FileIcon'
import { useI18n } from '@/i18n/I18nContext'
import { fmtDate, fmtSize } from '@/utils/format'
import type { DashboardStats } from '@/types'

export function DashboardPage() {
  const { t, locale } = useI18n()
  const [data, setData] = useState<DashboardStats | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void api<DashboardStats>('/api/dashboard')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'))
  }, [])

  const actionLabel = (action: string) => {
    const key = `action.${action}`
    const label = t(key)
    return label !== key ? label : action || '—'
  }

  return (
    <section className="page" id="page-dashboard">
      <PageHeader title={t('page.dashboard.title')} subtitle={t('page.dashboard.subtitle')} />
      {error && <div className="msg error">{error}</div>}
      {data && (
        <>
          <div className="stats-grid" id="dashboard-stats">
            <div className="stat-card">
              <div className="stat-icon">
                <span className="stat-abbr">DOC</span>
              </div>
              <div>
                <div className="stat-value">{data.totalDocuments}</div>
                <div className="stat-label">{t('stat.totalDocs')}</div>
              </div>
            </div>
            <div className="stat-card green">
              <div className="stat-icon">
                <span className="stat-abbr">STO</span>
              </div>
              <div>
                <div className="stat-value">{fmtSize(data.storageUsedBytes)}</div>
                <div className="stat-label">{t('stat.storage')}</div>
                {data.bytesSavedByDedup > 0 && (
                  <div className="stat-hint">
                    {fmtSize(data.bytesSavedByDedup)} {t('stat.saved')}
                  </div>
                )}
              </div>
            </div>
            <div className="stat-card amber">
              <div className="stat-icon">
                <span className="stat-abbr">ENV</span>
              </div>
              <div>
                <div className="stat-value">{data.recentDocuments?.length ?? 0}</div>
                <div className="stat-label">{t('stat.recent')}</div>
              </div>
            </div>
            <div className="stat-card red">
              <div className="stat-icon">
                <span className="stat-abbr">ALR</span>
              </div>
              <div>
                <div className="stat-value">0</div>
                <div className="stat-label">{t('topbar.notifications')}</div>
              </div>
            </div>
          </div>
          <div className="grid-2">
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">{t('card.recentDocs')}</h3>
              </div>
              {!data.recentDocuments?.length ? (
                <div className="empty-state">{t('empty.documents')}</div>
              ) : (
                <div className="table-wrap" id="dash-recent-docs">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th />
                        <th>{t('table.file')}</th>
                        <th>{t('table.category')}</th>
                        <th>{t('table.size')}</th>
                        <th>{t('table.date')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentDocuments.map((d) => (
                        <tr key={d.id}>
                          <td>
                            <FileIcon contentType={d.contentType} fileName={d.fileName} />
                          </td>
                          <td>{d.fileName}</td>
                          <td>{d.category}</td>
                          <td>{fmtSize(d.sizeBytes)}</td>
                          <td>{fmtDate(d.createdAt, locale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">{t('card.recentActivity')}</h3>
              </div>
              {!data.recentActivity?.length ? (
                <div className="empty-state">{t('empty.recentActivity')}</div>
              ) : (
                <div className="table-wrap" id="dash-recent-activity">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t('table.action')}</th>
                        <th>{t('table.document')}</th>
                        <th>{t('table.date')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentActivity.map((a, i) => (
                        <tr key={i}>
                          <td>{actionLabel(a.action)}</td>
                          <td>{a.documentName || '—'}</td>
                          <td>{fmtDate(a.timestamp, locale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">{t('topbar.notifications')}</h3>
            </div>
            <div className="empty-state" id="dash-notifications">
              {t('empty.notifications')}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
