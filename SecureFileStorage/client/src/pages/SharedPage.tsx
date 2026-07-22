import { useCallback, useEffect, useState } from 'react'
import { api } from '@/api/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { DocumentTable } from '@/components/documents/DocumentTable'
import { useI18n } from '@/i18n/I18nContext'
import { buildQuery } from '@/utils/format'
import type { DocumentDto } from '@/types'

export function SharedPage() {
  const { t } = useI18n()
  const [docs, setDocs] = useState<DocumentDto[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = buildQuery({ fileName: search.trim() || undefined, page: 1, pageSize: 100 })
      const data = await api<{ items: DocumentDto[] }>(`/api/documents/shared-with-me${q}`)
      setDocs(data.items || [])
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className="page" id="page-shared">
      <PageHeader title={t('page.shared.title')} subtitle={t('page.shared.subtitle')} />
      <div className="filters-bar">
        <div>
          <label htmlFor="shared-search">{t('filter.search')}</label>
          <input
            type="search"
            id="shared-search"
            placeholder={t('filter.searchShared')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
              sharedMode
              onChanged={load}
              actionOpts={{ noArchive: true, noTrash: true, noShare: true }}
            />
          </div>
        </div>
      )}
    </section>
  )
}
