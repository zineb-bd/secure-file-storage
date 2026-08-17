import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'
import { TrashDetailModal } from '@/components/trash/TrashDetailModal'
import {
  IconClock,
  IconClose,
  IconFileStack,
  IconFilter,
  IconGrid,
  IconList,
  IconMore,
  IconRestore,
  IconSearch,
  IconTrash,
} from '@/components/categories/CategoryIcons'
import { FileIcon } from '@/components/documents/FileIcon'
import { LockBadge, StatusBadge, VisibilityBadge } from '@/components/documents/DocActionButtons'
import { PreviewModal } from '@/components/modals/PreviewModal'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/i18n/I18nContext'
import { fmtDate, fmtSize } from '@/utils/format'
import type { DocumentDto } from '@/types'

type ViewMode = 'grid' | 'list'
type SortKey = 'name' | 'deleted' | 'size' | 'category' | 'owner' | 'created'

interface Filters {
  search: string
  contentType: string
  category: string
  owner: string
  dateFrom: string
  dateTo: string
}

const EMPTY_FILTERS: Filters = {
  search: '',
  contentType: '',
  category: '',
  owner: '',
  dateFrom: '',
  dateTo: '',
}

type ConfirmAction = 'restore-one' | 'delete-one' | 'restore-bulk' | 'delete-bulk'

function deletedDate(d: DocumentDto) {
  return d.deletedAt || d.updatedAt || d.createdAt
}

interface TrashDocumentListProps {
  documents: DocumentDto[]
  onChanged: () => void
  onEmptyTrash?: () => void
}

export function TrashDocumentList({ documents, onChanged, onEmptyTrash }: TrashDocumentListProps) {
  const { t, locale } = useI18n()
  const { isAdmin } = useAuth()

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [sortKey, setSortKey] = useState<SortKey>('deleted')
  const [sortAsc, setSortAsc] = useState(false)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [deleteAck, setDeleteAck] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const [preview, setPreview] = useState<DocumentDto | null>(null)
  const [detail, setDetail] = useState<DocumentDto | null>(null)
  const [confirm, setConfirm] = useState<{ action: ConfirmAction; doc?: DocumentDto } | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 4200)
  }, [])

  useEffect(() => {
    setDeleteAck(false)
  }, [confirm])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(null)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  const categories = useMemo(
    () => [...new Set(documents.map((d) => d.category).filter(Boolean))].sort(),
    [documents]
  )
  const owners = useMemo(
    () => [...new Set(documents.map((d) => d.ownerName).filter(Boolean))].sort(),
    [documents]
  )
  const types = useMemo(
    () => [...new Set(documents.map((d) => d.contentType).filter(Boolean))].sort(),
    [documents]
  )

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    return documents.filter((d) => {
      if (q && !d.fileName.toLowerCase().includes(q)) return false
      if (filters.contentType && d.contentType !== filters.contentType) return false
      if (filters.category && d.category !== filters.category) return false
      if (filters.owner && d.ownerName !== filters.owner) return false
      const deleted = deletedDate(d)
      if (filters.dateFrom && deleted && deleted.slice(0, 10) < filters.dateFrom) return false
      if (filters.dateTo && deleted && deleted.slice(0, 10) > filters.dateTo) return false
      return true
    })
  }, [documents, filters])

  const sorted = useMemo(() => {
    const list = [...filtered]
    const dir = sortAsc ? 1 : -1
    list.sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return dir * a.fileName.localeCompare(b.fileName)
        case 'size':
          return dir * (a.sizeBytes - b.sizeBytes)
        case 'category':
          return dir * (a.category || '').localeCompare(b.category || '')
        case 'owner':
          return dir * (a.ownerName || '').localeCompare(b.ownerName || '')
        case 'created':
          return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        case 'deleted':
        default:
          return dir * (new Date(deletedDate(a)).getTime() - new Date(deletedDate(b)).getTime())
      }
    })
    return list
  }, [filtered, sortKey, sortAsc])

  const hasActiveFilters = useMemo(
    () => Object.values(filters).some((v) => v.trim() !== ''),
    [filters]
  )

  const stats = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const recent = documents.filter((d) => new Date(deletedDate(d)) >= monthStart).length
    const storage = documents.reduce((s, d) => s + (d.sizeBytes || 0), 0)
    return { total: documents.length, recent, storage }
  }, [documents])

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === sorted.length) setSelected(new Set())
    else setSelected(new Set(sorted.map((d) => d.id)))
  }

  const restoreDoc = async (doc: DocumentDto) => {
    await api(`/api/documents/${doc.id}/restore`, { method: 'POST' })
  }

  const permDeleteDoc = async (doc: DocumentDto) => {
    await api(`/api/documents/${doc.id}/permanent`, { method: 'DELETE' })
  }

  const runConfirm = async () => {
    if (!confirm) return
    if (confirm.action.includes('delete') && !deleteAck) return
    setBusy(true)
    try {
      if (confirm.action === 'restore-one' && confirm.doc) {
        await restoreDoc(confirm.doc)
        showToast(t('trash.restored'))
      } else if (confirm.action === 'delete-one' && confirm.doc) {
        await permDeleteDoc(confirm.doc)
        showToast(t('trash.deleted'))
      } else if (confirm.action === 'restore-bulk') {
        const ids = [...selected]
        await Promise.all(ids.map((id) => restoreDoc(documents.find((d) => d.id === id)!)))
        showToast(t('trash.restoredBulk', { count: String(ids.length) }))
        setSelected(new Set())
      } else if (confirm.action === 'delete-bulk') {
        const ids = [...selected]
        await Promise.all(ids.map((id) => permDeleteDoc(documents.find((d) => d.id === id)!)))
        showToast(t('trash.deletedBulk', { count: String(ids.length) }))
        setSelected(new Set())
      }
      setConfirm(null)
      setDetail(null)
      onChanged()
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('msg.loadProfileError'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const renderMenu = (doc: DocumentDto) => (
    <div className="trash-menu-wrap" ref={menuOpen === doc.id ? menuRef : undefined}>
      <button
        type="button"
        className="trash-menu-btn"
        aria-label={t('table.actions')}
        onClick={(e) => {
          e.stopPropagation()
          setMenuOpen(menuOpen === doc.id ? null : doc.id)
        }}
      >
        <IconMore size={18} />
      </button>
      {menuOpen === doc.id && (
        <div className="cat-dropdown trash-dropdown" role="menu">
          <button type="button" role="menuitem" onClick={() => { setPreview(doc); setMenuOpen(null) }}>
            {t('action.preview')}
          </button>
          <button type="button" role="menuitem" onClick={() => { setDetail(doc); setMenuOpen(null) }}>
            {t('trash.openDetails')}
          </button>
          {doc.canModify !== false && (
            <button
              type="button"
              role="menuitem"
              onClick={() => { setConfirm({ action: 'restore-one', doc }); setMenuOpen(null) }}
            >
              {t('action.restore')}
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              role="menuitem"
              className="danger"
              onClick={() => { setConfirm({ action: 'delete-one', doc }); setMenuOpen(null) }}
            >
              {t('action.permDelete')}
            </button>
          )}
        </div>
      )}
    </div>
  )

  const renderToolbar = () => (
    <>
      <div className="trash-toolbar">
        <div className="trash-search-wrap">
          <IconSearch size={18} className="trash-search-icon" />
          <input
            type="search"
            className="trash-search-input"
            placeholder={t('trash.searchPlaceholder')}
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
        </div>
        <div className="trash-toolbar-actions">
          <button
            type="button"
            className={`btn btn-sm btn-outline trash-filter-toggle${filtersOpen ? ' active' : ''}`}
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <IconFilter size={16} />
            {t('filter.advanced')}
          </button>
          {hasActiveFilters && (
            <button type="button" className="btn btn-sm btn-outline" onClick={() => setFilters(EMPTY_FILTERS)}>
              {t('cat.clearFilters')}
            </button>
          )}
          <select
            className="trash-sort-select"
            value={`${sortKey}-${sortAsc ? 'asc' : 'desc'}`}
            onChange={(e) => {
              const [k, dir] = e.target.value.split('-') as [SortKey, 'asc' | 'desc']
              setSortKey(k)
              setSortAsc(dir === 'asc')
            }}
            aria-label={t('trash.sortBy')}
          >
            <option value="deleted-desc">{t('trash.sortDeleted')}</option>
            <option value="deleted-asc">{t('trash.sortDeletedAsc')}</option>
            <option value="name-asc">{t('trash.sortName')}</option>
            <option value="size-desc">{t('trash.sortSize')}</option>
            <option value="category-asc">{t('trash.sortCategory')}</option>
            <option value="owner-asc">{t('trash.sortOwner')}</option>
            <option value="created-desc">{t('trash.sortCreated')}</option>
          </select>
          <div className="cat-view-toggle" role="group" aria-label={t('cat.viewMode')}>
            <button
              type="button"
              className={`cat-view-btn${viewMode === 'grid' ? ' active' : ''}`}
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
            >
              <IconGrid size={16} />
            </button>
            <button
              type="button"
              className={`cat-view-btn${viewMode === 'list' ? ' active' : ''}`}
              onClick={() => setViewMode('list')}
              aria-pressed={viewMode === 'list'}
            >
              <IconList size={16} />
            </button>
          </div>
          {onEmptyTrash && documents.length > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-outline trash-btn-icon trash-empty-btn"
              id="btn-empty-trash"
              onClick={onEmptyTrash}
            >
              <IconTrash size={15} />
              {t('btn.emptyTrash')}
            </button>
          )}
        </div>
      </div>
      {filtersOpen && (
        <div className="trash-filters-panel">
          <div className="trash-filters-grid">
            <div className="trash-filter-field">
              <label htmlFor="trash-f-type">{t('filter.type')}</label>
              <select id="trash-f-type" value={filters.contentType} onChange={(e) => setFilters((f) => ({ ...f, contentType: e.target.value }))}>
                <option value="">{t('filter.all')}</option>
                {types.map((tp) => (
                  <option key={tp} value={tp}>{tp.split('/').pop()}</option>
                ))}
              </select>
            </div>
            <div className="trash-filter-field">
              <label htmlFor="trash-f-cat">{t('table.category')}</label>
              <select id="trash-f-cat" value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
                <option value="">{t('filter.all')}</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="trash-filter-field">
              <label htmlFor="trash-f-owner">{t('cat.filterOwner')}</label>
              <select id="trash-f-owner" value={filters.owner} onChange={(e) => setFilters((f) => ({ ...f, owner: e.target.value }))}>
                <option value="">{t('filter.all')}</option>
                {owners.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="trash-filter-field">
              <label htmlFor="trash-f-from">{t('trash.filterFrom')}</label>
              <input id="trash-f-from" type="date" value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} />
            </div>
            <div className="trash-filter-field">
              <label htmlFor="trash-f-to">{t('trash.filterTo')}</label>
              <input id="trash-f-to" type="date" value={filters.dateTo} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} />
            </div>
          </div>
        </div>
      )}
    </>
  )

  const renderStats = () => (
    <div className="trash-stats-row">
      <div className="trash-stat-card">
        <div className="trash-stat-icon trash-stat-icon-slate"><IconTrash size={20} /></div>
        <div>
          <div className="trash-stat-value">{stats.total}</div>
          <div className="trash-stat-label">{t('trash.statTotal')}</div>
        </div>
      </div>
      <div className="trash-stat-card">
        <div className="trash-stat-icon trash-stat-icon-blue"><IconClock size={20} /></div>
        <div>
          <div className="trash-stat-value">{stats.recent}</div>
          <div className="trash-stat-label">{t('trash.statRecent')}</div>
        </div>
      </div>
      <div className="trash-stat-card">
        <div className="trash-stat-icon trash-stat-icon-green"><IconFileStack size={20} /></div>
        <div>
          <div className="trash-stat-value">{fmtSize(stats.storage)}</div>
          <div className="trash-stat-label">{t('trash.statStorage')}</div>
        </div>
      </div>
      <div className="trash-stat-card">
        <div className="trash-stat-icon trash-stat-icon-indigo"><IconList size={20} /></div>
        <div>
          <div className="trash-stat-value">{selected.size}</div>
          <div className="trash-stat-label">{t('trash.statSelected')}</div>
        </div>
      </div>
    </div>
  )

  if (!documents.length) {
    return (
      <div className="trash-docs-view">
        {renderStats()}
        {renderToolbar()}
        <div className="trash-empty-state">
          <div className="trash-empty-icon"><IconTrash size={56} /></div>
          <h3>{t('trash.emptyTitle')}</h3>
          <p>{t('trash.emptyDesc')}</p>
          <Link to="/documents" className="btn btn-primary">{t('trash.viewDocuments')}</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="trash-docs-view">
      {renderStats()}
      {renderToolbar()}

      {selected.size > 0 && (
        <div className="trash-bulk-bar">
          <span>{t('trash.selected', { count: String(selected.size) })}</span>
          <div className="trash-bulk-actions">
            <button type="button" className="btn btn-sm btn-primary trash-btn-icon" onClick={() => setConfirm({ action: 'restore-bulk' })}>
              <IconRestore size={15} />
              {t('trash.restoreSelected')}
            </button>
            {isAdmin && (
              <button type="button" className="btn btn-sm btn-danger trash-btn-icon" onClick={() => setConfirm({ action: 'delete-bulk' })}>
                <IconTrash size={15} />
                {t('trash.deleteSelected')}
              </button>
            )}
            <button type="button" className="btn btn-sm btn-outline trash-btn-icon" onClick={() => setSelected(new Set())}>
              <IconClose size={15} />
              {t('trash.clearSelection')}
            </button>
          </div>
        </div>
      )}

      {!sorted.length ? (
        <div className="trash-docs-empty">
          <p>{t('cat.noResultsDesc')}</p>
          {hasActiveFilters && (
            <button type="button" className="btn btn-sm btn-outline" onClick={() => setFilters(EMPTY_FILTERS)}>
              {t('cat.clearFilters')}
            </button>
          )}
        </div>
      ) : viewMode === 'list' ? (
        <div className="card trash-table-card">
          <div className="table-wrap">
            <table className="data-table trash-table">
              <thead>
                <tr>
                  <th className="trash-check-col">
                    <input type="checkbox" checked={selected.size === sorted.length && sorted.length > 0} onChange={toggleSelectAll} aria-label={t('trash.selectAll')} />
                  </th>
                  <th />
                  <th>{t('table.name')}</th>
                  <th>{t('table.type')}</th>
                  <th>{t('table.size')}</th>
                  <th>{t('table.category')}</th>
                  <th>{t('table.owner')}</th>
                  <th>{t('trash.deletedDate')}</th>
                  <th>{t('table.created')}</th>
                  <th>{t('table.version')}</th>
                  <th>{t('table.status')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.map((d) => (
                  <tr key={d.id} className={selected.has(d.id) ? 'trash-row-selected' : ''}>
                    <td><input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleSelect(d.id)} aria-label={d.fileName} /></td>
                    <td><FileIcon contentType={d.contentType} fileName={d.fileName} /></td>
                    <td>
                      <span className="doc-name">
                        {d.fileName}
                        <VisibilityBadge visibility={d.visibility} />
                        <LockBadge doc={d} />
                      </span>
                    </td>
                    <td>{(d.contentType || '—').split('/').pop()}</td>
                    <td>{fmtSize(d.sizeBytes)}</td>
                    <td>{d.category || '—'}</td>
                    <td>{d.ownerName || '—'}</td>
                    <td>{fmtDate(deletedDate(d), locale)}</td>
                    <td>{fmtDate(d.createdAt, locale)}</td>
                    <td>v{d.currentVersion || 1}</td>
                    <td><StatusBadge status={d.status} /></td>
                    <td>{renderMenu(d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="trash-doc-grid">
          {sorted.map((d) => (
            <article key={d.id} className={`trash-doc-card${selected.has(d.id) ? ' selected' : ''}`}>
              <div className="trash-doc-card-top">
                <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleSelect(d.id)} aria-label={d.fileName} />
                {renderMenu(d)}
              </div>
              <div className="trash-doc-icon"><FileIcon contentType={d.contentType} fileName={d.fileName} /></div>
              <h4 className="trash-doc-name" title={d.fileName}>{d.fileName}</h4>
              <div className="trash-doc-meta">
                <span>{(d.contentType || '—').split('/').pop()}</span>
                <span>{fmtSize(d.sizeBytes)}</span>
                <span>{d.category || '—'}</span>
              </div>
              <div className="trash-doc-badges">
                <StatusBadge status={d.status} />
                <VisibilityBadge visibility={d.visibility} />
              </div>
              <div className="trash-doc-footer">
                <span>{d.ownerName || '—'}</span>
                <time>{fmtDate(deletedDate(d), locale)}</time>
              </div>
              <div className="trash-doc-actions">
                <button type="button" className="btn btn-sm btn-outline" onClick={() => setPreview(d)}>{t('action.preview')}</button>
                {d.canModify !== false && (
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => setConfirm({ action: 'restore-one', doc: d })}>
                    {t('action.restore')}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} />}

      {detail && (
        <TrashDetailModal
          doc={detail}
          onClose={() => setDetail(null)}
          onPreview={() => { setPreview(detail); setDetail(null) }}
          onRestore={() => setConfirm({ action: 'restore-one', doc: detail })}
          canPermDelete={isAdmin}
          onPermDelete={() => setConfirm({ action: 'delete-one', doc: detail })}
        />
      )}

      {confirm && (
        <Modal
          title={confirm.action.includes('delete') ? t('trash.deleteConfirmTitle') : t('trash.restoreConfirmTitle')}
          onClose={() => !busy && setConfirm(null)}
        >
          <p className="trash-confirm-msg">
            {confirm.action.includes('delete')
              ? confirm.action === 'delete-bulk'
                ? t('trash.deleteConfirmBulk', { count: String(selected.size) })
                : t('trash.deleteConfirmMsg')
              : confirm.action.includes('bulk')
                ? t('trash.restoreConfirmBulk', { count: String(selected.size) })
                : t('trash.restoreConfirmMsg', { name: confirm.doc?.fileName || '' })}
          </p>
          {confirm.action.includes('delete') && (
            <label className="trash-confirm-check">
              <input type="checkbox" checked={deleteAck} onChange={(e) => setDeleteAck(e.target.checked)} />
              {t('trash.understandPermanent')}
            </label>
          )}
          <div className="modal-footer">
            <button type="button" className="btn" onClick={() => setConfirm(null)} disabled={busy}>{t('btn.cancel')}</button>
            <button
              type="button"
              className={`btn ${confirm.action.includes('delete') ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => void runConfirm()}
              disabled={busy || (confirm.action.includes('delete') && !deleteAck)}
            >
              {busy ? t('profile.saving') : confirm.action.includes('delete') ? t('action.permDelete') : t('action.restore')}
            </button>
          </div>
        </Modal>
      )}

      {toast && (
        <div className={`profile-toast profile-toast-${toast.type}`} role="status">{toast.message}</div>
      )}
    </div>
  )
}
