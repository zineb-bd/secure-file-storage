import { api } from '@/api/client'
import type { DocumentCategoryDto } from '@/types'
import {
  CATEGORIES,
  CATEGORY_OVERRIDES_KEY,
  CUSTOM_CATEGORIES_KEY,
} from '@/constants'

export interface CustomCategory {
  name: string
  description?: string
  icon?: string
  color?: string
}

export type CategoryIconId =
  | 'folder'
  | 'users'
  | 'finance'
  | 'contract'
  | 'projects'
  | 'reports'
  | 'admin'
  | 'tech'
  | 'other'

export type CategoryColorId = 'blue' | 'green' | 'indigo' | 'amber' | 'violet' | 'slate' | 'rose' | 'teal'

export const CATEGORY_ICON_IDS: CategoryIconId[] = [
  'folder',
  'users',
  'finance',
  'contract',
  'projects',
  'reports',
  'admin',
  'tech',
  'other',
]

export const CATEGORY_COLOR_IDS: CategoryColorId[] = [
  'blue',
  'green',
  'indigo',
  'amber',
  'violet',
  'slate',
  'rose',
  'teal',
]

export const BUILTIN_META: Record<
  string,
  { icon: CategoryIconId; color: CategoryColorId; descKey: string; labelKey: string }
> = {
  RH: { icon: 'users', color: 'blue', descKey: 'cat.desc.rh', labelKey: 'cat.label.rh' },
  Factures: { icon: 'finance', color: 'green', descKey: 'cat.desc.invoices', labelKey: 'cat.label.invoices' },
  Contrats: { icon: 'contract', color: 'indigo', descKey: 'cat.desc.contracts', labelKey: 'cat.label.contracts' },
  General: { icon: 'folder', color: 'slate', descKey: 'cat.desc.general', labelKey: 'cat.label.general' },
}

export function loadCustomCategories(): CustomCategory[] {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_CATEGORIES_KEY) || '[]')
  } catch {
    return []
  }
}

export function saveCustomCategories(list: CustomCategory[]) {
  localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(list))
}

export function loadCategoryOverrides(): Record<string, Partial<CustomCategory & { label?: string }>> {
  try {
    return JSON.parse(localStorage.getItem(CATEGORY_OVERRIDES_KEY) || '{}')
  } catch {
    return {}
  }
}

export function saveCategoryOverrides(overrides: Record<string, Partial<CustomCategory & { label?: string }>>) {
  localStorage.setItem(CATEGORY_OVERRIDES_KEY, JSON.stringify(overrides))
}

export function isBuiltinCategory(key: string) {
  return (CATEGORIES as readonly string[]).includes(key)
}

export function isCustomCategory(key: string) {
  return loadCustomCategories().some((c) => c.name === key)
}

export function getCategoryMeta(key: string) {
  const custom = loadCustomCategories().find((c) => c.name === key)
  const override = loadCategoryOverrides()[key]
  const builtin = BUILTIN_META[key]
  return {
    icon: (custom?.icon || override?.icon || builtin?.icon || 'folder') as CategoryIconId,
    color: (custom?.color || override?.color || builtin?.color || 'slate') as CategoryColorId,
    descKey: builtin?.descKey,
    labelKey: builtin?.labelKey,
  }
}

export async function fetchCategoryCatalog(): Promise<DocumentCategoryDto[]> {
  const items = await api<DocumentCategoryDto[]>('/api/categories/catalog')
  const custom = items.filter((c) => !c.isBuiltin).map((c) => ({
    name: c.name,
    description: c.description,
    icon: c.icon,
    color: c.color,
  }))
  saveCustomCategories(custom)
  return items
}

export async function createCategoryRemote(payload: CustomCategory): Promise<DocumentCategoryDto> {
  return api<DocumentCategoryDto>('/api/categories/catalog', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateCategoryRemote(id: string, payload: CustomCategory): Promise<DocumentCategoryDto> {
  return api<DocumentCategoryDto>(`/api/categories/catalog/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteCategoryRemote(id: string, moveTo?: string): Promise<void> {
  const q = moveTo ? `?moveTo=${encodeURIComponent(moveTo)}` : ''
  await api(`/api/categories/catalog/${id}${q}`, { method: 'DELETE' })
}
