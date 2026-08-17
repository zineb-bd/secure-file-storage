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

function fileTypeLabel(contentType: string | null | undefined, fileName: string) {
  const mime = (contentType || '').toLowerCase()
  if (mime.includes('pdf')) return 'pdf'
  if (mime.includes('image')) return 'images'
  if (mime.includes('video')) return 'video'
  if (mime.includes('audio')) return 'audio'
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return 'sheets'
  if (mime.includes('word') || mime.includes('document') || mime.includes('text')) return 'docs'
  if (mime.includes('zip') || mime.includes('compressed') || mime.includes('archive')) return 'archives'
  const ext = fileName.split('.').pop()?.toUpperCase()
  return ext && ext.length <= 5 ? ext : 'other'
}

export function groupByFileType(docs: DocumentDto[]) {
  const map = new Map<string, number>()
  for (const d of docs) {
    const label = fileTypeLabel(d.contentType, d.fileName)
    map.set(label, (map.get(label) || 0) + 1)
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

export function groupActivityByAction(activities: RecentActivity[]) {
  const map = new Map<string, number>()
  for (const a of activities) {
    const key = a.action || 'Other'
    map.set(key, (map.get(key) || 0) + 1)
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

export function activityByDay(activities: RecentActivity[], days = 7, locale = 'fr') {
  const buckets: { name: string; count: number; date: Date }[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    buckets.push({
      name: d.toLocaleDateString(locale, { weekday: 'short' }),
      count: 0,
      date: d,
    })
  }
  for (const a of activities) {
    const ts = new Date(a.timestamp)
    ts.setHours(0, 0, 0, 0)
    const bucket = buckets.find((b) => b.date.getTime() === ts.getTime())
    if (bucket) bucket.count += 1
  }
  return buckets.map(({ name, count }) => ({ name, count }))
}

export function groupByVisibility(docs: DocumentDto[]) {
  const map = new Map<string, number>()
  for (const d of docs) {
    const key = d.visibility || 'Private'
    map.set(key, (map.get(key) || 0) + 1)
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

export function groupByStatus(docs: DocumentDto[]) {
  const map = new Map<string, number>()
  for (const d of docs) {
    const key = d.status || 'Active'
    map.set(key, (map.get(key) || 0) + 1)
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

export function sizeByCategory(docs: DocumentDto[]) {
  const map = new Map<string, number>()
  for (const d of docs) {
    const cat = d.category?.trim() || 'General'
    map.set(cat, (map.get(cat) || 0) + (d.sizeBytes || 0))
  }
  return [...map.entries()]
    .map(([name, bytes]) => ({ name, bytes }))
    .sort((a, b) => b.bytes - a.bytes)
}

export function documentsByDay(docs: DocumentDto[], days = 7, locale = 'fr') {
  const buckets: { name: string; count: number; date: Date }[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    buckets.push({
      name: d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' }),
      count: 0,
      date: d,
    })
  }
  for (const doc of docs) {
    const ts = new Date(doc.createdAt)
    ts.setHours(0, 0, 0, 0)
    const bucket = buckets.find((b) => b.date.getTime() === ts.getTime())
    if (bucket) bucket.count += 1
  }
  return buckets.map(({ name, count }) => ({ name, count }))
}
