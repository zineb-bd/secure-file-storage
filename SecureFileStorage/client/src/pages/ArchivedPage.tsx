import { useCallback, useEffect, useState } from 'react'
import { api } from '@/api/client'
import { ArchiveDocumentList } from '@/components/archive/ArchiveDocumentList'
import { ArchiveSkeleton } from '@/components/archive/ArchiveSkeleton'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/i18n/I18nContext'
import { buildQuery } from '@/utils/format'
import type { DocumentDto } from '@/types'

export function ArchivedPage() {
  const { t } = useI18n()
  const { isAuthenticated } = useAuth()
  const [docs, setDocs] = useState<DocumentDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const q = buildQuery({ status: 'Archived', page: 1, pageSize: 500 })
      const data = await api<{ items: DocumentDto[] }>(`/api/documents${q}`)
      setDocs(data.items || [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('msg.loadProfileError')
      if (msg.includes('401') || msg.includes('Session')) {
        setError(t('msg.sessionExpired'))
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (!isAuthenticated) return
    void load()
  }, [load, isAuthenticated])

  return (
    <section className="page archive-page files-like-page" id="page-archived">
      {error && (
        <div className="msg error">
          {error}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void load()}>
            {t('audit.refresh')}
          </button>
        </div>
      )}

      {loading ? (
        <ArchiveSkeleton />
      ) : (
        <ArchiveDocumentList documents={docs} onChanged={load} />
      )}
    </section>
  )
}
