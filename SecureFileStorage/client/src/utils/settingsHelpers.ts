import type { AntivirusAlert, StorageConfig } from '@/types'

/** Valeurs alignées sur appsettings.json et FileValidator.cs (lecture seule côté UI). */
export const APP_NAME = 'SecureFileStorage'
export const JWT_EXPIRATION_MINUTES = 60
export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024

export const ALLOWED_FILE_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.txt', '.csv', '.zip',
] as const

export type SettingsSection =
  | 'general'
  | 'security'
  | 'documentSecurity'
  | 'storage'
  | 'documents'
  | 'trashArchive'
  | 'notifications'
  | 'system'

export const SETTINGS_SECTIONS: SettingsSection[] = [
  'general',
  'security',
  'documentSecurity',
  'storage',
  'documents',
  'trashArchive',
  'notifications',
  'system',
]

export function providerLabel(type: string, t: (k: string) => string) {
  const map: Record<string, string> = {
    LocalFileSystem: t('settings.storage.local'),
    S3Compatible: t('settings.storage.s3'),
    Nas: t('settings.storage.nas'),
  }
  return map[type] || type
}

export type SecurityLevel = 'strong' | 'medium' | 'basic'

export function computeSecurityLevel(alerts: AntivirusAlert[]): SecurityLevel {
  if (alerts.length > 0) return 'medium'
  return 'strong'
}

export type SystemStatus = 'operational' | 'warning' | 'error'

export function healthToStatus(healthy: boolean, warning?: boolean): SystemStatus {
  if (!healthy) return 'error'
  if (warning) return 'warning'
  return 'operational'
}

export interface StorageFormState {
  providerType: string
  databaseProvider: string
  basePath: string
  s3Endpoint: string
  s3Bucket: string
  s3AccessKey: string
  s3SecretKey: string
}

export function storageToForm(config: StorageConfig): StorageFormState {
  return {
    providerType: config.providerType,
    databaseProvider: config.databaseProvider,
    basePath: config.basePath,
    s3Endpoint: config.s3Endpoint || '',
    s3Bucket: config.s3Bucket || '',
    s3AccessKey: '',
    s3SecretKey: '',
  }
}

export function formatBytesShort(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function storageUsagePercent(used: number, logical: number) {
  if (!logical || logical <= 0) return Math.min(used > 0 ? 15 : 0, 100)
  return Math.min(Math.round((used / logical) * 100), 100)
}
