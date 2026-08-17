import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'
import { DocumentTable } from '@/components/documents/DocumentTable'
import { IconSearch } from '@/components/categories/CategoryIcons'
import { useI18n } from '@/i18n/I18nContext'
import { buildQuery, fmtSize } from '@/utils/format'
import type { DocumentDto } from '@/types'

export function SharedPage() {
  const { t } = useI18n()
  const [docs, setDocs] = useState<DocumentDto[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 280)
    return () => window.clearTimeout(id)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const q = buildQuery({
        fileName: debouncedSearch || undefined,
        page: 1,
        pageSize: 100,
      })
      const data = await api<{ items: DocumentDto[] }>(`/api/documents/shared-with-me${q}`)
      setDocs(data.items || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : t('msg.loadProfileError'))
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, t])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(() => {
    const owners = new Set(docs.map((d) => d.ownerName || d.ownerId || '—')).size
    const canEdit = docs.filter((d) => {
      const level = (d.myAccessLevel || '').toLowerCase()
      return level.includes('write') || level.includes('full') || level.includes('modify') || level.includes('owner')
    }).length
    const totalBytes = docs.reduce((sum, d) => sum + (d.sizeBytes || 0), 0)
    return { total: docs.length, owners, canEdit, totalBytes }
  }, [docs])

  const hasFilters = Boolean(debouncedSearch)

  const clearFilters = () => {
    setSearch('')
    setDebouncedSearch('')
  }

  return (
    <section className="page files-page shared-page" id="page-shared">
      <div className="files-stats">
        <article className="files-stat files-stat-blue">
          <div className="files-stat-value">{stats.total}</div>
          <div className="files-stat-label">{t('shared.stat.total')}</div>
        </article>
        <article className="files-stat files-stat-amber">
          <div className="files-stat-value">{stats.owners}</div>
          <div className="files-stat-label">{t('shared.stat.owners')}</div>
        </article>
        <article className="files-stat files-stat-green">
          <div className="files-stat-value">{stats.canEdit}</div>
          <div className="files-stat-label">{t('shared.stat.editable')}</div>
        </article>
        <article className="files-stat files-stat-cyan">
          <div className="files-stat-value">{fmtSize(stats.totalBytes)}</div>
          <div className="files-stat-label">{t('shared.stat.size')}</div>
        </article>
      </div>

      <div className="files-toolbar">
        <div className="files-search-wrap">
          <span className="files-search-icon" aria-hidden>
            <IconSearch size={16} />
          </span>
          <input
            type="search"
            id="shared-search"
            className="files-search-input"
            placeholder={t('filter.searchShared')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t('filter.search')}
          />
        </div>

        <div className="files-toolbar-end">
          <div className="files-toolbar-filters">
            {hasFilters && (
              <button type="button" className="btn btn-outline btn-sm files-clear-btn" onClick={clearFilters}>
                {t('files.clearFilters')}
              </button>
            )}
          </div>

          <Link to="/documents" className="btn btn-secondary btn-sm files-upload-btn">
            {t('nav.documents')}
          </Link>
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
            <h2>{t('shared.listTitle')}</h2>
            <p>
              {loading
                ? t('files.loading')
                : t('shared.count', { count: String(docs.length) })}
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
            <div className="files-empty-icon files-empty-icon-shared" aria-hidden />
            <h3>{hasFilters ? t('files.emptyFilteredTitle') : t('shared.emptyTitle')}</h3>
            <p>{hasFilters ? t('files.emptyFilteredDesc') : t('shared.emptyDesc')}</p>
            {hasFilters ? (
              <button type="button" className="btn btn-secondary" onClick={clearFilters}>
                {t('files.clearFilters')}
              </button>
            ) : (
              <Link to="/documents" className="btn btn-primary">
                {t('nav.documents')}
              </Link>
            )}
          </div>
        ) : (
          <div className="files-table-wrap table-wrap">
            <DocumentTable
              documents={docs}
              sharedMode
              emptyMsg={t('shared.emptyTitle')}
              onChanged={load}
              showFavorite
              showOwner
              compact
              actionOpts={{ noArchive: true, noTrash: true, noShare: true }}
            />
          </div>
        )}
      </section>
    </section>
  )
}
