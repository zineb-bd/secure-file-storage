import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { api, downloadBlob } from '@/api/client'
import { DocumentAuditDetailModal } from '@/components/audit/DocumentAuditDetailModal'
import { AuditSkeleton } from '@/components/audit/AuditSkeleton'
import {
  IconClock,
  IconFileStack,
  IconFilter,
  IconList,
  IconRestore,
  IconSearch,
  IconTrash,
  IconUsers,
} from '@/components/categories/CategoryIcons'
import { IconShield } from '@/components/profile/ProfileIcons'
import { useI18n } from '@/i18n/I18nContext'
import { buildQuery, fmtDate, fmtSize } from '@/utils/format'
import {
  periodToRange,
  statusKind,
  type AuditPeriod,
  type AuditStatusFilter,
} from '@/utils/auditHelpers'
import {
  actionIconKind,
  computeDocumentStats,
  displayActionLabel,
  integrityFromLogs,
  isDocumentActivity,
  matchesActionFilter,
  matchesCategoryFilter,
  matchesDocumentSearch,
  matchesStatusFilter,
  parseCategory,
  parseDocumentName,
  parseVersion,
  serverActionForFilter,
  timelineLabel,
  type DocumentMeta,
} from '@/utils/documentAuditHelpers'
import type { AdminUser, AuditLog, DocumentDetail, DocumentVersion, PagedResult } from '@/types'

/** Charge un pool unique — liste scrollable, sans pagination UI. */
const FETCH_SIZE = 2000

interface AppliedFilters {
  userId: string
  /** Filtre UI (peut être Edit / VersionCreated / Trash / PermDelete). */
  actionFilter: string
  resourceId: string
  from: string
  to: string
}

const EMPTY_FILTERS: AppliedFilters = {
  userId: '',
  actionFilter: '',
  resourceId: '',
  from: '',
  to: '',
}

const FILTER_ACTIONS = [
  { value: 'Upload', labelKey: 'docAudit.filter.upload' },
  { value: 'View', labelKey: 'docAudit.filter.view' },
  { value: 'Preview', labelKey: 'docAudit.filter.preview' },
  { value: 'Download', labelKey: 'docAudit.filter.download' },
  { value: 'Edit', labelKey: 'docAudit.filter.edit' },
  { value: 'VersionCreated', labelKey: 'docAudit.filter.versionCreated' },
  { value: 'Share', labelKey: 'docAudit.filter.share' },
  { value: 'Archive', labelKey: 'docAudit.filter.archive' },
  { value: 'Restore', labelKey: 'docAudit.filter.restore' },
  { value: 'Trash', labelKey: 'docAudit.filter.trash' },
  { value: 'PermDelete', labelKey: 'docAudit.filter.delete' },
] as const

function ActionIcon({ log }: { log: AuditLog }) {
  const kind = actionIconKind(log.action, log)
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
    case 'trash':
      return <IconTrash size={size} />
    case 'integrity':
      return <IconShield size={size} />
    case 'version':
      return <IconClock size={size} />
    default:
      return <IconClock size={size} />
  }
}

interface DocumentAuditListProps {
  users: AdminUser[]
}

export function DocumentAuditList({ users }: DocumentAuditListProps) {
  const { t, locale } = useI18n()

  const [applied, setApplied] = useState<AppliedFilters>(EMPTY_FILTERS)
  const [draft, setDraft] = useState<AppliedFilters>(EMPTY_FILTERS)
  const [period, setPeriod] = useState<AuditPeriod>('')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<AuditStatusFilter>('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [items, setItems] = useState<AuditLog[]>([])
  const [docMeta, setDocMeta] = useState<Record<string, DocumentMeta>>({})
  const docMetaRef = useRef<Record<string, DocumentMeta>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exportBusy, setExportBusy] = useState(false)
  const [detail, setDetail] = useState<AuditLog | null>(null)
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [selectedDocHistory, setSelectedDocHistory] = useState<AuditLog[]>([])
  const [selectedDocVersions, setSelectedDocVersions] = useState<DocumentVersion[]>([])
  const [selectedDocDetail, setSelectedDocDetail] = useState<DocumentDetail | null>(null)
  const [docPanelLoading, setDocPanelLoading] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 4200)
  }, [])

  const serverQuery = useMemo(() => {
    const action = applied.actionFilter
      ? serverActionForFilter(applied.actionFilter)
      : undefined
    return {
      userId: applied.userId || undefined,
      action: action || undefined,
      resourceId: applied.resourceId || undefined,
      from: applied.from || undefined,
      to: applied.to || undefined,
    }
  }, [applied])

  useEffect(() => {
    docMetaRef.current = docMeta
  }, [docMeta])

  const loadDocMeta = useCallback(async (logs: AuditLog[]) => {
    const ids = [...new Set(logs.map((l) => l.resourceId).filter(Boolean))] as string[]
    const missing = ids.filter((id) => !docMetaRef.current[id])
    if (!missing.length) return

    const results = await Promise.all(
      missing.map(async (id) => {
        try {
          const d = await api<DocumentDetail>(`/api/documents/${id}/detail`)
          return {
            id,
            meta: {
              id: d.id,
              fileName: d.fileName,
              category: d.category,
              contentType: d.contentType,
              currentVersion: d.currentVersion,
              sha256Hash: d.sha256Hash,
            } satisfies DocumentMeta,
          }
        } catch {
          return null
        }
      })
    )

    const next: Record<string, DocumentMeta> = {}
    for (const r of results) {
      if (r) next[r.id] = r.meta
    }
    if (Object.keys(next).length) {
      setDocMeta((prev) => ({ ...prev, ...next }))
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const q = buildQuery({ ...serverQuery, page: 1, pageSize: FETCH_SIZE })
        const data = await api<PagedResult<AuditLog>>(`/api/admin/audit${q}`)
        if (cancelled) return
        const list = (data.items || []).filter(isDocumentActivity)
        setItems(list)
        void loadDocMeta(list)
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : t('msg.loadProfileError')
        setError(msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [serverQuery, t, loadDocMeta])

  const loadDocumentPanel = useCallback(async (docId: string) => {
    setDocPanelLoading(true)
    try {
      const [docDetail, versions, audit] = await Promise.all([
        api<DocumentDetail>(`/api/documents/${docId}/detail`).catch(() => null),
        api<DocumentVersion[]>(`/api/documents/${docId}/versions`).catch(() => []),
        api<PagedResult<AuditLog>>(`/api/admin/audit?resourceId=${docId}&page=1&pageSize=100`),
      ])
      setSelectedDocDetail(docDetail)
      setSelectedDocVersions(versions || [])
      setSelectedDocHistory((audit.items || []).filter(isDocumentActivity))
      if (docDetail) {
        setDocMeta((prev) => ({
          ...prev,
          [docId]: {
            id: docDetail.id,
            fileName: docDetail.fileName,
            category: docDetail.category,
            contentType: docDetail.contentType,
            currentVersion: docDetail.currentVersion,
            sha256Hash: docDetail.sha256Hash,
          },
        }))
      }
    } finally {
      setDocPanelLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedDocId) {
      setSelectedDocDetail(null)
      setSelectedDocVersions([])
      setSelectedDocHistory([])
      return
    }
    void loadDocumentPanel(selectedDocId)
  }, [selectedDocId, loadDocumentPanel])

  const displayed = useMemo(
    () =>
      items.filter((log) => {
        const meta = log.resourceId ? docMeta[log.resourceId] : null
        return (
          matchesDocumentSearch(log, search, meta) &&
          matchesStatusFilter(log, statusFilter) &&
          matchesCategoryFilter(log, categoryFilter, meta) &&
          matchesActionFilter(log, applied.actionFilter)
        )
      }),
    [items, search, statusFilter, categoryFilter, applied.actionFilter, docMeta]
  )

  const stats = useMemo(() => computeDocumentStats(displayed), [displayed])

  const documentOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const log of items) {
      if (!log.resourceId) continue
      if (!map.has(log.resourceId)) {
        map.set(log.resourceId, parseDocumentName(log, docMeta[log.resourceId]))
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [items, docMeta])

  const categoryOptions = useMemo(() => {
    const set = new Set<string>()
    for (const log of items) {
      const cat = parseCategory(log, log.resourceId ? docMeta[log.resourceId] : null)
      if (cat && cat !== '—') set.add(cat)
    }
    return [...set].sort()
  }, [items, docMeta])

  const hasAppliedFilters = Object.values(applied).some((v) => v !== '')
  const hasAnyFilters =
    hasAppliedFilters || search.trim() !== '' || statusFilter !== '' || categoryFilter !== ''

  const resolvePeriodDates = (p: AuditPeriod, draftState: AppliedFilters) => {
    if (p === '' || p === 'custom') {
      if (p === '') return { from: '', to: '' }
      let from = draftState.from
      let to = draftState.to
      if (customFrom) from = new Date(customFrom).toISOString()
      if (customTo) {
        const d = new Date(customTo)
        d.setHours(23, 59, 59, 999)
        to = d.toISOString()
      }
      return { from, to }
    }
    return periodToRange(p)
  }

  const applyPeriod = (p: AuditPeriod) => {
    setPeriod(p)
    if (p === 'custom') return

    if (p === '') {
      setCustomFrom('')
      setCustomTo('')
      setDraft((f) => ({ ...f, from: '', to: '' }))
      setApplied((f) => ({ ...f, from: '', to: '' }))
      return
    }

    const range = periodToRange(p)
    setDraft((f) => ({ ...f, from: range.from, to: range.to }))
    setApplied((f) => ({ ...f, from: range.from, to: range.to }))
  }

  const applyFilters = () => {
    const { from, to } = resolvePeriodDates(period, draft)
    setApplied({ ...draft, from, to })
    setFiltersOpen(false)
  }

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('')
    setCategoryFilter('')
    setPeriod('')
    setCustomFrom('')
    setCustomTo('')
    setDraft(EMPTY_FILTERS)
    setApplied(EMPTY_FILTERS)
    setSelectedDocId(null)
  }

  const exportLogs = async () => {
    setExportBusy(true)
    try {
      const q = buildQuery(serverQuery)
      await downloadBlob(
        `/api/admin/audit/export${q}`,
        `document-audit-${new Date().toISOString().slice(0, 10)}.csv`
      )
      showToast(t('audit.exported'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('audit.exportFailed'))
    } finally {
      setExportBusy(false)
    }
  }

  const selectDocument = (resourceId: string | null | undefined, e?: MouseEvent) => {
    e?.stopPropagation()
    if (!resourceId) return
    setSelectedDocId(resourceId)
  }

  const renderStatus = (log: AuditLog) => {
    const s = statusKind(log)
    return <span className={`audit-badge audit-badge-${s}`}>{t(`audit.status.${s}`)}</span>
  }

  const renderActionBadge = (log: AuditLog) => (
    <span className={`doc-audit-action-badge doc-audit-action-${actionIconKind(log.action, log)}`}>
      <ActionIcon log={log} />
      {displayActionLabel(log, t)}
    </span>
  )

  const renderTable = () => (
    <div className="audit-table-card">
      <div className="table-wrap audit-table-wrap">
        <table className="data-table audit-table doc-audit-table">
          <thead>
            <tr>
              <th>{t('audit.colDate')}</th>
              <th>{t('audit.colUser')}</th>
              <th>{t('docAudit.colDocument')}</th>
              <th>{t('audit.colAction')}</th>
              <th>{t('docAudit.colCategory')}</th>
              <th>{t('docAudit.colVersion')}</th>
              <th>{t('audit.colStatus')}</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((log) => {
              const meta = log.resourceId ? docMeta[log.resourceId] : null
              return (
                <tr
                  key={log.id}
                  className={`audit-row-clickable${selectedDocId === log.resourceId ? ' doc-audit-row-selected' : ''}`}
                  onClick={() => setDetail(log)}
                >
                  <td>{fmtDate(log.timestamp, locale)}</td>
                  <td>{log.userEmail || t('audit.anonymous')}</td>
                  <td className="audit-resource-cell">
                    {log.resourceId ? (
                      <button
                        type="button"
                        className="doc-audit-doc-link"
                        onClick={(e) => selectDocument(log.resourceId, e)}
                      >
                        {parseDocumentName(log, meta)}
                      </button>
                    ) : (
                      parseDocumentName(log, meta)
                    )}
                  </td>
                  <td>{renderActionBadge(log)}</td>
                  <td>{parseCategory(log, meta)}</td>
                  <td>{parseVersion(log, meta)}</td>
                  <td>{renderStatus(log)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderCards = () => (
    <div className="audit-card-grid">
      {displayed.map((log) => {
        const meta = log.resourceId ? docMeta[log.resourceId] : null
        return (
          <article key={log.id} className="audit-activity-card" onClick={() => setDetail(log)}>
            <div className="audit-activity-top">
              <ActionIcon log={log} />
              <div>
                <h4>{displayActionLabel(log, t)}</h4>
                <p>{log.userEmail || t('audit.anonymous')}</p>
              </div>
              {renderStatus(log)}
            </div>
            <p className="audit-activity-resource">
              {log.resourceId ? (
                <button
                  type="button"
                  className="doc-audit-doc-link"
                  onClick={(e) => selectDocument(log.resourceId, e)}
                >
                  {parseDocumentName(log, meta)}
                </button>
              ) : (
                parseDocumentName(log, meta)
              )}
            </p>
            <div className="audit-activity-meta">
              <span>{parseCategory(log, meta)}</span>
              <span>{parseVersion(log, meta)}</span>
              <span>{fmtDate(log.timestamp, locale)}</span>
            </div>
          </article>
        )
      })}
    </div>
  )

  const selectedDocName = selectedDocId
    ? selectedDocDetail?.fileName || docMeta[selectedDocId]?.fileName || `${selectedDocId.slice(0, 8)}…`
    : ''

  const panelIntegrity = integrityFromLogs(selectedDocHistory)

  const emptyState = () => (
    <div className="audit-empty">
      <div className="audit-empty-icon">
        <IconSearch size={48} />
      </div>
      <h3>{t('docAudit.emptyTitle')}</h3>
      <p>{t('docAudit.emptyDesc')}</p>
      {hasAnyFilters && (
        <button type="button" className="btn btn-outline" onClick={clearFilters}>
          {t('docAudit.clearFilters')}
        </button>
      )}
    </div>
  )

  return (
    <div className="audit-docs-view doc-audit-view">
      {toast && (
        <div className="profile-toast profile-toast-success" role="status">
          {toast}
        </div>
      )}
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
                placeholder={t('docAudit.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="audit-toolbar-actions">
              <button
                type="button"
                className={`btn btn-sm btn-outline audit-filter-toggle${filtersOpen ? ' active' : ''}`}
                onClick={() => {
                  if (!filtersOpen) setDraft(applied)
                  setFiltersOpen((o) => !o)
                }}
              >
                <IconFilter size={16} />
                {t('filter.advanced')}
              </button>
              {hasAnyFilters && (
                <button type="button" className="btn btn-sm btn-outline" onClick={clearFilters}>
                  {t('docAudit.clearFilters')}
                </button>
              )}
              <button
                type="button"
                className="btn btn-sm btn-outline audit-btn-icon"
                onClick={() => void exportLogs()}
                disabled={exportBusy}
              >
                <IconFileStack size={15} />
                {exportBusy ? t('profile.saving') : t('docAudit.export')}
              </button>
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
                    <label htmlFor="doc-audit-from">{t('users.filterFrom')}</label>
                    <input
                      id="doc-audit-from"
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                    />
                  </div>
                  <div className="audit-filter-field">
                    <label htmlFor="doc-audit-to">{t('users.filterTo')}</label>
                    <input
                      id="doc-audit-to"
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                    />
                  </div>
                </div>
              )}
              <div className="audit-filters-grid">
                <div className="audit-filter-field">
                  <label htmlFor="doc-audit-document">{t('docAudit.colDocument')}</label>
                  <select
                    id="doc-audit-document"
                    value={draft.resourceId}
                    onChange={(e) => setDraft((f) => ({ ...f, resourceId: e.target.value }))}
                  >
                    <option value="">{t('filter.all')}</option>
                    {documentOptions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="audit-filter-field">
                  <label htmlFor="doc-audit-user">{t('audit.colUser')}</label>
                  <select
                    id="doc-audit-user"
                    value={draft.userId}
                    onChange={(e) => setDraft((f) => ({ ...f, userId: e.target.value }))}
                  >
                    <option value="">{t('filter.all')}</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="audit-filter-field">
                  <label htmlFor="doc-audit-action">{t('audit.colAction')}</label>
                  <select
                    id="doc-audit-action"
                    value={draft.actionFilter}
                    onChange={(e) => setDraft((f) => ({ ...f, actionFilter: e.target.value }))}
                  >
                    <option value="">{t('filter.all')}</option>
                    {FILTER_ACTIONS.map((a) => (
                      <option key={a.value} value={a.value}>
                        {t(a.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="audit-filter-field">
                  <label htmlFor="doc-audit-category">{t('docAudit.colCategory')}</label>
                  <select
                    id="doc-audit-category"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value="">{t('filter.all')}</option>
                    {categoryOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="audit-filter-field">
                  <label htmlFor="doc-audit-status">{t('audit.colStatus')}</label>
                  <select
                    id="doc-audit-status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as AuditStatusFilter)}
                  >
                    <option value="">{t('filter.all')}</option>
                    <option value="success">{t('audit.status.success')}</option>
                    <option value="failed">{t('audit.status.failed')}</option>
                    <option value="denied">{t('audit.status.denied')}</option>
                  </select>
                </div>
              </div>
              <div className="audit-filters-footer">
                <button type="button" className="btn btn-primary btn-sm" onClick={applyFilters}>
                  {t('audit.applyFilters')}
                </button>
              </div>
            </div>
          )}

          <div className="audit-stats-row doc-audit-stats-row">
            <div className="audit-stat-card">
              <div className="audit-stat-icon audit-stat-icon-blue">
                <IconList size={18} />
              </div>
              <div>
                <div className="audit-stat-value">{stats.total}</div>
                <div className="audit-stat-label">{t('docAudit.statTotal')}</div>
              </div>
            </div>
            <div className="audit-stat-card">
              <div className="audit-stat-icon audit-stat-icon-green">
                <IconList size={18} />
              </div>
              <div>
                <div className="audit-stat-value">{stats.uploaded}</div>
                <div className="audit-stat-label">{t('docAudit.statUploaded')}</div>
              </div>
            </div>
            <div className="audit-stat-card">
              <div className="audit-stat-icon audit-stat-icon-indigo">
                <IconFileStack size={18} />
              </div>
              <div>
                <div className="audit-stat-value">{stats.downloaded}</div>
                <div className="audit-stat-label">{t('docAudit.statDownloaded')}</div>
              </div>
            </div>
            <div className="audit-stat-card">
              <div className="audit-stat-icon audit-stat-icon-slate">
                <IconClock size={18} />
              </div>
              <div>
                <div className="audit-stat-value">{stats.modified}</div>
                <div className="audit-stat-label">{t('docAudit.statModified')}</div>
              </div>
            </div>
            <div className="audit-stat-card">
              <div className="audit-stat-icon audit-stat-icon-blue">
                <IconUsers size={18} />
              </div>
              <div>
                <div className="audit-stat-value">{stats.shared}</div>
                <div className="audit-stat-label">{t('docAudit.statShared')}</div>
              </div>
            </div>
            <div className="audit-stat-card">
              <div className="audit-stat-icon audit-stat-icon-amber">
                <IconRestore size={18} />
              </div>
              <div>
                <div className="audit-stat-value">{stats.archived}</div>
                <div className="audit-stat-label">{t('docAudit.statArchived')}</div>
              </div>
            </div>
            <div className="audit-stat-card">
              <div className="audit-stat-icon audit-stat-icon-green">
                <IconRestore size={18} />
              </div>
              <div>
                <div className="audit-stat-value">{stats.restored}</div>
                <div className="audit-stat-label">{t('docAudit.statRestored')}</div>
              </div>
            </div>
            <div className="audit-stat-card">
              <div className="audit-stat-icon audit-stat-icon-slate">
                <IconTrash size={18} />
              </div>
              <div>
                <div className="audit-stat-value">{stats.deleted}</div>
                <div className="audit-stat-label">{t('docAudit.statDeleted')}</div>
              </div>
            </div>
          </div>

          {selectedDocId && (
            <section className="doc-audit-panel">
              <div className="doc-audit-panel-header">
                <div>
                  <h3>{t('docAudit.documentHistory')}</h3>
                  <p>{selectedDocName}</p>
                </div>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => setSelectedDocId(null)}>
                  {t('btn.close')}
                </button>
              </div>

              {docPanelLoading ? (
                <p className="doc-audit-loading">{t('archive.loading')}</p>
              ) : (
                <div className="doc-audit-panel-grid">
                  <div className="doc-audit-panel-col">
                    <h4>{t('docAudit.lifecycleTimeline')}</h4>
                    {!selectedDocHistory.length ? (
                      <p className="doc-audit-empty">{t('docAudit.noHistory')}</p>
                    ) : (
                      <ol className="doc-audit-lifecycle-timeline">
                        {[...selectedDocHistory]
                          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                          .map((entry) => (
                            <li key={entry.id} className="doc-audit-lifecycle-item">
                              <span className="doc-audit-lifecycle-dot" aria-hidden />
                              <div className="doc-audit-lifecycle-body">
                                <time>
                                  {new Date(entry.timestamp).toLocaleTimeString(locale, {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </time>
                                <span>{timelineLabel(entry, t)}</span>
                              </div>
                            </li>
                          ))}
                      </ol>
                    )}
                  </div>

                  <div className="doc-audit-panel-col">
                    <h4>{t('docAudit.versionHistory')}</h4>
                    {!selectedDocVersions.length ? (
                      <p className="doc-audit-empty">{t('empty.none')}</p>
                    ) : (
                      <ul className="doc-audit-panel-versions">
                        {selectedDocVersions.map((v) => (
                          <li key={v.id}>
                            <span>v{v.versionNumber}</span>
                            <span>{fmtSize(v.sizeBytes)}</span>
                            <span>{v.uploadedByName}</span>
                            <time>{fmtDate(v.createdAt, locale)}</time>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="doc-audit-panel-col">
                    <h4>{t('docAudit.integrityTitle')}</h4>
                    <div
                      className={`doc-audit-integrity-card compact${panelIntegrity?.verified === false ? ' failed' : ''}`}
                    >
                      {panelIntegrity ? (
                        <>
                          <div className="doc-audit-integrity-status">
                            {panelIntegrity.verified ? (
                              <>
                                <span className="doc-audit-integrity-icon ok">✓</span>
                                {t('docAudit.integrityVerified')}
                              </>
                            ) : (
                              <>
                                <span className="doc-audit-integrity-icon warn">⚠</span>
                                {t('docAudit.integrityFailed')}
                              </>
                            )}
                          </div>
                          <p className="doc-audit-integrity-meta">
                            {fmtDate(panelIntegrity.lastCheckAt, locale)}
                          </p>
                        </>
                      ) : selectedDocDetail?.sha256Hash ? (
                        <>
                          <div className="doc-audit-integrity-status">
                            <span className="doc-audit-integrity-icon ok">✓</span>
                            {t('docAudit.hashAvailable')}
                          </div>
                          <p className="audit-detail-mono doc-audit-integrity-hash">
                            {selectedDocDetail.sha256Hash.slice(0, 24)}…
                          </p>
                        </>
                      ) : (
                        <p className="doc-audit-empty">{t('users.notAvailable')}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {!displayed.length ? emptyState() : (
            <>
              <div className="audit-desktop-view">{renderTable()}</div>
              <div className="audit-mobile-view">{renderCards()}</div>
            </>
          )}

          {detail && (
            <DocumentAuditDetailModal
              log={detail}
              meta={detail.resourceId ? docMeta[detail.resourceId] : null}
              onClose={() => setDetail(null)}
              onViewDocumentHistory={(id) => setSelectedDocId(id)}
            />
          )}
        </>
      )}
    </div>
  )
}
