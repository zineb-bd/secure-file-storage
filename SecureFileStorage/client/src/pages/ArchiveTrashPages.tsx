import { useCallback, useEffect, useState } from 'react'
import { api } from '@/api/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { DocumentTable } from '@/components/documents/DocumentTable'
import { useI18n } from '@/i18n/I18nContext'
import { buildQuery } from '@/utils/format'
import type { DocumentDto } from '@/types'

export function ArchivedPage() {
  const { t } = useI18n()
  const [docs, setDocs] = useState<DocumentDto[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = buildQuery({ status: 'Archived', page: 1, pageSize: 50 })
      const data = await api<{ items: DocumentDto[] }>(`/api/documents${q}`)
      setDocs(data.items || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className="page" id="page-archived">
      <PageHeader title={t('page.archived.title')} subtitle={t('page.archived.subtitle')} />
      {loading ? (
        <div className="loading">
          <div className="spinner" />
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap" id="archived-table-wrap">
            <DocumentTable documents={docs} onChanged={load} actionOpts={{ showRestore: true, noArchive: true }} />
          </div>
        </div>
      )}
    </section>
  )
}

export function TrashPage() {
  const { t } = useI18n()
  const [docs, setDocs] = useState<DocumentDto[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = buildQuery({ status: 'Deleted', page: 1, pageSize: 50 })
      const data = await api<{ items: DocumentDto[] }>(`/api/documents${q}`)
      setDocs(data.items || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const emptyTrash = async () => {
    if (!window.confirm('Vider la corbeille ?')) return
    await api('/api/trash', { method: 'DELETE' })
    await load()
  }

  return (
    <section className="page" id="page-trash">
      <PageHeader
        title={t('page.trash.title')}
        subtitle={t('page.trash.subtitle')}
        actions={
          <button type="button" className="btn btn-danger" id="btn-empty-trash" onClick={() => void emptyTrash()}>
            {t('btn.emptyTrash')}
          </button>
        }
      />
      {loading ? (
        <div className="loading">
          <div className="spinner" />
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap" id="trash-table-wrap">
            <DocumentTable
              documents={docs}
              onChanged={load}
              actionOpts={{ showRestore: true, showPermDelete: true, noArchive: true, noTrash: true }}
            />
          </div>
        </div>
      )}
    </section>
  )
}
