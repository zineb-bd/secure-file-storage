import type { AuditLog } from '@/types'

export const AUDIT_ACTIONS = [
  'Upload',
  'Download',
  'View',
  'Update',
  'Delete',
  'Archive',
  'Restore',
  'Search',
  'Preview',
  'Login',
  'Logout',
  'Share',
  'PermissionChange',
  'IntegrityCheck',
  'AntivirusAlert',
  'CheckOut',
  'CheckIn',
] as const

export type AuditStatusFilter = '' | 'success' | 'failed' | 'denied'
export type AuditPeriod = '' | 'today' | 'yesterday' | 'last7' | 'last30' | 'custom'
export type AuditViewMode = 'table' | 'timeline'

export function actionLabel(action: string, t: (key: string) => string) {
  const key = `action.${action}`
  const label = t(key)
  return label !== key ? label : action
}

export function statusKind(log: AuditLog): 'success' | 'failed' | 'denied' {
  if (log.success) return 'success'
  const a = log.action.toLowerCase()
  if (a.includes('login') || a.includes('permission')) return 'denied'
  return 'failed'
}

export function isSecurityAction(log: AuditLog) {
  const a = log.action.toLowerCase()
  return (
    !log.success ||
    a.includes('login') ||
    a.includes('integrity') ||
    a.includes('antivirus') ||
    a.includes('permission')
  )
}

export function securityLevel(log: AuditLog): 'critical' | 'high' | 'medium' | 'low' {
  const a = log.action.toLowerCase()
  if (a.includes('antivirus') || (!log.success && a.includes('integrity'))) return 'critical'
  if (!log.success && a.includes('login')) return 'high'
  if (!log.success && a.includes('permission')) return 'high'
  if (!log.success) return 'medium'
  if (a.includes('integrity') || a.includes('permission')) return 'low'
  return 'low'
}

export function periodToRange(period: AuditPeriod): { from: string; to: string } {
  const now = new Date()
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)

  if (period === 'yesterday') {
    start.setDate(start.getDate() - 1)
    end.setDate(end.getDate() - 1)
  } else if (period === 'last7') {
    start.setDate(start.getDate() - 6)
  } else if (period === 'last30') {
    start.setDate(start.getDate() - 29)
  }

  return {
    from: start.toISOString(),
    to: end.toISOString(),
  }
}

export function todayStartIso() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function matchesClientSearch(log: AuditLog, q: string) {
  if (!q) return true
  const hay = `${log.userEmail || ''} ${log.action} ${log.details} ${log.ipAddress} ${log.resourceType}`.toLowerCase()
  return hay.includes(q.toLowerCase())
}

export function matchesStatusFilter(log: AuditLog, status: AuditStatusFilter) {
  if (!status) return true
  return statusKind(log) === status
}

export function matchesResourceType(log: AuditLog, type: string) {
  if (!type) return true
  return log.resourceType.toLowerCase() === type.toLowerCase()
}

export function actionIconKind(action: string) {
  const a = action.toLowerCase()
  if (a.includes('login') || a.includes('logout')) return 'auth'
  if (a.includes('upload')) return 'upload'
  if (a.includes('download')) return 'download'
  if (a.includes('preview') || a.includes('view')) return 'view'
  if (a.includes('update') || a.includes('edit') || a.includes('checkout') || a.includes('checkin')) return 'edit'
  if (a.includes('share')) return 'share'
  if (a.includes('archive')) return 'archive'
  if (a.includes('restore')) return 'restore'
  if (a.includes('delete')) return 'delete'
  if (a.includes('permission')) return 'permission'
  if (a.includes('integrity') || a.includes('antivirus')) return 'security'
  return 'default'
}
