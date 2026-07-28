import type { DocumentDto, RecentActivity } from '@/types'
import { DOC_FAVORITES_KEY } from '@/constants'

export function loadFavoriteIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DOC_FAVORITES_KEY) || '[]') as string[]
  } catch {
    return []
  }
}

export function groupByCategory(docs: DocumentDto[]) {
  const map = new Map<string, number>()
  for (const d of docs) {
    const cat = d.category?.trim() || 'General'
    map.set(cat, (map.get(cat) || 0) + 1)
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

export function countSharedOwned(docs: DocumentDto[]) {
  return docs.filter((d) => d.isOwner && (d.visibility === 'Shared' || d.visibility === 'Public')).length
}

export function accessLevelLabel(level: string | null | undefined, t: (k: string) => string) {
  if (!level) return '—'
  const key = `home.access.${level}`
  const label = t(key)
  return label !== key ? label : level
}

const ACTIVITY_ICONS: Record<string, string> = {
  Upload: 'upload',
  Download: 'download',
  View: 'view',
  Preview: 'view',
  Update: 'edit',
  Share: 'share',
  Archive: 'archive',
  Restore: 'restore',
  Delete: 'delete',
}

export function activityIconKind(action: string) {
  return ACTIVITY_ICONS[action] || 'default'
}

export function activityDescription(activity: RecentActivity, t: (k: string) => string) {
  const doc = activity.documentName && activity.documentName !== '—' ? activity.documentName : t('home.aDocument')
  const key = `home.activity.${activity.action}`
  const template = t(key)
  if (template !== key) return template.replace('{doc}', doc)
  return `${doc} — ${activity.action}`
}

export function storageMeterPercent(used: number, logical: number) {
  if (!logical || logical <= 0) return used > 0 ? 12 : 0
  return Math.min(Math.round((used / logical) * 100), 100)
}
