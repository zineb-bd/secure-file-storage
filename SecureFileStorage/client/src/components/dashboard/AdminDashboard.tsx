import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton'
import { MaturityScorePanel } from '@/components/dashboard/MaturityScorePanel'
import { FileIcon } from '@/components/documents/FileIcon'
import { useI18n } from '@/i18n/I18nContext'
import { fmtDate, fmtSize } from '@/utils/format'
import { activityDescription, activityIconKind } from '@/utils/dashboardHelpers'
import type { AdminUser, DashboardStats, DocumentMaturityScore } from '@/types'

function ActivityDot({ kind }: { kind: string }) {
  return <span className={`admin-dash-activity-dot admin-dash-activity-${kind}`} aria-hidden />
}

export function AdminDashboard() {
  const { t, locale } = useI18n()
  const [data, setData] = useState<DashboardStats | null>(null)
  const [maturity, setMaturity] = useState<DocumentMaturityScore | null>(null)
  const [userCount, setUserCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [stats, users, maturityScore] = await Promise.all([
        api<DashboardStats>('/api/dashboard'),
        api<AdminUser[]>('/api/admin/users'),
        api<DocumentMaturityScore>('/api/dashboard/maturity').catch(() => null),
      ])
      setData(stats)
      setUserCount(users?.length ?? 0)
      setMaturity(maturityScore)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('msg.loadProfileError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <DashboardSkeleton />

  if (error) {
    return (
      <div className="admin-dashboard">
        <div className="msg error">{error}</div>
        <button type="button" className="btn btn-outline" onClick={() => void load()}>{t('audit.refresh')}</button>
      </div>
    )
  }

  if (!data) return null

  const adminLinks = [
    { to: '/admin/users', label: t('nav.users'), desc: t('adminDash.usersDesc') },
    { to: '/admin/roles', label: t('nav.roles'), desc: t('adminDash.rolesDesc') },
    { to: '/admin/audit', label: t('nav.audit'), desc: t('adminDash.auditDesc') },
    { to: '/admin/config', label: t('nav.config'), desc: t('adminDash.configDesc') },
  ]

  return (
    <div className="admin-dashboard" id="page-admin-dashboard">
      <header className="admin-dash-header">
        <div>
          <h1>{t('adminDash.title')}</h1>
          <p>{t('adminDash.subtitle')}</p>
        </div>
        <span className="admin-dash-badge">{t('role.admin')}</span>
      </header>

      <div className="admin-dash-stats">
        <article className="admin-dash-stat">
          <div className="admin-dash-stat-value">{data.totalDocuments}</div>
          <div className="admin-dash-stat-label">{t('stat.totalDocs')}</div>
        </article>
        <article className="admin-dash-stat">
          <div className="admin-dash-stat-value">{fmtSize(data.storageUsedBytes)}</div>
          <div className="admin-dash-stat-label">{t('stat.storage')}</div>
        </article>
        <article className="admin-dash-stat">
          <div className="admin-dash-stat-value">{userCount}</div>
          <div className="admin-dash-stat-label">{t('adminDash.users')}</div>
        </article>
        <article className="admin-dash-stat">
          <div className="admin-dash-stat-value">{data.recentActivity?.length ?? 0}</div>
          <div className="admin-dash-stat-label">{t('card.recentActivity')}</div>
        </article>
      </div>

      {maturity && <MaturityScorePanel data={maturity} />}

      <section className="admin-dash-section">
        <h2>{t('adminDash.quickLinks')}</h2>
        <div className="admin-dash-links">
          {adminLinks.map((link) => (
            <Link key={link.to} to={link.to} className="admin-dash-link-card">
              <strong>{link.label}</strong>
              <span>{link.desc}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="admin-dash-grid">
        <section className="admin-dash-panel">
          <h2>{t('card.recentDocs')}</h2>
          {!data.recentDocuments?.length ? (
            <p className="admin-dash-empty">{t('empty.documents')}</p>
          ) : (
            <ul className="admin-dash-doc-list">
              {data.recentDocuments.map((d) => (
                <li key={d.id}>
                  <FileIcon contentType={d.contentType} fileName={d.fileName} />
                  <div>
                    <strong>{d.fileName}</strong>
                    <span>{d.ownerName} · {d.category}</span>
                  </div>
                  <time>{fmtDate(d.createdAt, locale)}</time>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="admin-dash-panel">
          <h2>{t('card.recentActivity')}</h2>
          {!data.recentActivity?.length ? (
            <p className="admin-dash-empty">{t('empty.recentActivity')}</p>
          ) : (
            <ul className="admin-dash-activity-list">
              {data.recentActivity.map((a, i) => (
                <li key={i}>
                  <ActivityDot kind={activityIconKind(a.action)} />
                  <div>
                    <p>{activityDescription(a, t)}</p>
                    <time>{fmtDate(a.timestamp, locale)}</time>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {data.notifications?.length > 0 && (
        <section className="admin-dash-panel">
          <h2>{t('topbar.notifications')}</h2>
          <ul className="admin-dash-notif-list">
            {data.notifications.map((n, i) => (
              <li key={i}>
                <strong>{n.type}</strong>
                <p>{n.message}</p>
                <time>{fmtDate(n.date, locale)}</time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
