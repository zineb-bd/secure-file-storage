import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'
import { CATEGORIES } from '@/constants'
import { DocumentTable } from '@/components/documents/DocumentTable'
import { IconSearch } from '@/components/categories/CategoryIcons'
import { useI18n } from '@/i18n/I18nContext'
import { buildQuery, fmtSize } from '@/utils/format'
import type { DocumentDto } from '@/types'

export function FavoritesPage() {
  const { t } = useI18n()
  const [docs, setDocs] = useState<DocumentDto[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [category, setCategory] = useState('')
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
        category: category || undefined,
        page: 1,
        pageSize: 100,
      })
      const data = await api<{ items: DocumentDto[] }>(`/api/documents/favorites${q}`)
      setDocs(data.items || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : t('msg.loadProfileError'))
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, category, t])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(() => {
    const cats = new Set(docs.map((d) => d.category || 'General')).size
    const shared = docs.filter((d) => d.visibility === 'Shared' || d.visibility === 'Public').length
    const totalBytes = docs.reduce((sum, d) => sum + (d.sizeBytes || 0), 0)
    return { total: docs.length, cats, shared, totalBytes }
  }, [docs])

  const hasFilters = Boolean(debouncedSearch || category)

  const clearFilters = () => {
    setSearch('')
    setDebouncedSearch('')
    setCategory('')
  }

  return (
    <section className="page files-page fav-page" id="page-favorites">
      <div className="files-stats">
        <article className="files-stat files-stat-blue">
          <div className="files-stat-value">{stats.total}</div>
          <div className="files-stat-label">{t('fav.stat.total')}</div>
        </article>
        <article className="files-stat files-stat-amber">
          <div className="files-stat-value">{stats.cats}</div>
          <div className="files-stat-label">{t('fav.stat.categories')}</div>
        </article>
        <article className="files-stat files-stat-green">
          <div className="files-stat-value">{stats.shared}</div>
          <div className="files-stat-label">{t('fav.stat.shared')}</div>
        </article>
        <article className="files-stat files-stat-cyan">
          <div className="files-stat-value">{fmtSize(stats.totalBytes)}</div>
          <div className="files-stat-label">{t('fav.stat.size')}</div>
        </article>
      </div>

      <div className="files-toolbar">
        <div className="files-search-wrap">
          <span className="files-search-icon" aria-hidden>
            <IconSearch size={16} />
          </span>
          <input
            type="search"
            id="fav-search"
            className="files-search-input"
            placeholder={t('filter.searchFile')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t('filter.search')}
          />
        </div>

        <div className="files-toolbar-filters">
          <select
            id="fav-filter-category"
            className="files-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label={t('table.category')}
          >
            <option value="">{t('filter.all')}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button type="button" className="btn btn-outline btn-sm" onClick={clearFilters}>
              {t('files.clearFilters')}
            </button>
          )}

          <Link to="/documents" className="btn btn-secondary btn-sm">
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
            <h2>{t('fav.listTitle')}</h2>
            <p>
              {loading
                ? t('files.loading')
                : t('fav.count', { count: String(docs.length) })}
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
            <div className="files-empty-icon files-empty-icon-fav" aria-hidden />
            <h3>{hasFilters ? t('files.emptyFilteredTitle') : t('fav.emptyTitle')}</h3>
            <p>{hasFilters ? t('files.emptyFilteredDesc') : t('fav.emptyDesc')}</p>
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
              emptyMsg={t('favorites.empty')}
              onChanged={load}
              showFavorite
              showOwner={false}
              compact
            />
          </div>
        )}
      </section>
    </section>
  )
}
