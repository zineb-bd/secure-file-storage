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

const ICONS: Record<string, () => React.ReactElement> = {
  preview: PreviewIcon,
  download: DownloadIcon,
  share: ShareIcon,
  metadata: MetadataIcon,
  versions: VersionsIcon,
  archive: ArchiveIcon,
  restore: RestoreIcon,
  checkout: CheckoutIcon,
  checkin: CheckinIcon,
  trash: TrashIcon,
  'perm-delete': PermDeleteIcon,
}

function IconBtn({
  action,
  title,
  variant,
  onClick,
}: {
  action: string
  title: string
  variant: string
  onClick: () => void
}) {
  const Icon = ICONS[action]
  return (
    <button
      type="button"
      className={`btn btn-sm btn-icon-only btn-action-${variant}`}
      title={title}
      aria-label={title}
      onClick={onClick}
    >
      {Icon ? <Icon /> : null}
    </button>
  )
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
}

interface DocActionButtonsProps extends DocActions {
  opts?: DocActionOpts
}

export function DocActionButtons({ opts = {}, ...actions }: DocActionButtonsProps) {
  const { t } = useI18n()

  return (
    <div className="btn-group btn-group-icons">
      {!opts.noPreview && actions.onPreview && (
        <IconBtn action="preview" title={t('action.preview')} variant="ghost" onClick={actions.onPreview} />
      )}
      {!opts.noDownload && actions.onDownload && (
        <IconBtn action="download" title={t('action.download')} variant="primary" onClick={actions.onDownload} />
      )}
      {!opts.noShare && actions.onShare && (
        <IconBtn action="share" title={t('action.share')} variant="ghost" onClick={actions.onShare} />
      )}
      {actions.onMetadata && (
        <IconBtn action="metadata" title={t('action.details')} variant="ghost" onClick={actions.onMetadata} />
      )}
      {actions.onVersions && (
        <IconBtn action="versions" title={t('action.versions')} variant="ghost" onClick={actions.onVersions} />
      )}
      {opts.showRestore && actions.onRestore ? (
        <IconBtn action="restore" title={t('action.restore')} variant="success" onClick={actions.onRestore} />
      ) : (
        !opts.noArchive &&
        actions.onArchive && (
          <IconBtn action="archive" title={t('action.archive')} variant="ghost" onClick={actions.onArchive} />
        )
      )}
      {!opts.noTrash && actions.onTrash && (
        <IconBtn action="trash" title={t('action.trash')} variant="danger" onClick={actions.onTrash} />
      )}
      {opts.showPermDelete && actions.onPermDelete && (
        <IconBtn action="perm-delete" title={t('action.permDelete')} variant="danger" onClick={actions.onPermDelete} />
      )}
      {opts.isLockedByCurrentUser && actions.onCheckin ? (
        <IconBtn action="checkin" title={t('action.checkin')} variant="success" onClick={actions.onCheckin} />
      ) : (
        !opts.isLocked &&
        opts.canModify !== false &&
        actions.onCheckout && (
          <IconBtn action="checkout" title={t('action.checkout')} variant="ghost" onClick={actions.onCheckout} />
        )
      )}
    </div>
  )
}

export function docActionOptsFromDoc(d: DocumentDto, extra: Partial<DocActionOpts> = {}): DocActionOpts {
  return {
    isLocked: d.isLocked,
    isLockedByCurrentUser: d.isLockedByCurrentUser,
    canModify: d.canModify,
    ...extra,
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
