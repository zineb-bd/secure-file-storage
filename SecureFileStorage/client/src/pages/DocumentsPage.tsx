import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '@/api/client'
import { CATEGORIES } from '@/constants'
import { DocumentTable } from '@/components/documents/DocumentTable'
import { CreateFolderModal, MoveModal } from '@/components/documents/FolderModals'
import { IconSearch } from '@/components/categories/CategoryIcons'
import { IconUpload } from '@/components/ui/TopbarIcons'
import { useI18n } from '@/i18n/I18nContext'
import { buildQuery, fmtSize } from '@/utils/format'
import type { DocumentDto, FolderPathItem } from '@/types'

export function DocumentsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const folderId = searchParams.get('folder')
  const [docs, setDocs] = useState<DocumentDto[]>([])
  const [path, setPath] = useState<FolderPathItem[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [moveDoc, setMoveDoc] = useState<DocumentDto | null>(null)

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 280)
    return () => window.clearTimeout(id)
  }, [search])

  const searching = Boolean(debouncedSearch)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const q = buildQuery({
        fileName: debouncedSearch || undefined,
        category: category || undefined,
        status: status || undefined,
        parentId: searching ? undefined : folderId || undefined,
        includeAll: searching ? 'true' : 'false',
        page: 1,
        pageSize: 100,
      })
      const data = await api<{ items: DocumentDto[] }>(`/api/documents${q}`)
      setDocs(data.items || [])
      if (folderId && !searching) {
        const crumbs = await api<FolderPathItem[]>(`/api/documents/${folderId}/path`)
        setPath(crumbs || [])
      } else {
        setPath([])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('msg.loadProfileError'))
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, category, status, folderId, searching, t])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(() => {
    const files = docs.filter((d) => !d.isFolder)
    const folders = docs.filter((d) => d.isFolder).length
    const active = files.filter((d) => d.status === 'Active').length
    const shared = docs.filter((d) => d.visibility === 'Shared' || d.visibility === 'Public').length
    const totalBytes = files.reduce((sum, d) => sum + (d.sizeBytes || 0), 0)
    return { total: docs.length, folders, active, shared, totalBytes }
  }, [docs])

  const hasFilters = Boolean(debouncedSearch || category || status)

  const clearFilters = () => {
    setSearch('')
    setDebouncedSearch('')
    setCategory('')
    setStatus('')
  }

  const openFolder = (id: string | null) => {
    if (!id) setSearchParams({})
    else setSearchParams({ folder: id })
  }

  const uploadHref = folderId ? `/documents/upload?folder=${encodeURIComponent(folderId)}` : '/documents/upload'
  const currentName = path.length ? path[path.length - 1]?.name : t('files.listTitle')

  return (
    <section className="page files-page" id="page-documents">
      <div className="files-stats">
        <article className="files-stat files-stat-blue">
          <div className="files-stat-value">{stats.total}</div>
          <div className="files-stat-label">{t('files.stat.total')}</div>
        </article>
        <article className="files-stat files-stat-green">
          <div className="files-stat-value">{stats.active}</div>
          <div className="files-stat-label">{t('files.stat.active')}</div>
        </article>
        <article className="files-stat files-stat-amber">
          <div className="files-stat-value">{stats.shared}</div>
          <div className="files-stat-label">{t('files.stat.shared')}</div>
        </article>
        <article className="files-stat files-stat-cyan">
          <div className="files-stat-value">{fmtSize(stats.totalBytes)}</div>
          <div className="files-stat-label">{t('files.stat.size')}</div>
        </article>
      </div>

      <nav className="files-breadcrumb" aria-label={t('files.breadcrumb')}>
        <button type="button" className={!folderId ? 'is-current' : undefined} onClick={() => openFolder(null)}>
          {t('nav.documents')}
        </button>
        {path.map((crumb, i) => (
          <span key={crumb.id} className="files-breadcrumb-item">
            <span className="files-breadcrumb-sep" aria-hidden>
              /
            </span>
            <button
              type="button"
              className={i === path.length - 1 ? 'is-current' : undefined}
              onClick={() => openFolder(crumb.id)}
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </nav>

      <div className="files-toolbar">
        <div className="files-search-wrap">
          <span className="files-search-icon" aria-hidden>
            <IconSearch size={16} />
          </span>
          <input
            type="search"
            id="doc-search"
            className="files-search-input"
            placeholder={t('filter.searchFile')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t('filter.search')}
          />
        </div>

        <div className="files-toolbar-end">
          <div className="files-toolbar-filters">
            <select
              id="doc-filter-category"
              className="files-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label={t('table.category')}
            >
              <option value="">{t('filter.allCategories')}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              id="doc-filter-status"
              className="files-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label={t('table.status')}
            >
              <option value="">{t('filter.allStatuses')}</option>
              <option value="Active">{t('status.active')}</option>
              <option value="Archived">{t('status.archived')}</option>
            </select>

            {hasFilters && (
              <button type="button" className="btn btn-outline btn-sm files-clear-btn" onClick={clearFilters}>
                {t('files.clearFilters')}
              </button>
            )}
          </div>

          <button type="button" className="btn btn-outline btn-sm" onClick={() => setCreateOpen(true)}>
            {t('files.newFolder')}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm files-upload-btn"
            id="btn-open-upload"
            onClick={() => navigate(uploadHref)}
          >
            <IconUpload />
            {t('btn.upload')}
          </button>
        </div>
      </div>

      {error && (
        <div className="msg error">
          {error}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void load()}>
            {t('audit.refresh')}
          </button>
        </div>
      )}

      <section className="files-panel">
        <div className="files-panel-header">
          <div>
            <h2>{currentName}</h2>
            <p>
              {loading
                ? t('files.loading')
                : t('files.count', { count: String(docs.length) })}
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void load()}>
            {t('audit.refresh')}
          </button>
        </div>

        {loading ? (
          <div className="files-skeleton" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="files-skeleton-row" />
            ))}
          </div>
        ) : docs.length === 0 ? (
          <div className="files-empty">
            <div className="files-empty-icon" aria-hidden />
            <h3>{hasFilters ? t('files.emptyFilteredTitle') : t('files.emptyFolderTitle')}</h3>
            <p>{hasFilters ? t('files.emptyFilteredDesc') : t('files.emptyFolderDesc')}</p>
            {hasFilters ? (
              <button type="button" className="btn btn-secondary" onClick={clearFilters}>
                {t('files.clearFilters')}
              </button>
            ) : (
              <div className="files-empty-actions">
                <button type="button" className="btn btn-outline" onClick={() => setCreateOpen(true)}>
                  {t('files.newFolder')}
                </button>
                <button type="button" className="btn btn-primary" onClick={() => navigate(uploadHref)}>
                  <IconUpload />
                  {t('home.emptyCta')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="files-table-wrap table-wrap" id="docs-table-wrap">
            <DocumentTable
              documents={docs}
              onChanged={load}
              onOpenFolder={(d) => openFolder(d.id)}
              onMove={setMoveDoc}
              emptyMsg={t('empty.none')}
              showOwner={false}
              compact
            />
          </div>
        )}
      </section>

      {createOpen && (
        <CreateFolderModal parentId={folderId} onClose={() => setCreateOpen(false)} onCreated={() => void load()} />
      )}
      {moveDoc && (
        <MoveModal doc={moveDoc} onClose={() => setMoveDoc(null)} onMoved={() => void load()} />
      )}
    </section>
  )
}
