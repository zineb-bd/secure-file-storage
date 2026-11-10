import { useEffect, useMemo, useState } from 'react'
import { api, downloadBlob } from '@/api/client'
import { useI18n } from '@/i18n/I18nContext'
import type { DocumentDto } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { canInlinePreview, previewKindOf } from '@/utils/previewHelpers'

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
  const kind = useMemo(() => previewKindOf(doc.contentType || '', doc.fileName || ''), [doc])
  const canInline = canInlinePreview(kind)
  const ext = (doc.fileName || '').split('.').pop()?.toUpperCase() || 'FILE'

  const [url, setUrl] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(canInline)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    if (!canInline) {
      setLoading(false)
      setError('')
      setUrl(null)
      return
    }

    let active = true
    let createdUrl: string | null = null

    void (async () => {
      setLoading(true)
      setError('')
      setUrl(null)
      setText('')

      const tryOnce = async () => {
        const endpoint = kind === 'text'
          ? `/api/documents/${doc.id}/download`
          : `/api/documents/${doc.id}/preview`
        const res = await api<Response>(endpoint, { raw: true })
        if (res.status === 401) throw new Error(t('preview.sessionExpired'))
        if (!res.ok) throw new Error(t('preview.unavailable'))
        return res
      }

      try {
        let res: Response
        try {
          res = await tryOnce()
        } catch (err) {
          const isNetwork =
            err instanceof TypeError ||
            /failed to fetch|networkerror|load failed/i.test(err instanceof Error ? err.message : '')
          if (!isNetwork) throw err
          await new Promise((r) => window.setTimeout(r, 2500))
          res = await tryOnce()
        }

        const blob = await res.blob()
        if (kind === 'text') {
          const body = await blob.text()
          if (!active) return
          setText(body.slice(0, 80_000))
          return
        }

        const objectUrl = URL.createObjectURL(blob)
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
  }, [doc.id, t, retryKey, canInline, kind])

  const download = () => void downloadBlob(`/api/documents/${doc.id}/download`, doc.fileName)

  return (
    <Modal title={doc.fileName} onClose={onClose} wide>
      {canInline && error && (
        <div className="preview-empty">
          <div className="preview-empty-icon" aria-hidden>
            {ext}
          </div>
          <h4>{t('preview.unavailableTitle')}</h4>
          <p>{error}</p>
          <div className="preview-empty-actions">
            <button type="button" className="btn btn-primary" onClick={download}>
              {t('action.download')}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setRetryKey((n) => n + 1)}>
              {t('preview.retry')}
            </button>
          </div>
        </div>
      )}

      {!canInline && (
        <div className="preview-empty">
          <div className="preview-empty-icon" aria-hidden>
            {ext}
          </div>
          <h4>{t('preview.unsupportedTitle')}</h4>
          <p>
            {kind === 'office' ? t('preview.officeDesc') : t('preview.unsupportedType')}
          </p>
          <button type="button" className="btn btn-primary" onClick={download}>
            {t('action.download')}
          </button>
        </div>
      )}

      {canInline && !error && loading && <div className="loading-inline">{t('preview.loading')}</div>}
      {url && kind === 'pdf' && <iframe src={url} title={doc.fileName} className="preview-frame" />}
      {url && kind === 'image' && <img src={url} alt={doc.fileName} className="preview-image" />}
      {url && kind === 'video' && (
        <video src={url} controls className="preview-video" title={doc.fileName}>
          {t('preview.unsupportedType')}
        </video>
      )}
      {url && kind === 'audio' && (
        <audio src={url} controls className="preview-audio" title={doc.fileName}>
          {t('preview.unsupportedType')}
        </audio>
      )}
      {kind === 'text' && !error && !loading && (
        <pre className="preview-text">{text || t('preview.unsupportedType')}</pre>
      )}

      <div className="modal-footer">
        <button type="button" className="btn btn-primary" onClick={download}>
          {t('action.download')}
        </button>
        <button type="button" className="btn btn-outline" onClick={onClose}>
          {t('btn.close')}
        </button>
      </div>
    </Modal>
  )
}
