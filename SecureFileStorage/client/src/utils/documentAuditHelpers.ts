import type { AuditLog, DocumentDetail } from '@/types'
import {
  actionLabel,
  matchesStatusFilter,
  statusKind,
  type AuditPeriod,
  type AuditStatusFilter,
} from '@/utils/auditHelpers'

export type DocumentMeta = Pick<
  DocumentDetail,
  'id' | 'fileName' | 'category' | 'contentType' | 'currentVersion'
>

export const DOCUMENT_AUDIT_ACTIONS = [
  'Upload',
  'Download',
  'View',
  'Preview',
  'Update',
  'Delete',
  'Archive',
  'Restore',
  'Share',
  'IntegrityCheck',
  'CheckOut',
  'CheckIn',
] as const

/** Actions hors traçabilité « opération fichier » (bruit / auth / recherche). */
const EXCLUDED_ACTIONS = new Set(['Search', 'Login', 'Logout'])

export function isDocumentActivity(log: AuditLog) {
  if (log.resourceType !== 'Document') return false
  if (EXCLUDED_ACTIONS.has(log.action)) return false
  return true
}

/** Actions serveur réelles correspondant à un filtre UI spécial. */
export function serverActionForFilter(action: string): string {
  if (action === 'Edit' || action === 'VersionCreated') return 'Update'
  if (action === 'Trash' || action === 'PermDelete') return 'Delete'
  return action
}

export function isSpecialActionFilter(action: string) {
  return action === 'Edit' || action === 'VersionCreated' || action === 'Trash' || action === 'PermDelete'
}

export function isVersionCreated(log: AuditLog) {
  return log.action === 'Update' && /nouvelle version/i.test(log.details || '')
}

export function isTrashDelete(log: AuditLog) {
  return log.action === 'Delete' && /corbeille/i.test(log.details || '')
}

export function isPermanentDelete(log: AuditLog) {
  return log.action === 'Delete' && /définitive|definitive/i.test(log.details || '')
}

export function displayActionKey(log: AuditLog): string {
  if (isVersionCreated(log)) return 'docAudit.action.versionCreated'
  if (isTrashDelete(log)) return 'docAudit.action.movedToTrash'
  if (isPermanentDelete(log)) return 'docAudit.action.permanentlyDeleted'
  return `action.${log.action}`
}

export function displayActionLabel(log: AuditLog, t: (key: string) => string) {
  const key = displayActionKey(log)
  const label = t(key)
  return label !== key ? label : actionLabel(log.action, t)
}

export function parseDocumentName(log: AuditLog, meta?: DocumentMeta | null) {
  if (meta?.fileName) return meta.fileName
  const d = log.details || ''
  const uploadMatch = d.match(/Téléversement de (.+?)(?:\s*\(|$)/i)
  if (uploadMatch) return uploadMatch[1].trim()
  if (log.resourceId) return log.resourceId.slice(0, 8) + '…'
  return '—'
}

export function parseVersion(log: AuditLog, meta?: DocumentMeta | null) {
  const d = log.details || ''
  const vMatch = d.match(/v(\d+)/i)
  if (vMatch) return `v${vMatch[1]}`
  if (log.action === 'Upload') return 'v1'
  if (meta?.currentVersion) return `v${meta.currentVersion}`
  return '—'
}

export function parseCategory(_log: AuditLog, meta?: DocumentMeta | null) {
  return meta?.category?.trim() || '—'
}

export function parseContentType(_log: AuditLog, meta?: DocumentMeta | null) {
  return meta?.contentType?.trim() || ''
}

export interface DocumentAuditStats {
  total: number
  uploaded: number
  downloaded: number
  modified: number
  shared: number
  archived: number
  restored: number
  deleted: number
}

export function computeDocumentStats(logs: AuditLog[]): DocumentAuditStats {
  const filtered = logs.filter(isDocumentActivity)
  return {
    total: filtered.length,
    uploaded: filtered.filter((l) => l.action === 'Upload').length,
    downloaded: filtered.filter((l) => l.action === 'Download').length,
    // Toute mise à jour : nouvelle version + métadonnées / check-in-out
    modified: filtered.filter(
      (l) => l.action === 'Update' || l.action === 'CheckIn' || l.action === 'CheckOut'
    ).length,
    shared: filtered.filter((l) => l.action === 'Share' || l.action === 'PermissionChange').length,
    archived: filtered.filter((l) => l.action === 'Archive').length,
    restored: filtered.filter((l) => l.action === 'Restore').length,
    deleted: filtered.filter((l) => l.action === 'Delete').length,
  }
}

export function matchesDocumentSearch(
  log: AuditLog,
  q: string,
  meta?: DocumentMeta | null
) {
  if (!q.trim()) return true
  const hay = [
    log.userEmail,
    log.action,
    log.details,
    log.resourceId,
    parseDocumentName(log, meta),
    parseCategory(log, meta),
    parseContentType(log, meta),
    displayActionLabel(log, (k) => k),
  ]
    .join(' ')
    .toLowerCase()
  return hay.includes(q.toLowerCase())
}

export function matchesCategoryFilter(log: AuditLog, category: string, meta?: DocumentMeta | null) {
  if (!category) return true
  return parseCategory(log, meta).toLowerCase() === category.toLowerCase()
}

export function matchesDocumentFilter(log: AuditLog, resourceId: string) {
  if (!resourceId) return true
  return log.resourceId === resourceId
}

export function matchesActionFilter(log: AuditLog, action: string) {
  if (!action) return true
  if (action === 'Edit') return log.action === 'Update' && !isVersionCreated(log)
  if (action === 'VersionCreated') return isVersionCreated(log)
  if (action === 'Trash') return isTrashDelete(log)
  if (action === 'PermDelete') return isPermanentDelete(log)
  return log.action.toLowerCase() === action.toLowerCase()
}

export function documentStatusKind(log: AuditLog): AuditStatusFilter | 'success' | 'failed' | 'denied' {
  return statusKind(log)
}

export { matchesStatusFilter, statusKind, type AuditPeriod, type AuditStatusFilter }

export function actionIconKind(action: string, log?: AuditLog) {
  if (log && isVersionCreated(log)) return 'version'
  if (log && isTrashDelete(log)) return 'trash'
  if (log && isPermanentDelete(log)) return 'delete'
  const a = action.toLowerCase()
  if (a.includes('upload')) return 'upload'
  if (a.includes('download')) return 'download'
  if (a.includes('preview') || a.includes('view')) return 'view'
  if (a.includes('update') || a.includes('checkout') || a.includes('checkin')) return 'edit'
  if (a.includes('share')) return 'share'
  if (a.includes('archive')) return 'archive'
  if (a.includes('restore')) return 'restore'
  if (a.includes('delete')) return 'delete'
  if (a.includes('integrity')) return 'integrity'
  return 'default'
}

export function timelineLabel(log: AuditLog, t: (key: string) => string) {
  return displayActionLabel(log, t)
}

export function integrityFromLogs(logs: AuditLog[]) {
  const checks = logs
    .filter((l) => l.action === 'IntegrityCheck')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  const last = checks[0]
  if (!last) return null
  const verified = last.success && /ok/i.test(last.details || '')
  return {
    verified,
    lastCheckAt: last.timestamp,
    details: last.details,
  }
}
