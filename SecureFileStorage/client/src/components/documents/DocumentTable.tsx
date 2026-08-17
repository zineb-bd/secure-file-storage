import { useCallback, useEffect, useState } from 'react'
import { api, downloadBlob } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/i18n/I18nContext'
import { fmtDate, fmtSize } from '@/utils/format'
import { toggleFavoriteApi } from '@/utils/favoritesApi'
import type { DocumentDto, DocActionOpts } from '@/types'
import { FileIcon } from './FileIcon'
import {
  DocActionButtons,
  LockBadge,
  StatusBadge,
  VisibilityBadge,
  docActionOptsFromDoc,
  type DocActions,
} from './DocActionButtons'
import { MetadataModal } from '@/components/modals/MetadataModal'
import { PreviewModal } from '@/components/modals/PreviewModal'
import { ShareModal } from '@/components/modals/ShareModal'
import { VersionsModal } from '@/components/modals/VersionsModal'

interface DocumentTableProps {
  documents: DocumentDto[]
  emptyMsg?: string
  actionOpts?: Partial<DocActionOpts>
  onChanged?: () => void
  showOwner?: boolean
  sharedMode?: boolean
  showFavorite?: boolean
  /** Fewer columns for narrower layouts (Mes fichiers) */
  compact?: boolean
}

export function DocumentTable({
  documents,
  emptyMsg,
  actionOpts = {},
  onChanged,
  showOwner = true,
  sharedMode = false,
  showFavorite = true,
  compact = false,
}: DocumentTableProps) {
  const { t, locale } = useI18n()
  const { isAdmin } = useAuth()
  const [preview, setPreview] = useState<DocumentDto | null>(null)
  const [metadata, setMetadata] = useState<DocumentDto | null>(null)
  const [share, setShare] = useState<DocumentDto | null>(null)
  const [versions, setVersions] = useState<DocumentDto | null>(null)
  const [localDocs, setLocalDocs] = useState<DocumentDto[] | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    setLocalDocs(null)
  }, [documents])

  const docs = localDocs ?? documents

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 4200)
  }

  const confirmPermanentDelete = (label?: string) =>
    window.confirm(
      `Êtes-vous sûr de vouloir supprimer définitivement${label ? ` « ${label} »` : ' ce document'} ?\n\nCette action est irréversible.`
    )

  const makeActions = useCallback(
    (doc: DocumentDto): DocActions => ({
      onPreview: () => setPreview(doc),
      onDownload: () => void downloadBlob(`/api/documents/${doc.id}/download`, doc.fileName),
      onShare: () => setShare(doc),
      onMetadata: () => setMetadata(doc),
      onVersions: () => setVersions(doc),
      onFavorite: async () => {
        const result = await toggleFavoriteApi(doc.id, !!doc.isFavorite)
        setLocalDocs((prev) => {
          const base = prev ?? documents
          return base.map((d) =>
            d.id === doc.id ? { ...d, isFavorite: result.isFavorite } : d
          )
        })
        showToast(
          result.isFavorite ? t('favorites.added') : t('favorites.removed')
        )
        onChanged?.()
      },
      onArchive: async () => {
        await api(`/api/documents/${doc.id}/archive`, { method: 'POST' })
        onChanged?.()
      },
      onRestore: async () => {
        await api(`/api/documents/${doc.id}/restore`, { method: 'POST' })
        onChanged?.()
      },
      onTrash: async () => {
        if (actionOpts.showPermDelete) {
          await api(`/api/documents/${doc.id}/trash`, { method: 'POST' })
        } else {
          await api(`/api/documents/${doc.id}`, { method: 'DELETE' })
        }
        onChanged?.()
      },
      onPermDelete: async () => {
        if (!confirmPermanentDelete(doc.fileName)) return
        await api(`/api/documents/${doc.id}/permanent`, { method: 'DELETE' })
        onChanged?.()
      },
      onCheckout: async () => {
        await api(`/api/documents/${doc.id}/checkout`, {
          method: 'POST',
          body: JSON.stringify({ expiresInHours: 8 }),
        })
        onChanged?.()
      },
      onCheckin: async () => {
        await api(`/api/documents/${doc.id}/checkin`, { method: 'POST' })
        onChanged?.()
      },
    }),
    [actionOpts.showPermDelete, documents, onChanged, t]
  )

  if (!docs.length) {
    return <div className="empty-state">{emptyMsg || t('empty.none')}</div>
  }

  return (
    <>
      {toast && <div className="profile-toast profile-toast-success">{toast}</div>}
      <table className={`data-table${compact ? ' data-table-compact' : ''}`}>
        <thead>
          <tr>
            <th />
            <th>{t('table.name')}</th>
            {!sharedMode && <th>{t('table.category')}</th>}
            {!compact && <th>{t('table.type')}</th>}
            <th>{t('table.size')}</th>
            {!sharedMode && !compact && <th>{t('table.version')}</th>}
            {showOwner && <th>{t('table.owner')}</th>}
            {sharedMode && <th>{t('table.rights')}</th>}
            <th>{sharedMode ? t('table.date') : t('table.updated')}</th>
            {!sharedMode && <th>{t('table.status')}</th>}
            <th>{t('table.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => {
            const opts = {
              ...docActionOptsFromDoc(d, actionOpts),
              showPermDelete: actionOpts.showPermDelete && isAdmin,
              showFavorite: showFavorite && actionOpts.showFavorite !== false,
              isFavorite: d.isFavorite,
            }
            return (
              <tr key={d.id}>
                <td>
                  <span className="file-icon">
                    <FileIcon contentType={d.contentType} fileName={d.fileName} />
                  </span>
                </td>
                <td>
                  <span className="doc-name" title={d.fileName}>
                    <span className="doc-name-text">{d.fileName}</span>
                    <VisibilityBadge visibility={d.visibility} />
                    <LockBadge doc={d} />
                  </span>
                </td>
                {!sharedMode && <td>{d.category || '—'}</td>}
                {!compact && <td>{(d.contentType || '—').split('/').pop()}</td>}
                <td>{fmtSize(d.sizeBytes)}</td>
                {!sharedMode && !compact && <td>{d.currentVersion || 1}</td>}
                {showOwner && <td>{d.ownerName || '—'}</td>}
                {sharedMode && <td>{d.myAccessLevel || '—'}</td>}
                <td>{fmtDate(sharedMode ? d.createdAt : d.updatedAt || d.createdAt, locale)}</td>
                {!sharedMode && (
                  <td>
                    <StatusBadge status={d.status} />
                  </td>
                )}
                <td>
                  <DocActionButtons opts={opts} {...makeActions(d)} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} />}
      {metadata && (
        <MetadataModal doc={metadata} onClose={() => setMetadata(null)} onSaved={onChanged} />
      )}
      {share && <ShareModal doc={share} onClose={() => setShare(null)} />}
      {versions && <VersionsModal doc={versions} onClose={() => setVersions(null)} onChanged={onChanged} />}
    </>
  )
}
