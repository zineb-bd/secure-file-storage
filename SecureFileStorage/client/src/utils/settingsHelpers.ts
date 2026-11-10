import type { StorageConfig } from '@/types'

/** Valeurs alignées sur appsettings.json et FileValidator.cs (lecture seule côté UI). */
export const APP_NAME = 'SecureFileStorage'
export const JWT_EXPIRATION_MINUTES = 60
export const PASSWORD_MIN_LENGTH = 8
export const MAX_FAILED_LOGINS = 5
export const LOCKOUT_MINUTES = 15
export const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024 * 1024
export const STORAGE_QUOTA_BYTES = 10 * 1024 * 1024 * 1024 * 1024

export const ALLOWED_FILE_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.txt', '.csv', '.zip',
  '.mp4', '.webm', '.mkv', '.avi', '.mov', '.m4v', '.wmv',
  '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma',
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

export interface SecuritySignals {
  unresolvedAlerts: number
  antivirusEnabled: boolean
  encryptionActive: boolean
}

export function computeSecurityLevel(signals: SecuritySignals): SecurityLevel {
  if (signals.encryptionActive && signals.antivirusEnabled) return 'strong'
  if (signals.encryptionActive || signals.antivirusEnabled) return 'medium'
  return 'basic'
}

/** Le chiffrement au repos est actif dès qu’un algorithme (AES-GCM…) est configuré, même sans rotation de clé. */
export function isEncryptionActive(
  algorithm: string | null | undefined,
  keyId?: string | null,
  keyIdentifier?: string | null,
) {
  if (keyId || keyIdentifier) return true
  const algo = (algorithm || '').trim()
  return algo.length > 0 && algo.toLowerCase() !== 'none'
}

export function isClamAvEngine(engine: string | null | undefined) {
  return (engine || '').toLowerCase().includes('clamav')
}

export interface ThreatStatLike {
  threatName: string
  count: number
  lastDetectedAt: string
}

export function threatsFromAlerts(
  alerts: { threatName?: string | null; detectedAt: string }[],
): ThreatStatLike[] {
  const map = new Map<string, ThreatStatLike>()
  for (const a of alerts) {
    const name = (a.threatName || '').trim() || 'unknown'
    const prev = map.get(name)
    if (!prev) {
      map.set(name, { threatName: name, count: 1, lastDetectedAt: a.detectedAt })
      continue
    }
    map.set(name, {
      threatName: name,
      count: prev.count + 1,
      lastDetectedAt: a.detectedAt > prev.lastDetectedAt ? a.detectedAt : prev.lastDetectedAt,
    })
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
}

export function latestDetectionAt(
  alerts: { detectedAt: string }[],
  fromStats?: string | null,
) {
  if (fromStats) return fromStats
  return alerts.reduce<string | null>((max, a) => {
    if (!max || a.detectedAt > max) return a.detectedAt
    return max
  }, null)
}

export function encryptionAlgorithmLabel(algorithm: string | null | undefined, t: (k: string) => string) {
  const map: Record<string, string> = {
    AesGcm: t('settings.encryptionAlgorithm.aesGcm'),
    ChaCha20Poly1305: t('settings.encryptionAlgorithm.chacha20'),
    AesCbcLegacy: t('settings.encryptionAlgorithm.aesCbc'),
  }
  return map[algorithm || ''] || (algorithm ? algorithm : t('settings.notAvailable'))
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
  if (bytes < 1024 * 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  return `${(bytes / (1024 * 1024 * 1024 * 1024)).toFixed(2)} TB`
}

export function storageUsagePercent(used: number, quota: number) {
  if (!quota || quota <= 0) return used > 0 ? 1 : 0
  return Math.min(Math.round((used / quota) * 100), 100)
}
