import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiUrl } from '@/api/baseUrl'
import { api } from '@/api/client'
import { SettingsSkeleton } from '@/components/settings/SettingsSkeleton'
import { IconShield } from '@/components/profile/ProfileIcons'
import {
  IconClock,
  IconFileStack,
  IconFilter,
  IconList,
  IconRestore,
  IconSearch,
  IconTrash,
  IconUsers,
} from '@/components/categories/CategoryIcons'
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/i18n/I18nContext'
import { fmtDate, fmtSize } from '@/utils/format'
import {
  ALLOWED_FILE_EXTENSIONS,
  APP_NAME,
  computeSecurityLevel,
  formatBytesShort,
  healthToStatus,
  JWT_EXPIRATION_MINUTES,
  MAX_FILE_SIZE_BYTES,
  providerLabel,
  SETTINGS_SECTIONS,
  storageToForm,
  storageUsagePercent,
  type SettingsSection,
  type StorageFormState,
  type SystemStatus,
} from '@/utils/settingsHelpers'
import type { AntivirusAlert, DashboardStats, StorageConfig } from '@/types'

interface HealthResponse {
  status: string
  timestamp: string
}

function StatusIndicator({ status, label }: { status: SystemStatus; label: string }) {
  const icon = status === 'operational' ? '✓' : status === 'warning' ? '⚠' : '✕'
  return (
    <span className={`settings-status settings-status-${status}`}>
      <span className="settings-status-icon" aria-hidden>{icon}</span>
      {label}
    </span>
  )
}

function FeatureRow({
  name,
  description,
  enabled,
  serverManaged,
  t,
}: {
  name: string
  description: string
  enabled: boolean
  serverManaged?: boolean
  t: (k: string) => string
}) {
  return (
    <div className="settings-feature-row">
      <div className="settings-feature-info">
        <strong>{name}</strong>
        <p>{description}</p>
      </div>
      <div className="settings-feature-status">
        {serverManaged && (
          <span className="settings-badge settings-badge-muted">{t('settings.serverManaged')}</span>
        )}
        <span className={`settings-badge settings-badge-${enabled ? 'enabled' : 'disabled'}`}>
          {enabled ? t('settings.enabled') : t('settings.disabled')}
        </span>
      </div>
    </div>
  )
}

function ReadOnlyRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="settings-field">
      <label className="settings-label">{label}</label>
      <div className="settings-readonly">{value}</div>
      {hint && <p className="settings-hint">{hint}</p>}
    </div>
  )
}

interface SettingsViewProps {
  onError?: (msg: string) => void
}

export function SettingsView({ onError }: SettingsViewProps) {
  const { t, locale, lang, setLang } = useI18n()

  const [section, setSection] = useState<SettingsSection>('general')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [toast, setToast] = useState('')

  const [config, setConfig] = useState<StorageConfig | null>(null)
  const [storageForm, setStorageForm] = useState<StorageFormState | null>(null)
  const [alerts, setAlerts] = useState<AntivirusAlert[]>([])
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null)
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [lastKeyRotation, setLastKeyRotation] = useState<string | null>(null)
  const [lastKeyId, setLastKeyId] = useState<string | null>(null)

  const [draftLang, setDraftLang] = useState(lang)
  const [rotateConfirm, setRotateConfirm] = useState(false)
  const [rotating, setRotating] = useState(false)

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 4200)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [storage, avAlerts, stats, healthRes] = await Promise.all([
        api<StorageConfig>('/api/admin/storage'),
        api<AntivirusAlert[]>('/api/admin/security/antivirus-alerts'),
        api<DashboardStats>('/api/dashboard'),
        fetch(apiUrl('/health')).then((r) => r.json() as Promise<HealthResponse>),
      ])
      setConfig(storage)
      setStorageForm(storageToForm(storage))
      setAlerts(avAlerts || [])
      setDashboard(stats)
      setHealth(healthRes)
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('msg.loadProfileError')
      onError?.(msg)
    } finally {
      setLoading(false)
    }
  }, [t, onError])

  useEffect(() => {
    void load()
  }, [load])

  const securityLevel = useMemo(() => computeSecurityLevel(alerts), [alerts])

  const checkSystemStatus = async () => {
    setChecking(true)
    try {
      const [healthRes, storageRes, avRes] = await Promise.all([
        fetch(apiUrl('/health')).then((r) => r.json() as Promise<HealthResponse>),
        api<StorageConfig>('/api/admin/storage'),
        api<AntivirusAlert[]>('/api/admin/security/antivirus-alerts'),
      ])
      setHealth(healthRes)
      setConfig(storageRes)
      setAlerts(avRes || [])
      showToast(t('settings.systemChecked'))
    } catch (e) {
      onError?.(e instanceof Error ? e.message : t('settings.saveFailed'))
    } finally {
      setChecking(false)
    }
  }

  const saveGeneral = () => {
    setLang(draftLang)
    showToast(t('settings.saved'))
  }

  const saveStorage = async () => {
    if (!storageForm) return
    setSaving(true)
    try {
      const body: Record<string, string | undefined> = {
        providerType: storageForm.providerType,
        databaseProvider: storageForm.databaseProvider,
        basePath: storageForm.basePath,
        s3Endpoint: storageForm.s3Endpoint || undefined,
        s3Bucket: storageForm.s3Bucket || undefined,
      }
      if (storageForm.s3AccessKey) body.s3AccessKey = storageForm.s3AccessKey
      if (storageForm.s3SecretKey) body.s3SecretKey = storageForm.s3SecretKey

      const updated = await api<StorageConfig>('/api/admin/storage', {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      setConfig(updated)
      setStorageForm(storageToForm(updated))
      showToast(t('settings.saved'))
    } catch (e) {
      onError?.(e instanceof Error ? e.message : t('settings.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const rotateKey = async () => {
    setRotating(true)
    try {
      const r = await api<{ keyIdentifier: string; rotatedAt: string }>(
        '/api/admin/security/rotate-key',
        { method: 'POST' }
      )
      setLastKeyId(r.keyIdentifier)
      setLastKeyRotation(r.rotatedAt)
      setRotateConfirm(false)
      showToast(t('settings.keyRotated'))
    } catch (e) {
      onError?.(e instanceof Error ? e.message : t('settings.saveFailed'))
    } finally {
      setRotating(false)
    }
  }

  const sectionIcon = (id: SettingsSection) => {
    const size = 18
    switch (id) {
      case 'general': return <IconList size={size} />
      case 'security':
      case 'documentSecurity': return <IconShield size={size} />
      case 'storage': return <IconFileStack size={size} />
      case 'documents': return <IconSearch size={size} />
      case 'trashArchive': return <IconTrash size={size} />
      case 'notifications': return <IconUsers size={size} />
      case 'system': return <IconClock size={size} />
      default: return <IconFilter size={size} />
    }
  }

  const navItem = (id: SettingsSection) => (
    <button
      key={id}
      type="button"
      className={`settings-nav-item${section === id ? ' active' : ''}`}
      onClick={() => setSection(id)}
    >
      {sectionIcon(id)}
      <span>{t(`settings.nav.${id}`)}</span>
    </button>
  )

  const renderGeneral = () => (
    <div className="settings-section">
      <div className="settings-section-header">
        <h3>{t('settings.nav.general')}</h3>
        <p>{t('settings.generalDesc')}</p>
      </div>
      <div className="settings-card">
        <ReadOnlyRow label={t('settings.appName')} value={APP_NAME} hint={t('settings.serverManaged')} />
        <ReadOnlyRow label={t('settings.appDescription')} value={t('settings.appDescriptionValue')} hint={t('settings.serverManaged')} />
        <div className="settings-field">
          <label className="settings-label" htmlFor="settings-lang">{t('settings.language')}</label>
          <select id="settings-lang" value={draftLang} onChange={(e) => setDraftLang(e.target.value as 'fr' | 'en')}>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
          <p className="settings-hint">{t('settings.languageHint')}</p>
        </div>
        <ReadOnlyRow
          label={t('settings.timezone')}
          value={Intl.DateTimeFormat().resolvedOptions().timeZone}
          hint={t('settings.timezoneHint')}
        />
        <div className="settings-actions">
          <button type="button" className="btn btn-primary" onClick={saveGeneral} disabled={draftLang === lang}>
            {t('settings.saveChanges')}
          </button>
        </div>
      </div>
    </div>
  )

  const renderSecurity = () => (
    <div className="settings-section">
      <div className="settings-section-header">
        <h3>{t('settings.nav.security')}</h3>
        <p>{t('settings.securityDesc')}</p>
      </div>

      <div className="settings-security-level">
        <div>
          <span className="settings-security-level-label">{t('settings.securityLevel')}</span>
          <strong className={`settings-security-level-value level-${securityLevel}`}>
            {t(`settings.securityLevel.${securityLevel}`)}
          </strong>
        </div>
        <IconShield size={28} />
      </div>

      <div className="settings-card">
        <FeatureRow
          name={t('settings.jwtAuth')}
          description={t('settings.jwtAuthDesc')}
          enabled
          serverManaged
          t={t}
        />
        <ReadOnlyRow
          label={t('settings.sessionExpiration')}
          value={t('settings.minutesValue', { count: String(JWT_EXPIRATION_MINUTES) })}
          hint={t('settings.serverManaged')}
        />
        <ReadOnlyRow
          label={t('settings.passwordPolicy')}
          value={t('settings.passwordPolicyValue')}
          hint={t('settings.serverManaged')}
        />
        <ReadOnlyRow
          label={t('settings.maxLoginAttempts')}
          value={t('settings.notConfigured')}
          hint={t('settings.serverManaged')}
        />
        <ReadOnlyRow
          label={t('settings.accountLockout')}
          value={t('settings.notConfigured')}
          hint={t('settings.serverManaged')}
        />
        <FeatureRow
          name={t('settings.twoFactor')}
          description={t('settings.twoFactorDesc')}
          enabled={false}
          t={t}
        />
      </div>

      <div className="settings-card settings-card-highlight">
        <div className="settings-card-title-row">
          <h4>{t('settings.encryptionKeys')}</h4>
          <span className="settings-badge settings-badge-enabled">{t('settings.active')}</span>
        </div>
        <p className="settings-card-desc">{t('settings.encryptionKeysDesc')}</p>
        <dl className="settings-dl">
          <div>
            <dt>{t('settings.keyStatus')}</dt>
            <dd>{t('settings.keyStatusActive')}</dd>
          </div>
          <div>
            <dt>{t('settings.lastKeyRotation')}</dt>
            <dd>{lastKeyRotation ? fmtDate(lastKeyRotation, locale) : t('settings.notAvailable')}</dd>
          </div>
          {lastKeyId && (
            <div>
              <dt>{t('settings.keyIdentifier')}</dt>
              <dd className="settings-mono">{lastKeyId}</dd>
            </div>
          )}
        </dl>
        <div className="settings-actions">
          <button type="button" className="btn btn-warning" onClick={() => setRotateConfirm(true)}>
            {t('settings.rotateKey')}
          </button>
        </div>
      </div>
    </div>
  )

  const renderDocumentSecurity = () => (
    <div className="settings-section">
      <div className="settings-section-header">
        <h3>{t('settings.nav.documentSecurity')}</h3>
        <p>{t('settings.documentSecurityDesc')}</p>
      </div>
      <div className="settings-card">
        <FeatureRow name={t('settings.encryptionAtRest')} description={t('settings.encryptionAtRestDesc')} enabled serverManaged t={t} />
        <FeatureRow name={t('settings.aes256')} description={t('settings.aes256Desc')} enabled serverManaged t={t} />
        <FeatureRow name={t('settings.sha256')} description={t('settings.sha256Desc')} enabled serverManaged t={t} />
        <FeatureRow
          name={t('settings.antivirusScan')}
          description={t('settings.antivirusScanDesc')}
          enabled
          serverManaged
          t={t}
        />
        <FeatureRow name={t('settings.digitalSignature')} description={t('settings.digitalSignatureDesc')} enabled={false} t={t} />
      </div>
      {alerts.length > 0 && (
        <div className="settings-card settings-card-warning">
          <h4>{t('settings.antivirusAlerts')}</h4>
          <ul className="settings-alert-list">
            {alerts.slice(0, 5).map((a) => (
              <li key={a.id}>
                <strong>{a.fileName}</strong> — {a.threatName}
                <time>{fmtDate(a.detectedAt, locale)}</time>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )

  const renderStorage = () => {
    const used = dashboard?.storageUsedBytes ?? 0
    const logical = dashboard?.logicalStorageBytes ?? 0
    const pct = storageUsagePercent(used, logical)

    return (
      <div className="settings-section">
        <div className="settings-section-header">
          <h3>{t('settings.nav.storage')}</h3>
          <p>{t('settings.storageDesc')}</p>
        </div>

        <div className="settings-card">
          <h4>{t('settings.storageUsage')}</h4>
          <div className="settings-storage-stats">
            <div>
              <span className="settings-stat-label">{t('settings.usedStorage')}</span>
              <strong>{fmtSize(used)}</strong>
            </div>
            <div>
              <span className="settings-stat-label">{t('settings.logicalStorage')}</span>
              <strong>{fmtSize(logical)}</strong>
            </div>
            {dashboard && dashboard.bytesSavedByDedup > 0 && (
              <div>
                <span className="settings-stat-label">{t('stat.saved')}</span>
                <strong>{formatBytesShort(dashboard.bytesSavedByDedup)}</strong>
              </div>
            )}
          </div>
          <div className="settings-progress-wrap">
            <div className="settings-progress-bar">
              <div className="settings-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="settings-progress-label">{pct}%</span>
          </div>
          <p className="settings-hint">{t('settings.storageUsageHint')}</p>
        </div>

        {storageForm && (
          <div className="settings-card">
            <h4>{t('settings.storageConfig')}</h4>
            <div className="settings-form-grid">
              <div className="settings-field">
                <label className="settings-label" htmlFor="storage-provider">{t('settings.storageType')}</label>
                <select
                  id="storage-provider"
                  value={storageForm.providerType}
                  onChange={(e) => setStorageForm((f) => f && { ...f, providerType: e.target.value })}
                >
                  <option value="LocalFileSystem">{t('settings.storage.local')}</option>
                  <option value="S3Compatible">{t('settings.storage.s3')}</option>
                  <option value="Nas">{t('settings.storage.nas')}</option>
                </select>
              </div>
              <div className="settings-field">
                <label className="settings-label" htmlFor="storage-db">{t('settings.databaseProvider')}</label>
                <select
                  id="storage-db"
                  value={storageForm.databaseProvider}
                  onChange={(e) => setStorageForm((f) => f && { ...f, databaseProvider: e.target.value })}
                >
                  <option value="PostgreSql">PostgreSQL</option>
                  <option value="SqlServer">SQL Server</option>
                </select>
              </div>
              <div className="settings-field settings-field-full">
                <label className="settings-label" htmlFor="storage-path">{t('settings.storageLocation')}</label>
                <input
                  id="storage-path"
                  type="text"
                  value={storageForm.basePath}
                  onChange={(e) => setStorageForm((f) => f && { ...f, basePath: e.target.value })}
                />
              </div>
              {storageForm.providerType === 'S3Compatible' && (
                <>
                  <div className="settings-field">
                    <label className="settings-label" htmlFor="s3-endpoint">S3 Endpoint</label>
                    <input
                      id="s3-endpoint"
                      type="text"
                      value={storageForm.s3Endpoint}
                      onChange={(e) => setStorageForm((f) => f && { ...f, s3Endpoint: e.target.value })}
                    />
                  </div>
                  <div className="settings-field">
                    <label className="settings-label" htmlFor="s3-bucket">S3 Bucket</label>
                    <input
                      id="s3-bucket"
                      type="text"
                      value={storageForm.s3Bucket}
                      onChange={(e) => setStorageForm((f) => f && { ...f, s3Bucket: e.target.value })}
                    />
                  </div>
                  <div className="settings-field">
                    <label className="settings-label" htmlFor="s3-key">{t('settings.s3AccessKey')}</label>
                    <input
                      id="s3-key"
                      type="password"
                      autoComplete="off"
                      placeholder="••••••••"
                      value={storageForm.s3AccessKey}
                      onChange={(e) => setStorageForm((f) => f && { ...f, s3AccessKey: e.target.value })}
                    />
                  </div>
                  <div className="settings-field">
                    <label className="settings-label" htmlFor="s3-secret">{t('settings.s3SecretKey')}</label>
                    <input
                      id="s3-secret"
                      type="password"
                      autoComplete="off"
                      placeholder="••••••••"
                      value={storageForm.s3SecretKey}
                      onChange={(e) => setStorageForm((f) => f && { ...f, s3SecretKey: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>
            {config && (
              <p className="settings-hint">
                {t('settings.lastUpdated')}: {fmtDate(config.updatedAt, locale)}
              </p>
            )}
            <div className="settings-actions">
              <button type="button" className="btn btn-primary" onClick={() => void saveStorage()} disabled={saving}>
                {saving ? t('profile.saving') : t('settings.saveChanges')}
              </button>
            </div>
          </div>
        )}

        {config && (
          <div className="settings-card settings-card-muted">
            <ReadOnlyRow label={t('settings.storageType')} value={providerLabel(config.providerType, t)} />
            <ReadOnlyRow label={t('settings.storageLocation')} value={config.basePath} />
          </div>
        )}
      </div>
    )
  }

  const renderDocuments = () => (
    <div className="settings-section">
      <div className="settings-section-header">
        <h3>{t('settings.nav.documents')}</h3>
        <p>{t('settings.documentsDesc')}</p>
      </div>
      <div className="settings-card">
        <ReadOnlyRow
          label={t('settings.maxFileSize')}
          value={`${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`}
          hint={t('settings.serverManaged')}
        />
        <div className="settings-field">
          <span className="settings-label">{t('settings.allowedTypes')}</span>
          <div className="settings-tag-list">
            {ALLOWED_FILE_EXTENSIONS.map((ext) => (
              <span key={ext} className="settings-tag">{ext}</span>
            ))}
          </div>
          <p className="settings-hint">{t('settings.serverManaged')}</p>
        </div>
        <ReadOnlyRow label={t('settings.maxVersions')} value={t('settings.unlimited')} hint={t('settings.serverManaged')} />
        <FeatureRow name={t('settings.autoArchiving')} description={t('settings.autoArchivingDesc')} enabled={false} t={t} />
        <FeatureRow name={t('settings.autoDeletion')} description={t('settings.autoDeletionDesc')} enabled={false} t={t} />
        <ReadOnlyRow label={t('settings.retentionPeriod')} value={t('settings.notConfigured')} hint={t('settings.serverManaged')} />
      </div>
    </div>
  )

  const renderTrashArchive = () => (
    <div className="settings-section">
      <div className="settings-section-header">
        <h3>{t('settings.nav.trashArchive')}</h3>
        <p>{t('settings.trashArchiveDesc')}</p>
      </div>
      <div className="settings-card">
        <FeatureRow name={t('settings.trashAutoDelete')} description={t('settings.trashAutoDeleteDesc')} enabled={false} t={t} />
        <ReadOnlyRow label={t('settings.trashRetention')} value={t('settings.notConfigured')} hint={t('settings.serverManaged')} />
        <FeatureRow name={t('settings.autoArchiving')} description={t('settings.autoArchivingDesc')} enabled={false} t={t} />
      </div>
      <div className="settings-warning-banner">
        <IconTrash size={20} />
        <p>{t('settings.permanentDeleteWarning')}</p>
      </div>
    </div>
  )

  const renderNotifications = () => (
    <div className="settings-section">
      <div className="settings-section-header">
        <h3>{t('settings.nav.notifications')}</h3>
        <p>{t('settings.notificationsDesc')}</p>
      </div>
      <div className="settings-info-banner">
        <p>{t('settings.notificationsNotConfigurable')}</p>
      </div>
      <div className="settings-card">
        {(['shared', 'downloaded', 'accessRequest', 'restored', 'securityAlert'] as const).map((key) => (
          <div key={key} className="settings-switch-row">
            <div>
              <strong>{t(`settings.notif.${key}`)}</strong>
              <p>{t(`settings.notif.${key}Desc`)}</p>
            </div>
            <label className="profile-switch settings-switch-disabled">
              <input type="checkbox" checked disabled readOnly />
              <span className="profile-switch-slider" />
            </label>
          </div>
        ))}
      </div>
    </div>
  )

  const renderSystem = () => {
    const dbStatus = healthToStatus(health?.status === 'healthy', false)
    const storageStatus = healthToStatus(!!config, false)
    const avStatus = healthToStatus(true, alerts.length > 0)
    const encStatus: SystemStatus = 'operational'

    return (
      <div className="settings-section">
        <div className="settings-section-header">
          <h3>{t('settings.nav.system')}</h3>
          <p>{t('settings.systemDesc')}</p>
        </div>
        <div className="settings-actions settings-actions-top">
          <button type="button" className="btn btn-outline" onClick={() => void checkSystemStatus()} disabled={checking}>
            <IconRestore size={16} />
            {checking ? t('settings.checking') : t('settings.checkSystemStatus')}
          </button>
        </div>
        <div className="settings-card">
          <dl className="settings-system-grid">
            <div>
              <dt>{t('settings.appVersion')}</dt>
              <dd>1.0.0</dd>
            </div>
            <div>
              <dt>{t('settings.apiVersion')}</dt>
              <dd>v1</dd>
            </div>
            <div>
              <dt>{t('settings.databaseStatus')}</dt>
              <dd><StatusIndicator status={dbStatus} label={t(`settings.status.${dbStatus}`)} /></dd>
            </div>
            <div>
              <dt>{t('settings.storageStatus')}</dt>
              <dd><StatusIndicator status={storageStatus} label={t(`settings.status.${storageStatus}`)} /></dd>
            </div>
            <div>
              <dt>{t('settings.antivirusStatus')}</dt>
              <dd><StatusIndicator status={avStatus} label={t(`settings.status.${avStatus}`)} /></dd>
            </div>
            <div>
              <dt>{t('settings.encryptionStatus')}</dt>
              <dd><StatusIndicator status={encStatus} label={t(`settings.status.${encStatus}`)} /></dd>
            </div>
          </dl>
          {health && (
            <p className="settings-hint">
              {t('settings.lastHealthCheck')}: {fmtDate(health.timestamp, locale)}
            </p>
          )}
        </div>
        <div className="settings-card settings-card-muted">
          <h4>{t('settings.backupRecovery')}</h4>
          <p className="settings-hint">{t('settings.backupNotAvailable')}</p>
        </div>
      </div>
    )
  }

  const renderSection = () => {
    switch (section) {
      case 'general': return renderGeneral()
      case 'security': return renderSecurity()
      case 'documentSecurity': return renderDocumentSecurity()
      case 'storage': return renderStorage()
      case 'documents': return renderDocuments()
      case 'trashArchive': return renderTrashArchive()
      case 'notifications': return renderNotifications()
      case 'system': return renderSystem()
      default: return null
    }
  }

  if (loading) return <SettingsSkeleton />

  return (
    <div className="settings-view">
      {toast && <div className="profile-toast profile-toast-success" role="status">{toast}</div>}

      <nav className="settings-nav-mobile" aria-label={t('settings.navigation')}>
        {SETTINGS_SECTIONS.map(navItem)}
      </nav>

      <div className="settings-layout">
        <aside className="settings-nav" aria-label={t('settings.navigation')}>
          {SETTINGS_SECTIONS.map(navItem)}
        </aside>
        <div className="settings-content">{renderSection()}</div>
      </div>

      {rotateConfirm && (
        <Modal title={t('settings.rotateKeyConfirmTitle')} onClose={() => setRotateConfirm(false)}>
          <p>{t('settings.rotateKeyConfirmDesc')}</p>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={() => setRotateConfirm(false)}>
              {t('btn.cancel')}
            </button>
            <button type="button" className="btn btn-warning" onClick={() => void rotateKey()} disabled={rotating}>
              {rotating ? t('profile.saving') : t('settings.rotateKey')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
