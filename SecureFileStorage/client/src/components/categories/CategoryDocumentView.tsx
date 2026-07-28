import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, downloadBlob } from '@/api/client'
import { DocumentTable } from '@/components/documents/DocumentTable'
import { FileIcon } from '@/components/documents/FileIcon'
import {
  DocActionButtons,
  LockBadge,
  StatusBadge,
  VisibilityBadge,
  docActionOptsFromDoc,
  type DocActions,
} from '@/components/documents/DocActionButtons'
import { MetadataModal } from '@/components/modals/MetadataModal'
import { PreviewModal } from '@/components/modals/PreviewModal'
import { ShareModal } from '@/components/modals/ShareModal'
import { VersionsModal } from '@/components/modals/VersionsModal'
import { IconFilter, IconGrid, IconList, IconSearch } from '@/components/categories/CategoryIcons'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/i18n/I18nContext'
import { toggleFavoriteApi } from '@/utils/favoritesApi'
import { fmtDate, fmtSize } from '@/utils/format'
import type { DocumentDto } from '@/types'

type ViewMode = 'grid' | 'list'

interface DocFilters {
  search: string
  contentType: string
  owner: string
  visibility: string
  status: string
  dateFrom: string
  dateTo: string
  sizeMin: string
}

const EMPTY_FILTERS: DocFilters = {
  search: '',
  contentType: '',
  owner: '',
  visibility: '',
  status: '',
  dateFrom: '',
  dateTo: '',
  sizeMin: '',
}

interface CategoryDocumentViewProps {
  documents: DocumentDto[]
  emptyMsg?: string
  onChanged?: () => void
}

export function CategoryDocumentView({ documents, emptyMsg, onChanged }: CategoryDocumentViewProps) {
  const { t, locale } = useI18n()
  const { isAdmin } = useAuth()
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [filters, setFilters] = useState<DocFilters>(EMPTY_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [localDocs, setLocalDocs] = useState<DocumentDto[]>(documents)
  const [toast, setToast] = useState('')
  const [preview, setPreview] = useState<DocumentDto | null>(null)
  const [metadata, setMetadata] = useState<DocumentDto | null>(null)
  const [share, setShare] = useState<DocumentDto | null>(null)
  const [versions, setVersions] = useState<DocumentDto | null>(null)

  useEffect(() => {
    setLocalDocs(documents)
  }, [documents])

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 4200)
  }

  const owners = useMemo(
    () => [...new Set(localDocs.map((d) => d.ownerName).filter(Boolean))].sort(),
    [localDocs]
  )
  const types = useMemo(
    () => [...new Set(localDocs.map((d) => d.contentType).filter(Boolean))].sort(),
    [localDocs]
  )

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    const minBytes = filters.sizeMin ? Number(filters.sizeMin) * 1024 : 0
    return localDocs.filter((d) => {
      if (q && !d.fileName.toLowerCase().includes(q)) return false
      if (filters.contentType && d.contentType !== filters.contentType) return false
      if (filters.owner && d.ownerName !== filters.owner) return false
      if (filters.visibility && d.visibility !== filters.visibility) return false
      if (filters.status && d.status !== filters.status) return false
      if (minBytes && d.sizeBytes < minBytes) return false
      const updated = d.updatedAt || d.createdAt
      if (filters.dateFrom && updated && updated.slice(0, 10) < filters.dateFrom) return false
      if (filters.dateTo && updated && updated.slice(0, 10) > filters.dateTo) return false
      return true
    })
  }, [localDocs, filters])

  const hasActiveFilters = useMemo(
    () => Object.entries(filters).some(([, v]) => v.trim() !== ''),
    [filters]
  )

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
        setLocalDocs((prev) =>
          prev.map((d) => (d.id === doc.id ? { ...d, isFavorite: result.isFavorite } : d))
        )
        showToast(result.isFavorite ? t('favorites.added') : t('favorites.removed'))
        onChanged?.()
      },
      onArchive: async () => {
        await api(`/api/documents/${doc.id}/archive`, { method: 'POST' })
        onChanged?.()
      },
      onTrash: async () => {
        await api(`/api/documents/${doc.id}`, { method: 'DELETE' })
        onChanged?.()
      },
      onPermDelete: async () => {
        if (!confirmPermanentDelete(doc.fileName)) return
        await api(`/api/documents/${doc.id}/permanent`, { method: 'DELETE' })
        onChanged?.()
      },
    }),
    [onChanged, t]
  )

  const clearFilters = () => setFilters(EMPTY_FILTERS)

  return (
    <div className="cat-docs-view">
      {toast && <div className="profile-toast profile-toast-success">{toast}</div>}
      <div className="cat-toolbar">
        <div className="cat-search-wrap">
          <IconSearch size={18} className="cat-search-icon" />
          <input
            type="search"
            className="cat-search-input"
            placeholder={t('cat.docSearchPlaceholder')}
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
        </div>
        <div className="cat-toolbar-actions">
          <button
            type="button"
            className={`btn btn-sm btn-outline cat-filter-toggle${filtersOpen ? ' active' : ''}`}
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <IconFilter size={16} />
            {t('filter.advanced')}
          </button>
          {hasActiveFilters && (
            <button type="button" className="btn btn-sm btn-outline" onClick={clearFilters}>
              {t('cat.clearFilters')}
            </button>
          )}
          <div className="cat-view-toggle" role="group" aria-label={t('cat.viewMode')}>
            <button
              type="button"
              className={`cat-view-btn${viewMode === 'grid' ? ' active' : ''}`}
              onClick={() => setViewMode('grid')}
              title={t('cat.viewGrid')}
              aria-pressed={viewMode === 'grid'}
            >
              <IconGrid size={16} />
            </button>
            <button
              type="button"
              className={`cat-view-btn${viewMode === 'list' ? ' active' : ''}`}
              onClick={() => setViewMode('list')}
              title={t('cat.viewList')}
              aria-pressed={viewMode === 'list'}
            >
              <IconList size={16} />
            </button>
          </div>
        </div>
      </div>

      {filtersOpen && (
        <div className="cat-filters-panel">
          <div className="cat-filters-grid">
            <div className="cat-filter-field">
              <label htmlFor="cat-f-type">{t('filter.type')}</label>
              <select
                id="cat-f-type"
                value={filters.contentType}
                onChange={(e) => setFilters((f) => ({ ...f, contentType: e.target.value }))}
              >
                <option value="">{t('filter.all')}</option>
                {types.map((tp) => (
                  <option key={tp} value={tp}>
                    {tp.split('/').pop()}
                  </option>
                ))}
              </select>
            </div>
            <div className="cat-filter-field">
              <label htmlFor="cat-f-owner">{t('cat.filterOwner')}</label>
              <select
                id="cat-f-owner"
                value={filters.owner}
                onChange={(e) => setFilters((f) => ({ ...f, owner: e.target.value }))}
              >
                <option value="">{t('filter.all')}</option>
                {owners.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="cat-filter-field">
              <label htmlFor="cat-f-vis">{t('cat.filterVisibility')}</label>
              <select
                id="cat-f-vis"
                value={filters.visibility}
                onChange={(e) => setFilters((f) => ({ ...f, visibility: e.target.value }))}
              >
                <option value="">{t('filter.all')}</option>
                <option value="Private">{t('vis.private')}</option>
                <option value="Shared">{t('vis.shared')}</option>
                <option value="Public">{t('vis.public')}</option>
              </select>
            </div>
            <div className="cat-filter-field">
              <label htmlFor="cat-f-status">{t('filter.status')}</label>
              <select
                id="cat-f-status"
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="">{t('filter.allStatuses')}</option>
                <option value="Active">{t('status.active')}</option>
                <option value="Archived">{t('status.archived')}</option>
              </select>
            </div>
            <div className="cat-filter-field">
              <label htmlFor="cat-f-from">{t('filter.from')}</label>
              <input
                id="cat-f-from"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
              />
            </div>
            <div className="cat-filter-field">
              <label htmlFor="cat-f-to">{t('filter.to')}</label>
              <input
                id="cat-f-to"
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
              />
            </div>
            <div className="cat-filter-field">
              <label htmlFor="cat-f-size">{t('cat.filterSize')}</label>
              <input
                id="cat-f-size"
                type="number"
                min={0}
                placeholder="KB"
                value={filters.sizeMin}
                onChange={(e) => setFilters((f) => ({ ...f, sizeMin: e.target.value }))}
              />
            </div>
          </div>
        </div>
      )}

      {!filtered.length ? (
        <div className="cat-docs-empty">
          <p>{emptyMsg || t('empty.none')}</p>
          {hasActiveFilters && (
            <button type="button" className="btn btn-sm btn-outline" onClick={clearFilters}>
              {t('cat.clearFilters')}
            </button>
          )}
        </div>
      ) : viewMode === 'list' ? (
        <div className="card cat-docs-table-card">
          <div className="table-wrap">
            <DocumentTable documents={filtered} onChanged={onChanged} emptyMsg={emptyMsg} />
          </div>
        </div>
      ) : (
        <div className="cat-doc-grid">
          {filtered.map((d) => {
            const opts = {
              ...docActionOptsFromDoc(d),
              showPermDelete: isAdmin,
            }
            return (
              <article key={d.id} className="cat-doc-card">
                <div className="cat-doc-card-head">
                  <span className="cat-doc-icon">
                    <FileIcon contentType={d.contentType} fileName={d.fileName} />
                  </span>
                  <button
                    type="button"
                    className={`cat-fav-btn${d.isFavorite ? ' active' : ''}`}
                    title={d.isFavorite ? t('action.unfavorite') : t('action.favorite')}
                    aria-label={d.isFavorite ? t('action.unfavorite') : t('action.favorite')}
                    onClick={() => void makeActions(d).onFavorite?.()}
                  >
                    ★
                  </button>
                </div>
                <h4 className="cat-doc-name" title={d.fileName}>
                  {d.fileName}
                  <LockBadge doc={d} />
                </h4>
                <div className="cat-doc-meta">
                  <span>{(d.contentType || '—').split('/').pop()}</span>
                  <span>{fmtSize(d.sizeBytes)}</span>
                  <span>v{d.currentVersion || 1}</span>
                </div>
                <div className="cat-doc-badges">
                  <VisibilityBadge visibility={d.visibility} />
                  <StatusBadge status={d.status} />
                </div>
                <div className="cat-doc-footer">
                  <span className="cat-doc-owner">{d.ownerName || '—'}</span>
                  <time>{fmtDate(d.updatedAt || d.createdAt, locale)}</time>
                </div>
                <DocActionButtons opts={opts} {...makeActions(d)} />
              </article>
            )
          })}
        </div>
      )}

      {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} />}
      {metadata && (
        <MetadataModal doc={metadata} onClose={() => setMetadata(null)} onSaved={onChanged} />
      )}
      {share && <ShareModal doc={share} onClose={() => setShare(null)} />}
      {versions && <VersionsModal doc={versions} onClose={() => setVersions(null)} onChanged={onChanged} />}
    </div>
  )
}
