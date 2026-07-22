import { useEffect, useState } from 'react'
import { api, downloadBlob } from '@/api/client'
import { useI18n } from '@/i18n/I18nContext'
import { fmtDate, fmtSize } from '@/utils/format'
import type { DocumentDto, DocumentVersion } from '@/types'
import { Modal } from '@/components/ui/Modal'

interface VersionsModalProps {
  doc: DocumentDto
  onClose: () => void
  onChanged?: () => void
}

export function VersionsModal({ doc, onClose, onChanged }: VersionsModalProps) {
  const { t, locale } = useI18n()
  const [versions, setVersions] = useState<DocumentVersion[]>([])

  const load = async () => {
    const data = await api<DocumentVersion[]>(`/api/documents/${doc.id}/versions`)
    setVersions(data)
  }

  useEffect(() => {
    void load()
  }, [doc.id])

  const restore = async (ver: number) => {
    await api(`/api/documents/${doc.id}/versions/${ver}/restore`, { method: 'POST' })
    onChanged?.()
    await load()
  }

  return (
    <Modal title={t('action.versions')} onClose={onClose} wide>
      <p>{doc.fileName}</p>
      <table className="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>{t('table.size')}</th>
            <th>{t('table.owner')}</th>
            <th>{t('table.date')}</th>
            <th>{t('table.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {versions.map((v) => (
            <tr key={v.id}>
              <td>v{v.versionNumber}</td>
              <td>{fmtSize(v.sizeBytes)}</td>
              <td>{v.uploadedByName}</td>
              <td>{fmtDate(v.createdAt, locale)}</td>
              <td>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => void downloadBlob(`/api/documents/${doc.id}/download?version=${v.versionNumber}`, `v${v.versionNumber}-${doc.fileName}`)}
                >
                  {t('action.download')}
                </button>
                {v.versionNumber !== doc.currentVersion && (
                  <button type="button" className="btn btn-sm" onClick={() => void restore(v.versionNumber)}>
                    {t('action.restore')}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="modal-footer">
        <button type="button" className="btn" onClick={onClose}>
          {t('btn.cancel')}
        </button>
      </div>
    </Modal>
  )
}
