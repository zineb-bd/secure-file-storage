import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, downloadBlob } from '@/api/client'
import { AuditDetailModal } from '@/components/audit/AuditDetailModal'
import { AuditSkeleton } from '@/components/audit/AuditSkeleton'
import {
  IconClock,
  IconFileStack,
  IconFilter,
  IconGrid,
  IconList,
  IconRestore,
  IconSearch,
  IconTrash,
  IconUsers,
} from '@/components/categories/CategoryIcons'
import { IconShield } from '@/components/profile/ProfileIcons'
import { useI18n } from '@/i18n/I18nContext'
import { buildQuery, fmtDate } from '@/utils/format'
import {
  AUDIT_ACTIONS,
  actionIconKind,
  actionLabel,
  isSecurityAction,
  matchesClientSearch,
  matchesResourceType,
  matchesStatusFilter,
  periodToRange,
  securityLevel,
  statusKind,
  todayStartIso,
  type AuditPeriod,
  type AuditStatusFilter,
  type AuditViewMode,
} from '@/utils/auditHelpers'
import type { AdminUser, AntivirusAlert, AuditLog, PagedResult } from '@/types'

const PAGE_SIZES = [10, 25, 50, 100] as const

interface ServerFilters {
  userId: string
  action: string
  from: string
  to: string
}

const EMPTY_SERVER: ServerFilters = { userId: '', action: '', from: '', to: '' }

function ActionIcon({ action }: { action: string }) {
  const kind = actionIconKind(action)
  const size = 16
  switch (kind) {
    case 'upload':
      return <IconList size={size} />
    case 'download':
      return <IconFileStack size={size} />
    case 'share':
      return <IconUsers size={size} />
    case 'archive':
    case 'restore':
      return <IconRestore size={size} />
    case 'delete':
      return <IconTrash size={size} />
    case 'security':
      return <IconShield size={size} />
    default:
      return <IconClock size={size} />
  }
}

interface AuditLogListProps {
  users: AdminUser[]
}

export function AuditLogList({ users }: AuditLogListProps) {
  const { t, locale } = useI18n()

  const [viewMode, setViewMode] = useState<AuditViewMode>('table')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(25)
  const [serverFilters, setServerFilters] = useState<ServerFilters>(EMPTY_SERVER)
  const [draftFilters, setDraftFilters] = useState<ServerFilters>(EMPTY_SERVER)
  const [period, setPeriod] = useState<AuditPeriod>('')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<AuditStatusFilter>('')
  const [resourceTypeFilter, setResourceTypeFilter] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [items, setItems] = useState<AuditLog[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [statsItems, setStatsItems] = useState<AuditLog[]>([])
  const [todayCount, setTodayCount] = useState(0)
  const [alerts, setAlerts] = useState<AntivirusAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exportBusy, setExportBusy] = useState(false)
  const [detail, setDetail] = useState<AuditLog | null>(null)
  const [toast, setToast] = useState('')

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 4200)
  }, [])

  const serverQuery = useMemo(
    () => ({
      userId: serverFilters.userId || undefined,
      action: serverFilters.action || undefined,
      from: serverFilters.from || undefined,
      to: serverFilters.to || undefined,
    }),
    [serverFilters]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const q = buildQuery({ ...serverQuery, page, pageSize })
      const statsQ = buildQuery({ ...serverQuery, page: 1, pageSize: 500 })
      const todayQ = buildQuery({ ...serverQuery, from: todayStartIso(), page: 1, pageSize: 1 })

      const [data, statsData, todayData, avAlerts] = await Promise.all([
        api<PagedResult<AuditLog>>(`/api/admin/audit${q}`),
        api<PagedResult<AuditLog>>(`/api/admin/audit${statsQ}`),
        api<PagedResult<AuditLog>>(`/api/admin/audit${todayQ}`),
        api<AntivirusAlert[]>('/api/admin/security/antivirus-alerts'),
      ])

      setItems(data.items || [])
      setTotalCount(data.totalCount ?? 0)
      setStatsItems(statsData.items || [])
      setTodayCount(todayData.totalCount ?? 0)
      setAlerts(avAlerts || [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('msg.loadProfileError')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, serverQuery, t])

  useEffect(() => {
    void load()
  }, [load])

  const displayed = useMemo(() => {
    return items.filter(
      (log) =>
        matchesClientSearch(log, search) &&
        matchesStatusFilter(log, statusFilter) &&
        matchesResourceType(log, resourceTypeFilter)
    )
  }, [items, search, statusFilter, resourceTypeFilter])

  const stats = useMemo(() => {
    const success = statsItems.filter((l) => l.success).length
    const failed = statsItems.filter((l) => !l.success && statusKind(l) === 'failed').length
    const denied = statsItems.filter((l) => statusKind(l) === 'denied').length
    const accessDenied = statsItems.filter((l) => statusKind(l) === 'denied').length
    return {
      total: totalCount,
      today: todayCount,
      success,
      failed,
      denied,
      accessDenied,
      securityAlerts: alerts.length + statsItems.filter(isSecurityAction).length,
    }
  }, [statsItems, totalCount, todayCount, alerts.length])

  const securityEvents = useMemo(() => {
    const fromLogs = statsItems
      .filter(isSecurityAction)
      .slice(0, 8)
      .map((log) => ({
        id: log.id,
        type: 'audit' as const,
        level: securityLevel(log),
        title: actionLabel(log.action, t),
        detail: log.details || log.userEmail || '',
        time: log.timestamp,
      }))
    const fromAv = alerts.slice(0, 4).map((a) => ({
      id: a.id,
      type: 'antivirus' as const,
      level: 'critical' as const,
      title: t('audit.antivirusDetection'),
      detail: `${a.fileName} — ${a.threatName}`,
      time: a.detectedAt,
    }))
    return [...fromAv, ...fromLogs].slice(0, 10)
  }, [statsItems, alerts, t])

  const hasClientFilters = search.trim() !== '' || statusFilter !== '' || resourceTypeFilter !== ''
  const hasServerFilters = Object.values(serverFilters).some((v) => v !== '')

  const applyPeriod = (p: AuditPeriod) => {
    setPeriod(p)
    if (p === '' || p === 'custom') return
    const range = periodToRange(p)
    setDraftFilters((f) => ({ ...f, from: range.from, to: range.to }))
    setServerFilters((f) => ({ ...f, from: range.from, to: range.to }))
    setPage(1)
  }

  const applyFilters = () => {
    let from = draftFilters.from
    let to = draftFilters.to
    if (period === 'custom') {
      if (customFrom) from = new Date(customFrom).toISOString()
      if (customTo) {
        const d = new Date(customTo)
        d.setHours(23, 59, 59, 999)
        to = d.toISOString()
      }
    }
    setServerFilters({ ...draftFilters, from, to })
    setPage(1)
    setFiltersOpen(false)
  }

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('')
    setResourceTypeFilter('')
    setPeriod('')
    setCustomFrom('')
    setCustomTo('')
    setDraftFilters(EMPTY_SERVER)
    setServerFilters(EMPTY_SERVER)
    setPage(1)
  }

  const exportLogs = async () => {
    setExportBusy(true)
    try {
      const q = buildQuery(serverQuery)
      await downloadBlob(`/api/admin/audit/export${q}`, `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`)
      showToast(t('audit.exported'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('audit.exportFailed'))
    } finally {
      setExportBusy(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  const renderStatus = (log: AuditLog) => {
    const s = statusKind(log)
    return <span className={`audit-badge audit-badge-${s}`}>{t(`audit.status.${s}`)}</span>
  }

  const renderTable = () => (
    <div className="audit-table-card">
      <div className="table-wrap audit-table-wrap">
        <table className="data-table audit-table">
          <thead>
            <tr>
              <th>{t('audit.colDate')}</th>
              <th>{t('audit.colUser')}</th>
              <th>{t('audit.colAction')}</th>
              <th>{t('audit.colResource')}</th>
              <th>{t('audit.colResourceType')}</th>
              <th>{t('audit.colIp')}</th>
              <th>{t('audit.colStatus')}</th>
              <th>{t('audit.colDetails')}</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((log) => (
              <tr key={log.id} className="audit-row-clickable" onClick={() => setDetail(log)}>
                <td>{fmtDate(log.timestamp, locale)}</td>
                <td>{log.userEmail || t('audit.anonymous')}</td>
                <td>
                  <span className="audit-action-cell">
                    <ActionIcon action={log.action} />
                    {actionLabel(log.action, t)}
                  </span>
                </td>
                <td className="audit-resource-cell">{log.details || '—'}</td>
                <td>{log.resourceType}</td>
                <td>{log.ipAddress || '—'}</td>
                <td>{renderStatus(log)}</td>
                <td className="audit-details-cell">{log.details || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderTimeline = () => (
    <div className="audit-timeline">
      {displayed.map((log) => (
        <article key={log.id} className="audit-timeline-item" onClick={() => setDetail(log)}>
          <div className="audit-timeline-time">
            {new Date(log.timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="audit-timeline-marker">
            <ActionIcon action={log.action} />
          </div>
          <div className="audit-timeline-body">
            <p className="audit-timeline-text">
              <strong>{log.userEmail || t('audit.anonymous')}</strong>{' '}
              {actionLabel(log.action, t).toLowerCase()}
              {log.details ? ` « ${log.details} »` : ''}
            </p>
            <div className="audit-timeline-meta">
              {renderStatus(log)}
              <span>{fmtDate(log.timestamp, locale)}</span>
            </div>
          </div>
        </article>
      ))}
    </div>
  )

  const renderCards = () => (
    <div className="audit-card-grid">
      {displayed.map((log) => (
        <article key={log.id} className="audit-activity-card" onClick={() => setDetail(log)}>
          <div className="audit-activity-top">
            <ActionIcon action={log.action} />
            <div>
              <h4>{actionLabel(log.action, t)}</h4>
              <p>{log.userEmail || t('audit.anonymous')}</p>
            </div>
            {renderStatus(log)}
          </div>
          <p className="audit-activity-resource">{log.details || '—'}</p>
          <div className="audit-activity-meta">
            <span>{fmtDate(log.timestamp, locale)}</span>
            <span>{log.ipAddress || '—'}</span>
          </div>
        </article>
      ))}
    </div>
  )

  const emptyState = () => (
    <div className="audit-empty">
      <div className="audit-empty-icon"><IconSearch size={48} /></div>
      <h3>{t('audit.emptyTitle')}</h3>
      <p>{t('audit.emptyDesc')}</p>
      <button type="button" className="btn btn-outline" onClick={clearFilters}>
        {t('cat.clearFilters')}
      </button>
    </div>
  )

  return (
    <div className="audit-docs-view">
      {toast && <div className="profile-toast profile-toast-success" role="status">{toast}</div>}
      {error && <div className="msg error">{error}</div>}

      {loading ? (
        <AuditSkeleton />
      ) : (
        <>
      <div className="audit-toolbar">
        <div className="audit-search-wrap">
          <IconSearch size={18} className="audit-search-icon" />
          <input
            type="search"
            className="audit-search-input"
            placeholder={t('audit.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="audit-toolbar-actions">
          <button type="button" className="btn btn-sm btn-outline audit-btn-icon" onClick={() => void load()}>
            <IconRestore size={15} />
            {t('audit.refresh')}
          </button>
          <button
            type="button"
            className={`btn btn-sm btn-outline audit-filter-toggle${filtersOpen ? ' active' : ''}`}
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <IconFilter size={16} />
            {t('filter.advanced')}
          </button>
          {(hasClientFilters || hasServerFilters) && (
            <button type="button" className="btn btn-sm btn-outline" onClick={clearFilters}>
              {t('cat.clearFilters')}
            </button>
          )}
          <button type="button" className="btn btn-sm btn-outline audit-btn-icon" onClick={() => void exportLogs()} disabled={exportBusy}>
            <IconFileStack size={15} />
            {exportBusy ? t('profile.saving') : t('audit.exportLogs')}
          </button>
          <div className="cat-view-toggle" role="group" aria-label={t('audit.viewMode')}>
            <button type="button" className={`cat-view-btn${viewMode === 'table' ? ' active' : ''}`} onClick={() => setViewMode('table')}>
              <IconList size={16} />
            </button>
            <button type="button" className={`cat-view-btn${viewMode === 'timeline' ? ' active' : ''}`} onClick={() => setViewMode('timeline')}>
              <IconGrid size={16} />
            </button>
          </div>
        </div>
      </div>

      {filtersOpen && (
        <div className="audit-filters-panel">
          <div className="audit-period-row">
            {(['', 'today', 'yesterday', 'last7', 'last30', 'custom'] as AuditPeriod[]).map((p) => (
              <button
                key={p || 'all'}
                type="button"
                className={`btn btn-sm${period === p ? ' btn-primary' : ' btn-outline'}`}
                onClick={() => applyPeriod(p)}
              >
                {p === '' ? t('filter.all') : t(`audit.period.${p}`)}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="audit-filters-grid audit-filters-grid-custom">
              <div className="audit-filter-field">
                <label htmlFor="audit-from">{t('users.filterFrom')}</label>
                <input id="audit-from" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </div>
              <div className="audit-filter-field">
                <label htmlFor="audit-to">{t('users.filterTo')}</label>
                <input id="audit-to" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            </div>
          )}
          <div className="audit-filters-grid">
            <div className="audit-filter-field">
              <label htmlFor="audit-user">{t('audit.colUser')}</label>
              <select id="audit-user" value={draftFilters.userId} onChange={(e) => setDraftFilters((f) => ({ ...f, userId: e.target.value }))}>
                <option value="">{t('filter.all')}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>
                ))}
              </select>
            </div>
            <div className="audit-filter-field">
              <label htmlFor="audit-action">{t('audit.colAction')}</label>
              <select id="audit-action" value={draftFilters.action} onChange={(e) => setDraftFilters((f) => ({ ...f, action: e.target.value }))}>
                <option value="">{t('filter.all')}</option>
                {AUDIT_ACTIONS.map((a) => (
                  <option key={a} value={a}>{actionLabel(a, t)}</option>
                ))}
              </select>
            </div>
            <div className="audit-filter-field">
              <label htmlFor="audit-status">{t('audit.colStatus')}</label>
              <select id="audit-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as AuditStatusFilter)}>
                <option value="">{t('filter.all')}</option>
                <option value="success">{t('audit.status.success')}</option>
                <option value="failed">{t('audit.status.failed')}</option>
                <option value="denied">{t('audit.status.denied')}</option>
              </select>
            </div>
            <div className="audit-filter-field">
              <label htmlFor="audit-rtype">{t('audit.colResourceType')}</label>
              <select id="audit-rtype" value={resourceTypeFilter} onChange={(e) => setResourceTypeFilter(e.target.value)}>
                <option value="">{t('filter.all')}</option>
                <option value="Document">{t('audit.resourceDocument')}</option>
              </select>
            </div>
          </div>
          <div className="audit-filters-footer">
            <button type="button" className="btn btn-primary btn-sm" onClick={applyFilters}>{t('audit.applyFilters')}</button>
          </div>
        </div>
      )}

      <div className="audit-stats-row">
        <div className="audit-stat-card">
          <div className="audit-stat-icon audit-stat-icon-blue"><IconList size={20} /></div>
          <div>
            <div className="audit-stat-value">{stats.total}</div>
            <div className="audit-stat-label">{t('audit.statTotal')}</div>
          </div>
        </div>
        <div className="audit-stat-card">
          <div className="audit-stat-icon audit-stat-icon-green"><IconClock size={20} /></div>
          <div>
            <div className="audit-stat-value">{stats.today}</div>
            <div className="audit-stat-label">{t('audit.statToday')}</div>
          </div>
        </div>
        <div className="audit-stat-card">
          <div className="audit-stat-icon audit-stat-icon-indigo"><IconRestore size={20} /></div>
          <div>
            <div className="audit-stat-value">{stats.success}</div>
            <div className="audit-stat-label">{t('audit.statSuccess')}</div>
          </div>
        </div>
        <div className="audit-stat-card">
          <div className="audit-stat-icon audit-stat-icon-slate"><IconTrash size={20} /></div>
          <div>
            <div className="audit-stat-value">{stats.failed}</div>
            <div className="audit-stat-label">{t('audit.statFailed')}</div>
          </div>
        </div>
      </div>

      {(stats.denied > 0 || stats.securityAlerts > 0) && (
        <div className="audit-stats-row audit-stats-row-secondary">
          <div className="audit-stat-card">
            <div className="audit-stat-icon audit-stat-icon-amber"><IconShield size={20} /></div>
            <div>
              <div className="audit-stat-value">{stats.accessDenied}</div>
              <div className="audit-stat-label">{t('audit.statDenied')}</div>
            </div>
          </div>
          <div className="audit-stat-card">
            <div className="audit-stat-icon audit-stat-icon-amber"><IconShield size={20} /></div>
            <div>
              <div className="audit-stat-value">{stats.securityAlerts}</div>
              <div className="audit-stat-label">{t('audit.statSecurity')}</div>
            </div>
          </div>
        </div>
      )}

      {securityEvents.length > 0 && (
        <section className="audit-security-section">
          <h3 className="audit-section-title">{t('audit.securityTitle')}</h3>
          <div className="audit-security-list">
            {securityEvents.map((ev) => (
              <div key={ev.id} className={`audit-security-item level-${ev.level}`}>
                <span className={`audit-severity audit-severity-${ev.level}`}>{t(`audit.level.${ev.level}`)}</span>
                <div>
                  <strong>{ev.title}</strong>
                  <p>{ev.detail}</p>
                </div>
                <time>{fmtDate(ev.time, locale)}</time>
              </div>
            ))}
          </div>
        </section>
      )}

      {!displayed.length ? (
        emptyState()
      ) : (
        <>
          <div className="audit-desktop-view">
            {viewMode === 'table' ? renderTable() : renderTimeline()}
          </div>
          <div className="audit-mobile-view">{renderCards()}</div>
        </>
      )}

      {totalCount > 0 && (
        <div className="audit-pagination">
          <div className="audit-pagination-info">
            {t('audit.paginationInfo', {
              from: String((page - 1) * pageSize + 1),
              to: String(Math.min(page * pageSize, totalCount)),
              total: String(totalCount),
            })}
          </div>
          <div className="audit-pagination-controls">
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}>
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>{s} / {t('audit.page')}</option>
              ))}
            </select>
            <button type="button" className="btn btn-sm btn-outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t('audit.prevPage')}
            </button>
            <span className="audit-page-indicator">{page} / {totalPages}</span>
            <button type="button" className="btn btn-sm btn-outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              {t('audit.nextPage')}
            </button>
          </div>
        </div>
      )}

      {detail && <AuditDetailModal log={detail} onClose={() => setDetail(null)} />}
        </>
      )}
    </div>
  )
}
