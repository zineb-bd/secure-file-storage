import { useEffect, useState } from 'react'
import { api, downloadBlob } from '@/api/client'
import { useI18n } from '@/i18n/I18nContext'
import type { DocumentDto } from '@/types'
import { Modal } from '@/components/ui/Modal'

interface PreviewModalProps {
  doc: DocumentDto
  onClose: () => void
}

export function PreviewModal({ doc, onClose }: PreviewModalProps) {
  const { t } = useI18n()
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let objectUrl: string | null = null
    void (async () => {
      try {
        const res = await api<Response>(`/api/documents/${doc.id}/preview`, { raw: true })
        if (!res.ok) throw new Error('Aperçu indisponible')
        const blob = await res.blob()
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur')
      }
    })()
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [doc.id])

  const ct = (doc.contentType || '').toLowerCase()

  return (
    <Modal title={doc.fileName} onClose={onClose} wide>
      {error && <div className="msg error">{error}</div>}
      {!error && !url && <div className="loading-inline">Chargement…</div>}
      {url && ct.includes('pdf') && <iframe src={url} title={doc.fileName} className="preview-frame" />}
      {url && ct.startsWith('image/') && <img src={url} alt={doc.fileName} className="preview-image" />}
      {url && !ct.includes('pdf') && !ct.startsWith('image/') && (
        <p>Aperçu non disponible pour ce type de fichier.</p>
      )}
      <div className="modal-footer">
        <button type="button" className="btn btn-primary" onClick={() => void downloadBlob(`/api/documents/${doc.id}/download`, doc.fileName)}>
          {t('action.download')}
        </button>
        <button type="button" className="btn" onClick={onClose}>
          {t('btn.cancel')}
        </button>
      </div>
    </Modal>
  )
}
