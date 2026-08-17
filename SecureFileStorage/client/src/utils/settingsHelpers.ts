import type { AntivirusAlert, StorageConfig } from '@/types'

/** Valeurs alignées sur appsettings.json et FileValidator.cs (lecture seule côté UI). */
export const APP_NAME = 'SecureFileStorage'
export const JWT_EXPIRATION_MINUTES = 60
export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024

export const ALLOWED_FILE_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.txt', '.csv', '.zip',
] as const

export type SettingsSection = 'general' | 'security' | 'storage' | 'system'

export const SETTINGS_SECTIONS: SettingsSection[] = [
  'general',
  'security',
  'storage',
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
  connectionString: string
  compressionEnabled: boolean
  encryptionAlgorithm: string
  s3Endpoint: string
  s3Bucket: string
  s3AccessKey: string
  s3SecretKey: string
}

export const STORAGE_PROVIDERS = [
  { value: 'LocalFileSystem', labelKey: 'settings.storage.local' },
  { value: 'S3Compatible', labelKey: 'settings.storage.s3' },
  { value: 'Nas', labelKey: 'settings.storage.nas' },
] as const

export const ENCRYPTION_ALGORITHMS = [
  { value: 'AesGcm', labelKey: 'settings.encryptionAlgorithm.aesGcm' },
  { value: 'ChaCha20Poly1305', labelKey: 'settings.encryptionAlgorithm.chacha20' },
] as const

export const DATABASE_PROVIDERS = [
  { value: 'PostgreSql', labelKey: 'settings.db.postgresql' },
  { value: 'Oracle', labelKey: 'settings.db.oracle' },
  { value: 'SqlServer', labelKey: 'settings.db.sqlserver' },
  { value: 'MySql', labelKey: 'settings.db.mysql' },
  { value: 'Other', labelKey: 'settings.db.other' },
] as const

export function connectionPlaceholder(provider: string) {
  switch (provider) {
    case 'PostgreSql':
      return 'Host=localhost;Port=5432;Database=securefilestorage;Username=postgres;Password=***'
    case 'Oracle':
      return 'User Id=app;Password=***;Data Source=localhost:1521/ORCL'
    case 'SqlServer':
      return 'Server=localhost;Database=SecureFileStorage;User Id=sa;Password=***;TrustServerCertificate=True'
    case 'MySql':
      return 'Server=localhost;Port=3306;Database=securefilestorage;User=root;Password=***'
    default:
      return 'Provider-specific connection string…'
  }
}

export function storageToForm(config: StorageConfig): StorageFormState {
  return {
    providerType: config.providerType,
    databaseProvider: config.databaseProvider || 'PostgreSql',
    basePath: config.basePath || './storage',
    connectionString: config.connectionString || '',
    compressionEnabled: config.compressionEnabled !== false,
    encryptionAlgorithm: config.encryptionAlgorithm || 'AesGcm',
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
