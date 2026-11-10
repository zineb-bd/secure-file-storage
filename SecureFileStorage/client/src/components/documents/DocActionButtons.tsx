import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '@/i18n/I18nContext'
import type { DocumentDto, DocActionOpts } from '@/types'

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

function PreviewIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg {...iconProps}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
      <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
    </svg>
  )
}

function MetadataIcon() {
  return (
    <svg {...iconProps}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  )
}

function VersionsIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  )
}

function ArchiveIcon() {
  return (
    <svg {...iconProps}>
      <rect width="20" height="5" x="2" y="3" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
    </svg>
  )
}

function RestoreIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  )
}

function CheckoutIcon() {
  return (
    <svg {...iconProps}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function CheckinIcon() {
  return (
    <svg {...iconProps}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function PermDeleteIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  )
}

function FavoriteIcon({ filled }: { filled?: boolean }) {
  return (
    <svg
      {...iconProps}
      fill={filled ? 'currentColor' : 'none'}
      className={filled ? 'fav-icon-filled' : undefined}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

type MenuItem = {
  key: string
  label: string
  icon: React.ReactElement
  onClick: () => void
  danger?: boolean
}

export interface DocActions {
  onPreview?: () => void
  onDownload?: () => void
  onShare?: () => void
  onMetadata?: () => void
  onVersions?: () => void
  onArchive?: () => void
  onRestore?: () => void
  onTrash?: () => void
  onPermDelete?: () => void
  onCheckout?: () => void
  onCheckin?: () => void
  onFavorite?: () => void
  onMove?: () => void
  onNewVersion?: () => void
}

interface DocActionButtonsProps extends DocActions {
  opts?: DocActionOpts
}

const MENU_WIDTH = 200

export function DocActionButtons({ opts = {}, ...actions }: DocActionButtonsProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const placeMenu = useCallback(() => {
    const btn = triggerRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const height = menuRef.current?.offsetHeight ?? 240
    const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8))
    const below = rect.bottom + 6
    const top = below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 6) : below
    setMenuPos({ top, left })
  }, [])

  useEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }
    placeMenu()
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onReflow = () => placeMenu()
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onReflow)
    window.addEventListener('scroll', onReflow, true)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onReflow)
      window.removeEventListener('scroll', onReflow, true)
    }
  }, [open, placeMenu])

  const moreItems: MenuItem[] = []

  if (actions.onMove && opts.canModify !== false) {
    moreItems.push({
      key: 'move',
      label: t('action.move'),
      icon: <MoveIcon />,
      onClick: actions.onMove,
    })
  }
  if (!opts.isFolder && actions.onVersions) {
    moreItems.push({
      key: 'versions',
      label: t('action.versions'),
      icon: <VersionsIcon />,
      onClick: actions.onVersions,
    })
  }
  if (!opts.isFolder && opts.canModify !== false && actions.onNewVersion) {
    moreItems.push({
      key: 'new-version',
      label: t('action.newVersion'),
      icon: <VersionsIcon />,
      onClick: actions.onNewVersion,
    })
  }
  if (opts.showRestore && actions.onRestore) {
    moreItems.push({
      key: 'restore',
      label: t('action.restore'),
      icon: <RestoreIcon />,
      onClick: actions.onRestore,
    })
  } else if (!opts.noArchive && actions.onArchive) {
    moreItems.push({
      key: 'archive',
      label: t('action.archive'),
      icon: <ArchiveIcon />,
      onClick: actions.onArchive,
    })
  }
  if (opts.isLockedByCurrentUser && actions.onCheckin) {
    moreItems.push({
      key: 'checkin',
      label: t('action.checkin'),
      icon: <CheckinIcon />,
      onClick: actions.onCheckin,
    })
  } else if (!opts.isFolder && !opts.isLocked && opts.canModify !== false && actions.onCheckout) {
    moreItems.push({
      key: 'checkout',
      label: t('action.checkout'),
      icon: <CheckoutIcon />,
      onClick: actions.onCheckout,
    })
  }
  if (!opts.noTrash && actions.onTrash) {
    moreItems.push({
      key: 'trash',
      label: t('action.trash'),
      icon: <TrashIcon />,
      onClick: actions.onTrash,
      danger: true,
    })
  }
  if (opts.showPermDelete && actions.onPermDelete) {
    moreItems.push({
      key: 'perm-delete',
      label: t('action.permDelete'),
      icon: <PermDeleteIcon />,
      onClick: actions.onPermDelete,
      danger: true,
    })
  }

  const run = (fn?: () => void) => {
    setOpen(false)
    fn?.()
  }

  return (
    <div className="doc-actions" ref={rootRef}>
      {opts.showFavorite !== false && actions.onFavorite && (
        <button
          type="button"
          className={`doc-action-btn fav-btn${opts.isFavorite ? ' active' : ''}`}
          title={opts.isFavorite ? t('action.unfavorite') : t('action.favorite')}
          aria-label={opts.isFavorite ? t('action.unfavorite') : t('action.favorite')}
          onClick={actions.onFavorite}
        >
          <FavoriteIcon filled={opts.isFavorite} />
        </button>
      )}

      {!opts.noPreview && actions.onPreview && (
        <button
          type="button"
          className="doc-action-btn"
          title={t('action.preview')}
          aria-label={t('action.preview')}
          onClick={actions.onPreview}
        >
          <PreviewIcon />
        </button>
      )}

      {!opts.noDownload && actions.onDownload && (
        <button
          type="button"
          className="doc-action-btn"
          title={t('action.download')}
          aria-label={t('action.download')}
          onClick={actions.onDownload}
        >
          <DownloadIcon />
        </button>
      )}

      {!opts.noShare && actions.onShare && (
        <button
          type="button"
          className="doc-action-btn"
          title={t('action.collaborate')}
          aria-label={t('action.collaborate')}
          onClick={actions.onShare}
        >
          <ShareIcon />
        </button>
      )}

      {actions.onMetadata && (
        <button
          type="button"
          className="doc-action-btn"
          title={t('action.details')}
          aria-label={t('action.details')}
          onClick={actions.onMetadata}
        >
          <MetadataIcon />
        </button>
      )}

      {moreItems.length > 0 && (
        <div className="doc-actions-more">
          <button
            ref={triggerRef}
            type="button"
            className={`doc-action-btn${open ? ' is-open' : ''}`}
            title={t('action.more')}
            aria-label={t('action.more')}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((v) => !v)}
          >
            <MoreIcon />
          </button>
          {open &&
            createPortal(
              <div
                ref={menuRef}
                className="doc-actions-menu"
                id={menuId}
                role="menu"
                style={{
                  top: menuPos?.top ?? -9999,
                  left: menuPos?.left ?? -9999,
                  visibility: menuPos ? 'visible' : 'hidden',
                }}
              >
                {moreItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="menuitem"
                    className={`doc-actions-menu-item${item.danger ? ' is-danger' : ''}`}
                    onClick={() => run(item.onClick)}
                  >
                    <span className="doc-actions-menu-icon">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>,
              document.body
            )}
        </div>
      )}
    </div>
  )
}

function MoveIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 7h11" />
      <path d="M12 4l3 3-3 3" />
      <path d="M20 17H9" />
      <path d="M12 14l-3 3 3 3" />
    </svg>
  )
}

export function docActionOptsFromDoc(d: DocumentDto, extra: Partial<DocActionOpts> = {}): DocActionOpts {
  const folder = !!d.isFolder
  return {
    isLocked: d.isLocked,
    isLockedByCurrentUser: d.isLockedByCurrentUser,
    canModify: d.canModify,
    isFavorite: d.isFavorite,
    showFavorite: true,
    ...extra,
    isFolder: folder,
    noPreview: folder || extra.noPreview,
    noDownload: folder || extra.noDownload,
  }
}

export function StatusBadge({ status }: { status?: string }) {
  const { t } = useI18n()
  const s = (status || '').toLowerCase()
  if (s === 'active') return <span className="badge badge-active">{t('status.active')}</span>
  if (s === 'archived') return <span className="badge badge-archived">{t('status.archived')}</span>
  if (s === 'deleted') return <span className="badge badge-deleted">{t('status.deleted')}</span>
  return <span className="badge badge-info">{status}</span>
}

export function VisibilityBadge({ visibility }: { visibility?: string }) {
  const { t } = useI18n()
  const v = visibility || 'Private'
  const labels: Record<string, string> = {
    Private: t('vis.private'),
    Shared: t('vis.shared'),
    Public: t('vis.public'),
  }
  return <span className={`vis-badge vis-${v.toLowerCase()}`}>{labels[v] || v}</span>
}

export function LockBadge({ doc }: { doc: DocumentDto }) {
  const { t } = useI18n()
  if (!doc.isLocked) return null
  const cls = doc.isLockedByCurrentUser ? 'lock-badge lock-badge-mine' : 'lock-badge lock-badge-other'
  const label = doc.isLockedByCurrentUser
    ? t('lock.byYou')
    : t('lock.byOther', { name: doc.lockedByName || '—' })
  return (
    <span className={cls} title={label}>
      🔒
    </span>
  )
}
