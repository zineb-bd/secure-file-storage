import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiUrl } from '@/api/baseUrl'
import { api } from '@/api/client'
import { SettingsSkeleton } from '@/components/settings/SettingsSkeleton'
import { IconShield } from '@/components/profile/ProfileIcons'
import {
  IconClock,
  IconFileStack,
  IconList,
  IconRestore,
} from '@/components/categories/CategoryIcons'
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/i18n/I18nContext'
import { fmtDate, fmtSize } from '@/utils/format'
import {
  computeSecurityLevel,
  connectionPlaceholder,
  DATABASE_PROVIDERS,
  formatBytesShort,
  healthToStatus,
  JWT_EXPIRATION_MINUTES,
  SETTINGS_SECTIONS,
  storageToForm,
  storageUsagePercent,
  type SettingsSection,
  type StorageFormState,
  type SystemStatus,
} from '@/utils/settingsHelpers'
import type { AntivirusAlert, AntivirusStats, DashboardStats, StorageConfig } from '@/types'

interface HealthResponse {
  status: string
  timestamp: string
}

function formatScanMs(ms?: number | null) {
  if (ms == null || Number.isNaN(ms)) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
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
  t,
}: {
  name: string
  description: string
  enabled: boolean
  t: (k: string) => string
}) {
  return (
    <div className="settings-feature-row">
      <div className="settings-feature-info">
        <strong>{name}</strong>
        <p>{description}</p>
      </div>
      <span className={`settings-badge settings-badge-${enabled ? 'enabled' : 'disabled'}`}>
        {enabled ? t('settings.enabled') : t('settings.disabled')}
      </span>
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
  const [avStats, setAvStats] = useState<AntivirusStats | null>(null)
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
      const [storage, avAlerts, avStatsRes, stats, healthRes] = await Promise.all([
        api<StorageConfig>('/api/admin/storage'),
        api<AntivirusAlert[]>('/api/admin/security/antivirus-alerts?take=50'),
        api<AntivirusStats>('/api/admin/security/antivirus-stats'),
        api<DashboardStats>('/api/dashboard'),
        fetch(apiUrl('/health')).then((r) => r.json() as Promise<HealthResponse>),
      ])
      setConfig(storage)
      setStorageForm(storageToForm(storage))
      setAlerts(avAlerts || [])
      setAvStats(avStatsRes)
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
      const [healthRes, storageRes, avRes, avStatsRes] = await Promise.all([
        fetch(apiUrl('/health')).then((r) => r.json() as Promise<HealthResponse>),
        api<StorageConfig>('/api/admin/storage'),
        api<AntivirusAlert[]>('/api/admin/security/antivirus-alerts?take=50'),
        api<AntivirusStats>('/api/admin/security/antivirus-stats'),
      ])
      setHealth(healthRes)
      setConfig(storageRes)
      setAlerts(avRes || [])
      setAvStats(avStatsRes)
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
    if (!storageForm.databaseProvider) {
      onError?.(t('settings.db.providerRequired'))
      return
    }
    if (!storageForm.connectionString.trim()) {
      onError?.(t('settings.db.connectionRequired'))
      return
    }
    setSaving(true)
    try {
      const body = {
        providerType: storageForm.providerType || config?.providerType || 'LocalFileSystem',
        databaseProvider: storageForm.databaseProvider,
        basePath: storageForm.basePath || config?.basePath || './storage',
        connectionString: storageForm.connectionString.trim(),
        s3Endpoint: storageForm.s3Endpoint || undefined,
        s3Bucket: storageForm.s3Bucket || undefined,
        s3AccessKey: storageForm.s3AccessKey || undefined,
        s3SecretKey: storageForm.s3SecretKey || undefined,
      }

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
      case 'general':
        return <IconList size={size} />
      case 'security':
        return <IconShield size={size} />
      case 'storage':
        return <IconFileStack size={size} />
      case 'system':
        return <IconClock size={size} />
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
        <div className="settings-field">
          <label className="settings-label" htmlFor="settings-lang">{t('settings.language')}</label>
          <select
            id="settings-lang"
            value={draftLang}
            onChange={(e) => setDraftLang(e.target.value as 'fr' | 'en')}
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
          <p className="settings-hint">{t('settings.languageHint')}</p>
        </div>
        <div className="settings-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={saveGeneral}
            disabled={draftLang === lang}
          >
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
          t={t}
        />
        <ReadOnlyRow
          label={t('settings.sessionExpiration')}
          value={t('settings.minutesValue', { count: String(JWT_EXPIRATION_MINUTES) })}
        />
        <FeatureRow
          name={t('settings.encryptionAtRest')}
          description={t('settings.encryptionAtRestDesc')}
          enabled
          t={t}
        />
        <FeatureRow
          name={t('settings.antivirusScan')}
          description={t('settings.antivirusScanDesc')}
          enabled={avStats?.enabled ?? false}
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

      <div className="settings-card">
        <div className="settings-card-title-row">
          <h4>{t('settings.av.performanceTitle')}</h4>
          <span className={`settings-badge ${avStats?.enabled ? 'settings-badge-enabled' : 'settings-badge-disabled'}`}>
            {avStats?.enabled ? t('settings.active') : t('settings.inactive')}
          </span>
        </div>
        <p className="settings-card-desc">{t('settings.av.performanceDesc')}</p>
        <div className="settings-av-kpis">
          <div className="settings-av-kpi">
            <span className="settings-stat-label">{t('settings.av.engine')}</span>
            <strong>{avStats ? `${avStats.engine}` : '—'}</strong>
            {avStats && (
              <span className="settings-av-kpi-sub">{avStats.host}:{avStats.port}</span>
            )}
          </div>
          <div className="settings-av-kpi">
            <span className="settings-stat-label">{t('settings.av.avgScan')}</span>
            <strong>{formatScanMs(avStats?.averageScanMs)}</strong>
          </div>
          <div className="settings-av-kpi">
            <span className="settings-stat-label">{t('settings.av.lastScan')}</span>
            <strong>{formatScanMs(avStats?.lastScanMs)}</strong>
          </div>
          <div className="settings-av-kpi">
            <span className="settings-stat-label">{t('settings.av.maxScan')}</span>
            <strong>{formatScanMs(avStats?.maxScanMs)}</strong>
          </div>
          <div className="settings-av-kpi">
            <span className="settings-stat-label">{t('settings.av.sessionScans')}</span>
            <strong>{avStats?.totalScansSession ?? 0}</strong>
            <span className="settings-av-kpi-sub">
              {t('settings.av.sessionBreakdown', {
                clean: String(avStats?.cleanCountSession ?? 0),
                infected: String(avStats?.infectedCountSession ?? 0),
                error: String(avStats?.errorCountSession ?? 0),
                skipped: String(avStats?.skippedCountSession ?? 0),
              })}
            </span>
          </div>
          <div className="settings-av-kpi">
            <span className="settings-stat-label">{t('settings.av.cleanDocs')}</span>
            <strong>
              {avStats?.cleanDocuments ?? 0}
              <span className="settings-av-kpi-muted">
                {' / '}
                {avStats?.documentsScanned ?? 0}
              </span>
            </strong>
          </div>
        </div>
        {(avStats?.topThreats?.length ?? 0) > 0 && (
          <div className="settings-av-threats">
            <h5>{t('settings.av.topThreats')}</h5>
            <ul className="settings-av-threat-list">
              {avStats!.topThreats.map((th) => (
                <li key={th.threatName}>
                  <span className="settings-av-threat-name">{th.threatName}</span>
                  <span className="settings-av-threat-count">{th.count}</span>
                  <time>{fmtDate(th.lastDetectedAt, locale)}</time>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className={`settings-card ${(avStats?.unresolvedAlerts ?? alerts.length) > 0 ? 'settings-card-warning' : ''}`}>
        <div className="settings-card-title-row">
          <h4>{t('settings.av.detectionsTitle')}</h4>
          <span className="settings-badge settings-badge-muted">
            {t('settings.av.detectionsCount', {
              total: String(avStats?.totalAlerts ?? alerts.length),
              open: String(avStats?.unresolvedAlerts ?? alerts.filter((a) => !a.isResolved).length),
            })}
          </span>
        </div>
        <p className="settings-card-desc">{t('settings.av.detectionsDesc')}</p>
        {avStats?.lastDetectionAt && (
          <p className="settings-hint">
            {t('settings.av.lastDetection')}: {fmtDate(avStats.lastDetectionAt, locale)}
          </p>
        )}
        {alerts.length === 0 ? (
          <p className="settings-av-empty">{t('settings.av.noDetections')}</p>
        ) : (
          <ul className="settings-av-detection-list">
            {alerts.map((a) => (
              <li key={a.id} className={a.isResolved ? 'resolved' : 'open'}>
                <div className="settings-av-detection-main">
                  <strong className="settings-av-detection-threat">{a.threatName}</strong>
                  <span className={`settings-badge ${a.isResolved ? 'settings-badge-muted' : 'settings-badge-disabled'}`}>
                    {a.isResolved ? t('settings.av.resolved') : t('settings.av.open')}
                  </span>
                </div>
                <div className="settings-av-detection-file">{a.fileName}</div>
                {a.details && (
                  <div className="settings-av-detection-details" title={a.details}>
                    {a.details}
                  </div>
                )}
                <time>{fmtDate(a.detectedAt, locale)}</time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )

  const renderStorage = () => {
    const used = dashboard?.storageUsedBytes ?? 0
    const logical = dashboard?.logicalStorageBytes ?? 0
    const pct = storageUsagePercent(used, logical)
    const isOtherDb = storageForm?.databaseProvider === 'Other'
      || storageForm?.databaseProvider === 'SqlServer'
      || storageForm?.databaseProvider === 'MySql'

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
        </div>

        {storageForm && (
          <div className="settings-card">
            <h4>{t('settings.storageConfig')}</h4>
            <p className="settings-card-desc">{t('settings.db.configDesc')}</p>

            <div className="settings-field">
              <label className="settings-label" htmlFor="storage-db">
                {t('settings.databaseProvider')}
              </label>
              <select
                id="storage-db"
                value={storageForm.databaseProvider}
                onChange={(e) =>
                  setStorageForm((f) => f && { ...f, databaseProvider: e.target.value })
                }
              >
                {DATABASE_PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {t(p.labelKey)}
                  </option>
                ))}
              </select>
              <p className="settings-hint">{t('settings.db.providerHint')}</p>
            </div>

            <div className="settings-field">
              <label className="settings-label" htmlFor="storage-conn">
                {t('settings.db.connectionString')}
              </label>
              <textarea
                id="storage-conn"
                className="settings-textarea"
                rows={3}
                value={storageForm.connectionString}
                placeholder={connectionPlaceholder(storageForm.databaseProvider)}
                onChange={(e) =>
                  setStorageForm((f) => f && { ...f, connectionString: e.target.value })
                }
              />
              <p className="settings-hint">
                {isOtherDb ? t('settings.db.otherHint') : t('settings.db.connectionHint')}
              </p>
            </div>

            {config && (
              <p className="settings-hint">
                {t('settings.lastUpdated')}: {fmtDate(config.updatedAt, locale)}
              </p>
            )}
            <div className="settings-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void saveStorage()}
                disabled={saving}
              >
                {saving ? t('profile.saving') : t('settings.saveChanges')}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderSystem = () => {
    const dbStatus = healthToStatus(health?.status === 'healthy', false)
    const storageStatus = healthToStatus(!!config, false)
    const avStatus = healthToStatus(true, (avStats?.unresolvedAlerts ?? alerts.length) > 0)
    const encStatus: SystemStatus = 'operational'

    return (
      <div className="settings-section">
        <div className="settings-section-header">
          <h3>{t('settings.nav.system')}</h3>
          <p>{t('settings.systemDesc')}</p>
        </div>
        <div className="settings-actions settings-actions-top">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => void checkSystemStatus()}
            disabled={checking}
          >
            <IconRestore size={16} />
            {checking ? t('settings.checking') : t('settings.checkSystemStatus')}
          </button>
        </div>
        <div className="settings-card">
          <dl className="settings-system-grid">
            <div>
              <dt>{t('settings.databaseStatus')}</dt>
              <dd>
                <StatusIndicator status={dbStatus} label={t(`settings.status.${dbStatus}`)} />
              </dd>
            </div>
            <div>
              <dt>{t('settings.storageStatus')}</dt>
              <dd>
                <StatusIndicator
                  status={storageStatus}
                  label={t(`settings.status.${storageStatus}`)}
                />
              </dd>
            </div>
            <div>
              <dt>{t('settings.antivirusStatus')}</dt>
              <dd>
                <StatusIndicator status={avStatus} label={t(`settings.status.${avStatus}`)} />
              </dd>
            </div>
            <div>
              <dt>{t('settings.encryptionStatus')}</dt>
              <dd>
                <StatusIndicator status={encStatus} label={t(`settings.status.${encStatus}`)} />
              </dd>
            </div>
          </dl>
          {health && (
            <p className="settings-hint">
              {t('settings.lastHealthCheck')}: {fmtDate(health.timestamp, locale)}
            </p>
          )}
        </div>
      </div>
    )
  }

  const renderSection = () => {
    switch (section) {
      case 'general':
        return renderGeneral()
      case 'security':
        return renderSecurity()
      case 'storage':
        return renderStorage()
      case 'system':
        return renderSystem()
      default:
        return null
    }
  }

  if (loading) return <SettingsSkeleton />

  return (
    <div className="settings-view">
      {toast && (
        <div className="profile-toast profile-toast-success" role="status">
          {toast}
        </div>
      )}

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
            <button
              type="button"
              className="btn btn-warning"
              onClick={() => void rotateKey()}
              disabled={rotating}
            >
              {rotating ? t('profile.saving') : t('settings.rotateKey')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
