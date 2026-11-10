import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, downloadBlob } from '@/api/client'
import { CATEGORIES } from '@/constants'
import { IconClock, IconFileStack, IconGrid, IconList, IconSearch, IconUsers } from '@/components/categories/CategoryIcons'
import { IconDashShare } from '@/components/dashboard/DashboardIcons'
import { FileIcon } from '@/components/documents/FileIcon'
import {
  DocActionButtons,
  LockBadge,
  VisibilityBadge,
  docActionOptsFromDoc,
  type DocActions,
} from '@/components/documents/DocActionButtons'
import { MetadataModal } from '@/components/modals/MetadataModal'
import { PreviewModal } from '@/components/modals/PreviewModal'
import { ShareModal } from '@/components/modals/ShareModal'
import { VersionsModal } from '@/components/modals/VersionsModal'
import { useI18n } from '@/i18n/I18nContext'
import { accessLevelLabel } from '@/utils/dashboardHelpers'
import { toggleFavoriteApi } from '@/utils/favoritesApi'
import { buildQuery, fmtSize } from '@/utils/format'
import type { DocumentDto, PagedResult } from '@/types'

type Tab = 'received' | 'sent'
type ViewMode = 'list' | 'grid'

const ACCESS_FILTERS = ['Read', 'Preview', 'Download', 'Write'] as const

function isWriteAccess(level: string | null | undefined) {
  const l = (level || '').toLowerCase()
  return l === 'write' || l === 'owner' || l.includes('full') || l.includes('modify')
}

function accessTone(level: string | null | undefined) {
  const l = (level || '').toLowerCase()
  if (l === 'owner' || l === 'write' || l.includes('full')) return 'write'
  if (l === 'download') return 'download'
  if (l === 'preview') return 'preview'
  return 'read'
}

function collabAccessLabel(level: string | null | undefined, t: (k: string) => string) {
  if (!level) return '—'
  if (level === 'Owner') return t('collab.role.owner')
  return accessLevelLabel(level, t)
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return (name.slice(0, 2) || '?').toUpperCase()
}

function avatarHue(seed: string) {
  let n = 0
  for (let i = 0; i < seed.length; i++) n = (n + seed.charCodeAt(i) * (i + 1)) % 360
  return n
}

function relativeDate(dateStr: string | null | undefined, locale: string, t: (k: string) => string) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86400000)
  if (diffDays === 0) return t('cat.today')
  if (diffDays === 1) return t('cat.yesterday')
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
}

export function SharedPage() {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [received, setReceived] = useState<DocumentDto[]>([])
  const [sent, setSent] = useState<DocumentDto[]>([])
  const [tab, setTab] = useState<Tab>('received')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [owner, setOwner] = useState('')
  const [access, setAccess] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<DocumentDto | null>(null)
  const [metadata, setMetadata] = useState<DocumentDto | null>(null)
  const [share, setShare] = useState<DocumentDto | null>(null)
  const [versions, setVersions] = useState<DocumentDto | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 280)
    return () => window.clearTimeout(id)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const q = buildQuery({ page: 1, pageSize: 200 })
      const [sharedData, ownedData] = await Promise.all([
        api<PagedResult<DocumentDto>>(`/api/documents/shared-with-me${q}`),
        api<PagedResult<DocumentDto>>(`/api/documents${buildQuery({ status: 'Active', page: 1, pageSize: 500 })}`),
      ])
      setReceived(sharedData.items || [])
      setSent(
        (ownedData.items || []).filter(
          (d) => d.isOwner !== false && (d.visibility === 'Shared' || d.visibility === 'Public')
        )
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : t('msg.loadProfileError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const source = tab === 'received' ? received : sent

  const owners = useMemo(
    () => [...new Set(received.map((d) => d.ownerName).filter(Boolean))].sort(),
    [received]
  )

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase()
    return source.filter((d) => {
      if (q && !d.fileName.toLowerCase().includes(q) && !(d.ownerName || '').toLowerCase().includes(q)) return false
      if (tab === 'received' && owner && d.ownerName !== owner) return false
      if (access) {
        const level = (d.myAccessLevel || (tab === 'sent' ? 'Owner' : '')).toLowerCase()
        if (access === 'Write') {
          if (!isWriteAccess(level) && level !== 'owner') return false
        } else if (level !== access.toLowerCase()) return false
      }
      if (category && (d.category || 'General') !== category) return false
      return true
    })
  }, [source, debouncedSearch, owner, access, category, tab])

  const stats = useMemo(() => {
    const people = new Set(received.map((d) => d.ownerName || d.ownerId || '—')).size
    const editable = received.filter((d) => isWriteAccess(d.myAccessLevel) || d.canModify).length
    return {
      received: received.length,
      sent: sent.length,
      editable,
      people,
    }
  }, [received, sent])

  const hasFilters = Boolean(debouncedSearch || owner || access || category)

  const clearFilters = () => {
    setSearch('')
    setDebouncedSearch('')
    setOwner('')
    setAccess('')
    setCategory('')
  }

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 4200)
  }

  const makeActions = useCallback(
    (doc: DocumentDto): DocActions => ({
      onPreview: doc.isFolder ? undefined : () => setPreview(doc),
      onDownload: doc.isFolder ? undefined : () => void downloadBlob(`/api/documents/${doc.id}/download`, doc.fileName),
      onShare: () => setShare(doc),
      onMetadata: () => setMetadata(doc),
      onVersions: doc.isFolder ? undefined : () => setVersions(doc),
      onFavorite: async () => {
        const result = await toggleFavoriteApi(doc.id, !!doc.isFavorite)
        const patch = (list: DocumentDto[]) =>
          list.map((d) => (d.id === doc.id ? { ...d, isFavorite: result.isFavorite } : d))
        setReceived(patch)
        setSent(patch)
        showToast(result.isFavorite ? t('favorites.added') : t('favorites.removed'))
      },
      onNewVersion:
        !doc.isFolder && doc.canModify !== false
          ? () => navigate(`/documents/upload?documentId=${encodeURIComponent(doc.id)}`)
          : undefined,
    }),
    [navigate, t]
  )

  const actionOptsFor = (doc: DocumentDto) =>
    docActionOptsFromDoc(doc, {
      noArchive: tab === 'received',
      noTrash: tab === 'received',
      showFavorite: true,
      isFavorite: doc.isFavorite,
    })

  const renderDocRow = (d: DocumentDto) => {
    const level = d.myAccessLevel || (tab === 'sent' ? 'Owner' : '')
    return (
      <article key={d.id} className="collab-doc-row">
        <div className="collab-doc-file">
          <FileIcon contentType={d.contentType} fileName={d.fileName} isFolder={d.isFolder} />
          <div className="collab-doc-file-meta">
            <strong title={d.fileName}>{d.fileName}</strong>
            <span>
              {d.category || 'General'}
              {!d.isFolder ? ` · ${fmtSize(d.sizeBytes)}` : ''}
            </span>
          </div>
          <LockBadge doc={d} />
        </div>
        <div className="collab-doc-owner">
          <span
            className="collab-mini-avatar"
            style={{ background: `hsl(${avatarHue(d.ownerName || d.id)} 52% 42%)` }}
            aria-hidden
          >
            {initialsOf(d.ownerName || '?')}
          </span>
          <strong>{tab === 'sent' ? t('shared.you') : d.ownerName || '—'}</strong>
        </div>
        <span className={`collab-access collab-access-${accessTone(level)}`}>
          {collabAccessLabel(level, t)}
        </span>
        <time className="collab-doc-date" dateTime={d.updatedAt || d.createdAt}>
          {relativeDate(d.updatedAt || d.createdAt, locale, t)}
        </time>
        <div className="collab-doc-actions">
          <VisibilityBadge visibility={d.visibility} />
          <DocActionButtons opts={actionOptsFor(d)} {...makeActions(d)} />
        </div>
      </article>
    )
  }

  const renderDocCard = (d: DocumentDto) => {
    const level = d.myAccessLevel || (tab === 'sent' ? 'Owner' : '')
    return (
      <article key={d.id} className="collab-doc-card">
        <div className="collab-doc-card-top">
          <FileIcon contentType={d.contentType} fileName={d.fileName} isFolder={d.isFolder} />
          <span className={`collab-access collab-access-${accessTone(level)}`}>
            {collabAccessLabel(level, t)}
          </span>
        </div>
        <h3 title={d.fileName}>{d.fileName}</h3>
        <div className="collab-doc-owner">
          <span
            className="collab-mini-avatar"
            style={{ background: `hsl(${avatarHue(d.ownerName || d.id)} 52% 42%)` }}
            aria-hidden
          >
            {initialsOf(d.ownerName || '?')}
          </span>
          <span>
            {tab === 'sent' ? t('shared.you') : t('home.sharedBy', { name: d.ownerName || '—' })}
          </span>
        </div>
        <p className="collab-doc-card-meta">
          {d.category || 'General'}
          {!d.isFolder ? ` · ${fmtSize(d.sizeBytes)}` : ''}
          {` · ${relativeDate(d.updatedAt || d.createdAt, locale, t)}`}
        </p>
        <div className="collab-doc-card-footer">
          <VisibilityBadge visibility={d.visibility} />
          <DocActionButtons opts={actionOptsFor(d)} {...makeActions(d)} />
        </div>
      </article>
    )
  }

  return (
    <section className="page collab-page files-like-page" id="page-shared">
      {toast && (
        <div className="profile-toast profile-toast-success" role="status">
          {toast}
        </div>
      )}

      <div className="collab-stats">
        <article className="collab-stat">
          <div className="collab-stat-icon collab-stat-sky" aria-hidden>
            <IconDashShare size={20} />
          </div>
          <div>
            <div className="collab-stat-value">{stats.received}</div>
            <div className="collab-stat-label">{t('shared.stat.received')}</div>
          </div>
        </article>
        <article className="collab-stat">
          <div className="collab-stat-icon collab-stat-sun" aria-hidden>
            <IconFileStack size={20} />
          </div>
          <div>
            <div className="collab-stat-value">{stats.sent}</div>
            <div className="collab-stat-label">{t('shared.stat.sent')}</div>
          </div>
        </article>
        <article className="collab-stat">
          <div className="collab-stat-icon collab-stat-mint" aria-hidden>
            <IconClock size={20} />
          </div>
          <div>
            <div className="collab-stat-value">{stats.editable}</div>
            <div className="collab-stat-label">{t('shared.stat.editable')}</div>
          </div>
        </article>
        <article className="collab-stat">
          <div className="collab-stat-icon collab-stat-coral" aria-hidden>
            <IconUsers size={20} />
          </div>
          <div>
            <div className="collab-stat-value">{stats.people}</div>
            <div className="collab-stat-label">{t('shared.stat.people')}</div>
          </div>
        </article>
      </div>

      <div className="collab-hub-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'received'}
          className={tab === 'received' ? 'active' : ''}
          onClick={() => setTab('received')}
        >
          {t('shared.tab.received')}
          <span className="collab-hub-count">{stats.received}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'sent'}
          className={tab === 'sent' ? 'active' : ''}
          onClick={() => setTab('sent')}
        >
          {t('shared.tab.sent')}
          <span className="collab-hub-count">{stats.sent}</span>
        </button>
      </div>

      {error && (
        <div className="msg error">
          {error}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void load()}>
            {t('audit.refresh')}
          </button>
        </div>
      )}

      <div className="collab-layout">
        <div className="collab-main">
          <div className="collab-toolbar">
            <div className="files-search-wrap">
              <span className="files-search-icon" aria-hidden>
                <IconSearch size={16} />
              </span>
              <input
                type="search"
                id="shared-search"
                className="files-search-input"
                placeholder={t('shared.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label={t('filter.search')}
              />
            </div>

            <div className="collab-toolbar-end">
              {tab === 'received' && (
                <select
                  className="files-select"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  aria-label={t('table.owner')}
                >
                  <option value="">{t('shared.filter.owner')}</option>
                  {owners.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              )}
              <select
                className="files-select"
                value={access}
                onChange={(e) => setAccess(e.target.value)}
                aria-label={t('table.rights')}
              >
                <option value="">{t('shared.filter.access')}</option>
                {ACCESS_FILTERS.map((level) => (
                  <option key={level} value={level}>
                    {collabAccessLabel(level, t)}
                  </option>
                ))}
              </select>
              <select
                className="files-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label={t('table.category')}
              >
                <option value="">{t('shared.filter.category')}</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {hasFilters && (
                <button type="button" className="btn btn-outline btn-sm" onClick={clearFilters}>
                  {t('files.clearFilters')}
                </button>
              )}
              <div className="cat-view-toggle" role="group" aria-label={t('cat.viewMode')}>
                <button
                  type="button"
                  className={`cat-view-btn${viewMode === 'list' ? ' active' : ''}`}
                  onClick={() => setViewMode('list')}
                  aria-pressed={viewMode === 'list'}
                  title={t('cat.viewList')}
                >
                  <IconList size={16} />
                </button>
                <button
                  type="button"
                  className={`cat-view-btn${viewMode === 'grid' ? ' active' : ''}`}
                  onClick={() => setViewMode('grid')}
                  aria-pressed={viewMode === 'grid'}
                  title={t('cat.viewGrid')}
                >
                  <IconGrid size={16} />
                </button>
              </div>
            </div>
          </div>

          <section className="collab-panel">
            <div className="collab-panel-head">
              <div>
                <h2>{t('shared.listTitle')}</h2>
                <p>
                  {loading
                    ? t('files.loading')
                    : t('shared.count', { count: String(filtered.length) })}
                </p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void load()}>
                {t('audit.refresh')}
              </button>
            </div>

            {loading ? (
              <div className="files-skeleton" aria-busy="true">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="files-skeleton-row" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="files-empty">
                <div className="files-empty-icon files-empty-icon-shared" aria-hidden />
                <h3>
                  {hasFilters
                    ? t('files.emptyFilteredTitle')
                    : tab === 'sent'
                      ? t('shared.emptyMineTitle')
                      : t('shared.emptyTitle')}
                </h3>
                <p>
                  {hasFilters
                    ? t('files.emptyFilteredDesc')
                    : tab === 'sent'
                      ? t('shared.emptyMineDesc')
                      : t('shared.emptyDesc')}
                </p>
                {hasFilters ? (
                  <button type="button" className="btn btn-secondary" onClick={clearFilters}>
                    {t('files.clearFilters')}
                  </button>
                ) : (
                  <Link to="/documents" className="btn btn-primary">
                    {t('shared.openDocs')}
                  </Link>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              <div className="collab-doc-grid">{filtered.map(renderDocCard)}</div>
            ) : (
              <div className="collab-doc-list">
                <div className="collab-doc-list-head" aria-hidden>
                  <span>{t('table.name')}</span>
                  <span>{t('table.owner')}</span>
                  <span>{t('shared.role')}</span>
                  <span>{t('shared.updated')}</span>
                  <span>{t('table.actions')}</span>
                </div>
                {filtered.map(renderDocRow)}
              </div>
            )}
          </section>
        </div>
      </div>

      {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} />}
      {metadata && <MetadataModal doc={metadata} onClose={() => setMetadata(null)} onSaved={load} />}
      {share && <ShareModal doc={share} onClose={() => { setShare(null); void load() }} />}
      {versions && <VersionsModal doc={versions} onClose={() => setVersions(null)} onChanged={load} />}
    </section>
  )
}
