import { useCallback, useEffect, useState } from 'react'
import { api } from '@/api/client'
import { DashboardCharts } from '@/components/dashboard/DashboardCharts'
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton'
import { RecentDocsPanel } from '@/components/dashboard/RecentDocsPanel'
import { useI18n } from '@/i18n/I18nContext'
import { buildQuery, fmtSize } from '@/utils/format'
import type { AdminUser, DashboardStats, DocumentDto, PagedResult } from '@/types'

export function AdminDashboard() {
  const { t } = useI18n()
  const [data, setData] = useState<DashboardStats | null>(null)
  const [documents, setDocuments] = useState<DocumentDto[]>([])
  const [userCount, setUserCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [stats, users, docs] = await Promise.all([
        api<DashboardStats>('/api/dashboard'),
        api<AdminUser[]>('/api/admin/users'),
        api<PagedResult<DocumentDto>>(
          `/api/documents${buildQuery({ status: 'Active', page: 1, pageSize: 500 })}`
        ).catch(() => ({ items: [], totalCount: 0, page: 1, pageSize: 500 })),
      ])
      setData(stats)
      setUserCount(users?.length ?? 0)
      setDocuments(docs.items || [])
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

  const stats = [
    { key: 'docs', value: data.totalDocuments, label: t('stat.totalDocs'), tone: 'blue' },
    { key: 'storage', value: fmtSize(data.storageUsedBytes), label: t('stat.storage'), tone: 'cyan' },
    { key: 'users', value: userCount, label: t('adminDash.users'), tone: 'green' },
    { key: 'recent', value: data.recentDocuments?.length ?? 0, label: t('home.stat.recent'), tone: 'amber' },
  ]

  return (
    <div className="admin-dashboard" id="page-admin-dashboard">
      <div className="admin-dash-stats">
        {stats.map((stat) => (
          <article key={stat.key} className={`admin-dash-stat admin-dash-stat-${stat.tone}`}>
            <div className="admin-dash-stat-value">{stat.value}</div>
            <div className="admin-dash-stat-label">{stat.label}</div>
          </article>
        ))}
      </div>

      <DashboardCharts stats={data} documents={documents} />

      <RecentDocsPanel
        documents={data.recentDocuments || []}
        title={t('card.recentDocs')}
        showOwner
        className="admin-recent-docs"
      />
    </div>
  )
}
