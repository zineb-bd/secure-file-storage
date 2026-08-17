import { useEffect, useState } from 'react'
import { api, downloadBlob } from '@/api/client'
import { useI18n } from '@/i18n/I18nContext'
import type { DocumentDto } from '@/types'
import { Modal } from '@/components/ui/Modal'

interface PreviewModalProps {
  doc: DocumentDto
  onClose: () => void
}

function previewErrorMessage(err: unknown, t: (k: string) => string) {
  const msg = err instanceof Error ? err.message : ''
  if (/failed to fetch|networkerror|load failed|aborterror/i.test(msg)) {
    return t('preview.networkError')
  }
  if (msg) return msg
  return t('preview.unavailable')
}

export function PreviewModal({ doc, onClose }: PreviewModalProps) {
  const { t } = useI18n()
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let active = true
    let createdUrl: string | null = null

    void (async () => {
      setLoading(true)
      setError('')
      setUrl(null)

      const tryOnce = async () => {
        const res = await api<Response>(`/api/documents/${doc.id}/preview`, { raw: true })
        if (res.status === 401) throw new Error(t('preview.sessionExpired'))
        if (!res.ok) throw new Error(t('preview.unavailable'))
        return URL.createObjectURL(await res.blob())
      }

      try {
        let objectUrl: string
        try {
          objectUrl = await tryOnce()
        } catch (err) {
          const isNetwork =
            err instanceof TypeError ||
            /failed to fetch|networkerror|load failed/i.test(err instanceof Error ? err.message : '')
          if (!isNetwork) throw err
          await new Promise((r) => window.setTimeout(r, 2500))
          objectUrl = await tryOnce()
        }
        if (!active) {
          URL.revokeObjectURL(objectUrl)
          return
        }
        createdUrl = objectUrl
        setUrl(objectUrl)
      } catch (err) {
        if (active) setError(previewErrorMessage(err, t))
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [doc.id, t, retryKey])

  const ct = (doc.contentType || '').toLowerCase()

  return (
    <Modal title={doc.fileName} onClose={onClose} wide>
      {error && (
        <div className="msg error preview-error">
          <p>{error}</p>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => setRetryKey((n) => n + 1)}
          >
            {t('preview.retry')}
          </button>
        </div>
      )}
      {!error && loading && <div className="loading-inline">{t('preview.loading')}</div>}
      {url && ct.includes('pdf') && <iframe src={url} title={doc.fileName} className="preview-frame" />}
      {url && ct.startsWith('image/') && <img src={url} alt={doc.fileName} className="preview-image" />}
      {url && !ct.includes('pdf') && !ct.startsWith('image/') && (
        <p>{t('preview.unsupportedType')}</p>
      )}
      <div className="modal-footer">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void downloadBlob(`/api/documents/${doc.id}/download`, doc.fileName)}
        >
          {t('action.download')}
        </button>
        <button type="button" className="btn" onClick={onClose}>
          {t('btn.cancel')}
        </button>
      </div>
    </Modal>
  )
}
