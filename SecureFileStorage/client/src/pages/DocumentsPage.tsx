import { useCallback, useEffect, useState } from 'react'
import { api } from '@/api/client'
import { CATEGORIES } from '@/constants'
import { PageHeader } from '@/components/layout/PageHeader'
import { DocumentTable } from '@/components/documents/DocumentTable'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/i18n/I18nContext'
import { buildQuery } from '@/utils/format'
import type { DocumentDto } from '@/types'

export function DocumentsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [docs, setDocs] = useState<DocumentDto[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = buildQuery({
        fileName: search.trim() || undefined,
        category: category || undefined,
        status: status || undefined,
        page: 1,
        pageSize: 50,
      })
      const data = await api<{ items: DocumentDto[] }>(`/api/documents${q}`)
      setDocs(data.items || [])
    } finally {
      setLoading(false)
    }
  }, [search, category, status])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className="page" id="page-documents">
      <PageHeader
        title={t('page.documents.title')}
        subtitle={t('page.documents.subtitle')}
        actions={
          <button type="button" className="btn" id="btn-open-upload" onClick={() => navigate('/documents/upload')}>
            {t('btn.upload')}
          </button>
        }
      />
      <div className="filters-bar">
        <div>
          <label htmlFor="doc-search">{t('filter.search')}</label>
          <input
            type="text"
            id="doc-search"
            placeholder={t('filter.searchFile')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="doc-filter-category">{t('table.category')}</label>
          <select id="doc-filter-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">{t('filter.all')}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="doc-filter-status">{t('table.status')}</label>
          <select id="doc-filter-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t('filter.allStatuses')}</option>
            <option value="Active">{t('status.active')}</option>
            <option value="Archived">{t('status.archived')}</option>
          </select>
        </div>
        <div style={{ flex: 0 }}>
          <label>&nbsp;</label>
          <button type="button" className="btn btn-secondary" id="btn-filter-docs" onClick={() => void load()}>
            {t('filter.apply')}
          </button>
        </div>
      </div>
      {loading ? (
        <div className="loading">
          <div className="spinner" />
        </div>
      ) : (
        <div className="card" style={{ padding: 0, marginBottom: 0 }}>
          <div className="table-wrap" id="docs-table-wrap">
            <DocumentTable documents={docs} onChanged={load} />
          </div>
        </div>
      )}
    </section>
  )
}

