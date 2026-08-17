import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { DashboardCharts } from '@/components/dashboard/DashboardCharts'
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton'
import { RecentDocsPanel } from '@/components/dashboard/RecentDocsPanel'
import { CategoryIcon } from '@/components/categories/CategoryIcons'
import { FileIcon } from '@/components/documents/FileIcon'
import { IconUpload } from '@/components/ui/TopbarIcons'
import { useI18n } from '@/i18n/I18nContext'
import { buildQuery, fmtDate, fmtSize } from '@/utils/format'
import { getCategoryMeta } from '@/utils/categoryStorage'
import {
  accessLevelLabel,
  countSharedOwned,
  groupByCategory,
  storageMeterPercent,
} from '@/utils/dashboardHelpers'
import type { DashboardStats, DocumentDto, PagedResult } from '@/types'

interface HomeData {
  dashboard: DashboardStats
  shared: PagedResult<DocumentDto>
  archivedCount: number
  ownedDocs: DocumentDto[]
  favoriteDocs: DocumentDto[]
}

export function HomeDashboard() {
  const { t, locale } = useI18n()
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
  const sharedCount = shared.totalCount ?? shared.items?.length ?? 0

  const stats = [
    {
      key: 'total',
      value: dashboard.totalDocuments,
      label: t('home.stat.total'),
      icon: 'blue',
    },
    {
      key: 'shared',
      value: sharedCount,
      label: t('home.stat.shared'),
      icon: 'indigo',
      hint: sharedOwnedCount > 0 ? t('home.stat.sharedByYou', { count: String(sharedOwnedCount) }) : undefined,
    },
    {
      key: 'archived',
      value: archivedCount,
      label: t('home.stat.archived'),
      icon: 'amber',
    },
    {
      key: 'storage',
      value: fmtSize(dashboard.storageUsedBytes),
      label: t('home.stat.storage'),
      icon: 'green',
      hint: dashboard.bytesSavedByDedup > 0
        ? `${fmtSize(dashboard.bytesSavedByDedup)} ${t('stat.saved')}`
        : undefined,
    },
    {
      key: 'recent',
      value: dashboard.recentDocuments?.length ?? 0,
      label: t('home.stat.recent'),
      icon: 'violet',
    },
    ...(favoriteDocs.length > 0
      ? [{
          key: 'favorites',
          value: favoriteDocs.length,
          label: t('home.stat.favorites'),
          icon: 'rose',
        }]
      : []),
  ]

  if (isEmpty) {
    return (
      <div className="home-dashboard" id="page-dashboard">
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
      <section className="home-stats-row">
        {stats.map((stat) => (
          <article key={stat.key} className="home-stat-card">
            <div className={`home-stat-icon home-stat-icon-${stat.icon}`} aria-hidden />
            <div>
              <div className="home-stat-value">{stat.value}</div>
              <div className="home-stat-label">{stat.label}</div>
              {stat.hint && <div className="home-stat-hint">{stat.hint}</div>}
            </div>
          </article>
        ))}
      </section>

      <DashboardCharts
        stats={dashboard}
        documents={data.ownedDocs.filter((d) => d.isOwner !== false)}
      />

      <div className="home-grid home-grid-primary">
        <RecentDocsPanel documents={dashboard.recentDocuments || []} />

        <section className="home-panel home-panel-storage">
          <div className="home-panel-header">
            <h2>{t('home.storage')}</h2>
          </div>
          <div className="home-storage-body">
            <div className="home-storage-ring" style={{ ['--storage-pct' as string]: `${storagePct}%` }}>
              <div className="home-storage-ring-inner">
                <div className="home-storage-value">{fmtSize(dashboard.storageUsedBytes)}</div>
                <p className="home-storage-label">{t('home.storageUsed')}</p>
              </div>
            </div>
            <div className="home-storage-bar-wrap">
              <div className="home-storage-bar">
                <div className="home-storage-bar-fill" style={{ width: `${storagePct}%` }} />
              </div>
              <span className="home-storage-pct">{storagePct}%</span>
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

      <div className="home-grid home-grid-secondary">
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
      </div>

      {favoriteDocs.length > 0 && (
        <section className="home-panel">
          <div className="home-panel-header">
            <h2>{t('home.favorites')}</h2>
            <button type="button" className="home-panel-link" onClick={() => navigate('/favorites')}>
              {t('home.viewFavorites')}
            </button>
          </div>
          <ul className="home-fav-list home-fav-list-grid">
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
