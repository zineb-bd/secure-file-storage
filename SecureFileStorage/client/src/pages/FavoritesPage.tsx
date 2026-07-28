import { useCallback, useEffect, useState } from 'react'
import { api } from '@/api/client'
import { CATEGORIES } from '@/constants'
import { PageHeader } from '@/components/layout/PageHeader'
import { DocumentTable } from '@/components/documents/DocumentTable'
import { useI18n } from '@/i18n/I18nContext'
import { buildQuery } from '@/utils/format'
import type { DocumentDto } from '@/types'

export function FavoritesPage() {
  const { t } = useI18n()
  const [docs, setDocs] = useState<DocumentDto[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = buildQuery({
        fileName: search.trim() || undefined,
        category: category || undefined,
        page: 1,
        pageSize: 100,
      })
      const data = await api<{ items: DocumentDto[] }>(`/api/documents/favorites${q}`)
      setDocs(data.items || [])
    } finally {
      setLoading(false)
    }
  }, [search, category])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className="page" id="page-favorites">
      <PageHeader title={t('page.favorites.title')} subtitle={t('page.favorites.subtitle')} />
      <div className="filters-bar">
        <div>
          <label htmlFor="fav-search">{t('filter.search')}</label>
          <input
            type="search"
            id="fav-search"
            placeholder={t('filter.searchFile')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="fav-filter-category">{t('table.category')}</label>
          <select id="fav-filter-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">{t('filter.all')}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 0 }}>
          <label>&nbsp;</label>
          <button type="button" className="btn btn-secondary" onClick={() => void load()}>
            {t('filter.apply')}
          </button>
        </div>
      </div>
      {loading ? (
        <div className="loading">
          <div className="spinner" />
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <DocumentTable
              documents={docs}
              emptyMsg={t('favorites.empty')}
              onChanged={load}
              showFavorite
            />
          </div>
        </div>
      )}
    </section>
  )
}
