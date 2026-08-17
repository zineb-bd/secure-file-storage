import { useCallback, useEffect, useState } from 'react'
import { api } from '@/api/client'
import { IconTrash } from '@/components/categories/CategoryIcons'
import { TrashDocumentList } from '@/components/trash/TrashDocumentList'
import { TrashSkeleton } from '@/components/trash/TrashSkeleton'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/i18n/I18nContext'
import { buildQuery } from '@/utils/format'
import type { DocumentDto } from '@/types'

export function TrashPage() {
  const { t } = useI18n()
  const { isAuthenticated } = useAuth()
  const [docs, setDocs] = useState<DocumentDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [emptyOpen, setEmptyOpen] = useState(false)
  const [emptyBusy, setEmptyBusy] = useState(false)
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const q = buildQuery({ status: 'Deleted', page: 1, pageSize: 500 })
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

  const emptyTrash = async () => {
    setEmptyBusy(true)
    try {
      await api('/api/trash', { method: 'DELETE' })
      setEmptyOpen(false)
      setToast(t('trash.emptied'))
      window.setTimeout(() => setToast(''), 4200)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('msg.loadProfileError'))
    } finally {
      setEmptyBusy(false)
    }
  }

  return (
    <section className="page trash-page files-like-page" id="page-trash">
      {docs.length > 0 && !loading && (
        <div className="page-inline-actions">
          <button
            type="button"
            className="btn btn-outline btn-sm trash-btn-icon"
            id="btn-empty-trash"
            onClick={() => setEmptyOpen(true)}
          >
            <IconTrash size={15} />
            {t('btn.emptyTrash')}
          </button>
        </div>
      )}

      {error && (
        <div className="msg error">
          {error}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void load()}>
            {t('audit.refresh')}
          </button>
        </div>
      )}
      {toast && <div className="profile-toast profile-toast-success" role="status">{toast}</div>}

      {loading ? (
        <TrashSkeleton />
      ) : (
        <TrashDocumentList documents={docs} onChanged={load} />
      )}

      {emptyOpen && (
        <Modal title={t('trash.emptyTrashTitle')} onClose={() => !emptyBusy && setEmptyOpen(false)}>
          <p className="trash-confirm-msg">{t('trash.emptyTrashConfirm', { count: String(docs.length) })}</p>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={() => setEmptyOpen(false)} disabled={emptyBusy}>
              {t('btn.cancel')}
            </button>
            <button type="button" className="btn btn-danger trash-btn-icon" onClick={() => void emptyTrash()} disabled={emptyBusy}>
              <IconTrash size={15} />
              {emptyBusy ? t('profile.saving') : t('btn.emptyTrash')}
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}
