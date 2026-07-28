import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton'
import { CategoryIcon } from '@/components/categories/CategoryIcons'
import { VisibilityBadge } from '@/components/documents/DocActionButtons'
import { FileIcon } from '@/components/documents/FileIcon'
import { IconUpload } from '@/components/ui/TopbarIcons'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/i18n/I18nContext'
import { buildQuery, fmtDate, fmtSize } from '@/utils/format'
import { getCategoryMeta } from '@/utils/categoryStorage'
import {
  accessLevelLabel,
  activityDescription,
  activityIconKind,
  countSharedOwned,
  groupByCategory,
  storageMeterPercent,
} from '@/utils/dashboardHelpers'
import type { DashboardStats, DocumentDto, PagedResult } from '@/types'

function ActivityIcon({ kind }: { kind: string }) {
  const cls = `home-activity-icon home-activity-icon-${kind}`
  return <span className={cls} aria-hidden />
}

interface HomeData {
  dashboard: DashboardStats
  shared: PagedResult<DocumentDto>
  archivedCount: number
  ownedDocs: DocumentDto[]
  favoriteDocs: DocumentDto[]
}

export function HomeDashboard() {
  const { t, locale } = useI18n()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [data, setData] = useState<HomeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [dashboard, shared, archived, owned, favorites] = await Promise.all([
        api<DashboardStats>('/api/dashboard'),
        api<PagedResult<DocumentDto>>('/api/documents/shared-with-me?page=1&pageSize=5'),
        api<PagedResult<DocumentDto>>(
          `/api/documents${buildQuery({ status: 'Archived', page: 1, pageSize: 1 })}`
        ),
        api<PagedResult<DocumentDto>>(
          `/api/documents${buildQuery({ status: 'Active', page: 1, pageSize: 500 })}`
        ),
        api<PagedResult<DocumentDto>>('/api/documents/favorites?page=1&pageSize=5'),
      ])
      setData({
        dashboard,
        shared,
        archivedCount: archived.totalCount ?? 0,
        ownedDocs: owned.items || [],
        favoriteDocs: favorites.items || [],
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : t('msg.loadProfileError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const favoriteDocs = data?.favoriteDocs || []

  const categories = useMemo(() => {
    if (!data) return []
    return groupByCategory(data.ownedDocs.filter((d) => d.isOwner !== false)).slice(0, 6)
  }, [data])

  const sharedOwnedCount = useMemo(() => {
    if (!data) return 0
    return countSharedOwned(data.ownedDocs)
  }, [data])

  if (loading) return <DashboardSkeleton />

  if (error) {
    return (
      <div className="home-dashboard">
        <div className="msg error">{error}</div>
        <button type="button" className="btn btn-outline" onClick={() => void load()}>
          {t('audit.refresh')}
        </button>
      </div>
    )
  }

  if (!data) return null

  const { dashboard, shared, archivedCount } = data
  const isEmpty = dashboard.totalDocuments === 0
  const storagePct = storageMeterPercent(dashboard.storageUsedBytes, dashboard.logicalStorageBytes)

  const quickActions = [
    { key: 'upload', label: t('home.action.upload'), primary: true, onClick: () => navigate('/documents/upload') },
    { key: 'documents', label: t('home.action.documents'), to: '/documents' },
    { key: 'shared', label: t('home.action.shared'), to: '/shared' },
    { key: 'categories', label: t('home.action.categories'), to: '/categories' },
    { key: 'archived', label: t('home.action.archived'), to: '/archived' },
    { key: 'trash', label: t('home.action.trash'), to: '/trash' },
  ] as const

  if (isEmpty) {
    return (
      <div className="home-dashboard" id="page-dashboard">
        <header className="home-welcome">
          <div>
            <h1 className="home-welcome-title">
              {t('home.welcome', { name: user?.fullName || t('msg.defaultUser') })}
            </h1>
            <p className="home-welcome-subtitle">{t('home.subtitle')}</p>
          </div>
        </header>
        <div className="home-empty">
          <div className="home-empty-icon" aria-hidden />
          <h2>{t('home.emptyTitle')}</h2>
          <p>{t('home.emptyDesc')}</p>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate('/documents/upload')}>
            <IconUpload />
            {t('home.emptyCta')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="home-dashboard" id="page-dashboard">
      <header className="home-welcome">
        <div>
          <h1 className="home-welcome-title">
            {t('home.welcome', { name: user?.fullName || t('msg.defaultUser') })}
          </h1>
          <p className="home-welcome-subtitle">{t('home.subtitle')}</p>
        </div>
        <button type="button" className="btn btn-primary home-welcome-upload" onClick={() => navigate('/documents/upload')}>
          <IconUpload />
          {t('home.action.upload')}
        </button>
      </header>

      <section className="home-section">
        <h2 className="home-section-title">{t('home.quickActions')}</h2>
        <div className="home-quick-actions">
          {quickActions.map((action) => {
            if ('to' in action) {
              return (
                <Link key={action.key} to={action.to} className="home-quick-btn">
                  {action.label}
                </Link>
              )
            }
            return (
              <button
                key={action.key}
                type="button"
                className={`home-quick-btn${action.primary ? ' primary' : ''}`}
                onClick={action.onClick}
              >
                {action.label}
              </button>
            )
          })}
        </div>
      </section>

      <section className="home-stats-row">
        <article className="home-stat-card">
          <div className="home-stat-icon home-stat-icon-blue" aria-hidden />
          <div>
            <div className="home-stat-value">{dashboard.totalDocuments}</div>
            <div className="home-stat-label">{t('home.stat.total')}</div>
          </div>
        </article>
        <article className="home-stat-card">
          <div className="home-stat-icon home-stat-icon-indigo" aria-hidden />
          <div>
            <div className="home-stat-value">{shared.totalCount ?? shared.items?.length ?? 0}</div>
            <div className="home-stat-label">{t('home.stat.shared')}</div>
            {sharedOwnedCount > 0 && (
              <div className="home-stat-hint">{t('home.stat.sharedByYou', { count: String(sharedOwnedCount) })}</div>
            )}
          </div>
        </article>
        <article className="home-stat-card">
          <div className="home-stat-icon home-stat-icon-amber" aria-hidden />
          <div>
            <div className="home-stat-value">{archivedCount}</div>
            <div className="home-stat-label">{t('home.stat.archived')}</div>
          </div>
        </article>
        <article className="home-stat-card">
          <div className="home-stat-icon home-stat-icon-green" aria-hidden />
          <div>
            <div className="home-stat-value">{fmtSize(dashboard.storageUsedBytes)}</div>
            <div className="home-stat-label">{t('home.stat.storage')}</div>
            {dashboard.bytesSavedByDedup > 0 && (
              <div className="home-stat-hint">
                {fmtSize(dashboard.bytesSavedByDedup)} {t('stat.saved')}
              </div>
            )}
          </div>
        </article>
        <article className="home-stat-card">
          <div className="home-stat-icon home-stat-icon-violet" aria-hidden />
          <div>
            <div className="home-stat-value">{dashboard.recentDocuments?.length ?? 0}</div>
            <div className="home-stat-label">{t('home.stat.recent')}</div>
          </div>
        </article>
        {favoriteDocs.length > 0 && (
          <article className="home-stat-card">
            <div className="home-stat-icon home-stat-icon-rose" aria-hidden />
            <div>
              <div className="home-stat-value">{favoriteDocs.length}</div>
              <div className="home-stat-label">{t('home.stat.favorites')}</div>
            </div>
          </article>
        )}
      </section>

      <div className="home-grid home-grid-primary">
        <section className="home-panel">
          <div className="home-panel-header">
            <h2>{t('home.recentDocs')}</h2>
            <Link to="/documents" className="home-panel-link">{t('home.viewAllDocs')}</Link>
          </div>
          {!dashboard.recentDocuments?.length ? (
            <p className="home-panel-empty">{t('empty.documents')}</p>
          ) : (
            <>
              <div className="home-doc-table-wrap home-desktop-only">
                <table className="data-table home-doc-table">
                  <thead>
                    <tr>
                      <th />
                      <th>{t('table.file')}</th>
                      <th>{t('table.type')}</th>
                      <th>{t('table.category')}</th>
                      <th>{t('table.date')}</th>
                      <th>{t('table.owner')}</th>
                      <th>{t('table.version')}</th>
                      <th>{t('cat.filterVisibility')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.recentDocuments.map((d) => (
                      <tr key={d.id}>
                        <td><FileIcon contentType={d.contentType} fileName={d.fileName} /></td>
                        <td className="home-doc-name">{d.fileName}</td>
                        <td>{d.contentType?.split('/').pop() || '—'}</td>
                        <td>{d.category || '—'}</td>
                        <td>{fmtDate(d.updatedAt || d.createdAt, locale)}</td>
                        <td>{d.ownerName || '—'}</td>
                        <td>v{d.currentVersion}</td>
                        <td><VisibilityBadge visibility={d.visibility} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="home-doc-cards home-mobile-only">
                {dashboard.recentDocuments.map((d) => (
                  <article key={d.id} className="home-doc-card">
                    <FileIcon contentType={d.contentType} fileName={d.fileName} />
                    <div>
                      <h4>{d.fileName}</h4>
                      <p>{d.category} · v{d.currentVersion}</p>
                      <time>{fmtDate(d.updatedAt || d.createdAt, locale)}</time>
                    </div>
                    <VisibilityBadge visibility={d.visibility} />
                  </article>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="home-panel home-panel-storage">
          <div className="home-panel-header">
            <h2>{t('home.storage')}</h2>
          </div>
          <div className="home-storage-body">
            <div className="home-storage-value">{fmtSize(dashboard.storageUsedBytes)}</div>
            <p className="home-storage-label">{t('home.storageUsed')}</p>
            <div className="home-storage-bar-wrap">
              <div className="home-storage-bar">
                <div className="home-storage-bar-fill" style={{ width: `${storagePct}%` }} />
              </div>
            </div>
            <dl className="home-storage-dl">
              <div>
                <dt>{t('home.logicalStorage')}</dt>
                <dd>{fmtSize(dashboard.logicalStorageBytes)}</dd>
              </div>
              {dashboard.bytesSavedByDedup > 0 && (
                <div>
                  <dt>{t('stat.saved')}</dt>
                  <dd>{fmtSize(dashboard.bytesSavedByDedup)}</dd>
                </div>
              )}
            </dl>
            <p className="home-storage-hint">{t('home.storageHint')}</p>
          </div>
        </section>
      </div>

      <div className="home-grid">
        <section className="home-panel">
          <div className="home-panel-header">
            <h2>{t('home.sharedWithMe')}</h2>
            <Link to="/shared" className="home-panel-link">{t('home.viewShared')}</Link>
          </div>
          {!shared.items?.length ? (
            <p className="home-panel-empty">{t('home.noShared')}</p>
          ) : (
            <ul className="home-shared-list">
              {shared.items.map((d) => (
                <li key={d.id} className="home-shared-item">
                  <FileIcon contentType={d.contentType} fileName={d.fileName} />
                  <div className="home-shared-body">
                    <strong>{d.fileName}</strong>
                    <span>{t('home.sharedBy', { name: d.ownerName || '—' })}</span>
                    <span className="home-shared-perm">{accessLevelLabel(d.myAccessLevel, t)}</span>
                  </div>
                  <time>{fmtDate(d.updatedAt || d.createdAt, locale)}</time>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="home-panel">
          <div className="home-panel-header">
            <h2>{t('home.recentActivity')}</h2>
          </div>
          {!dashboard.recentActivity?.length ? (
            <p className="home-panel-empty">{t('empty.recentActivity')}</p>
          ) : (
            <ul className="home-activity-list">
              {dashboard.recentActivity.map((a, i) => (
                <li key={i} className="home-activity-item">
                  <ActivityIcon kind={activityIconKind(a.action)} />
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

      <div className="home-grid">
        <section className="home-panel">
          <div className="home-panel-header">
            <h2>{t('home.myCategories')}</h2>
            <Link to="/categories" className="home-panel-link">{t('nav.categories')}</Link>
          </div>
          {!categories.length ? (
            <p className="home-panel-empty">{t('home.noCategories')}</p>
          ) : (
            <div className="home-category-grid">
              {categories.map((cat) => {
                const meta = getCategoryMeta(cat.name)
                return (
                  <Link key={cat.name} to="/categories" className={`home-category-card cat-color-${meta.color}`}>
                    <CategoryIcon icon={meta.icon} size={22} />
                    <div>
                      <strong>{cat.name}</strong>
                      <span>{t('home.categoryCount', { count: String(cat.count) })}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {favoriteDocs.length > 0 && (
          <section className="home-panel">
            <div className="home-panel-header">
              <h2>{t('home.favorites')}</h2>
              <button type="button" className="home-panel-link" onClick={() => navigate('/favorites')}>
                {t('home.viewFavorites')}
              </button>
            </div>
            <ul className="home-fav-list">
              {favoriteDocs.map((d) => (
                <li key={d.id}>
                  <FileIcon contentType={d.contentType} fileName={d.fileName} />
                  <div>
                    <strong>{d.fileName}</strong>
                    <span>{d.category} · {fmtDate(d.updatedAt || d.createdAt, locale)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {dashboard.notifications?.length > 0 && (
        <section className="home-panel home-notifications">
          <div className="home-panel-header">
            <h2>{t('topbar.notifications')}</h2>
          </div>
          <ul className="home-notif-list">
            {dashboard.notifications.map((n, i) => (
              <li key={i}>
                <span className="home-notif-type">{n.type}</span>
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
