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
  ALLOWED_FILE_EXTENSIONS,
  APP_NAME,
  computeSecurityLevel,
  connectionPlaceholder,
  isClamAvEngine,
  isEncryptionActive,
  latestDetectionAt,
  threatsFromAlerts,
  DATABASE_PROVIDERS,
  ENCRYPTION_ALGORITHMS,
  encryptionAlgorithmLabel,
  formatBytesShort,
  healthToStatus,
  JWT_EXPIRATION_MINUTES,
  LOCKOUT_MINUTES,
  MAX_FAILED_LOGINS,
  MAX_FILE_SIZE_BYTES,
  PASSWORD_MIN_LENGTH,
  SETTINGS_SECTIONS,
  STORAGE_PROVIDERS,
  STORAGE_QUOTA_BYTES,
  storageToForm,
  storageUsagePercent,
  type SettingsSection,
  type StorageFormState,
  type SystemStatus,
} from '@/utils/settingsHelpers'
import { useTheme } from '@/context/ThemeContext'
import {
  PREF_COMPACT_TABLE_KEY,
  PREF_HOME_PAGE_KEY,
  PREF_NOTIF_EMAIL_KEY,
  PREF_NOTIF_INAPP_KEY,
} from '@/constants'
import type { AntivirusAlert, AntivirusStats, DashboardStats, DocumentMaturityScore, StorageConfig } from '@/types'

function readBoolPref(key: string, fallback = true) {
  const v = localStorage.getItem(key)
  if (v === null) return fallback
  return v === 'true'
}

interface HealthResponse {
  status: string
  timestamp: string
}

function formatScanMs(ms: number | null | undefined, emptyLabel: string) {
  if (ms == null || Number.isNaN(ms) || ms <= 0) return emptyLabel
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function maturityLevelLabel(level: string, t: (k: string) => string) {
  const map: Record<string, string> = {
    Excellent: t('maturity.level.excellent'),
    Good: t('maturity.level.good'),
    NeedsImprovement: t('maturity.level.needs'),
  }
  return map[level] || level
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
  const { theme, setTheme } = useTheme()

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
  const [maturity, setMaturity] = useState<DocumentMaturityScore | null>(null)
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [lastKeyRotation, setLastKeyRotation] = useState<string | null>(null)
  const [lastKeyId, setLastKeyId] = useState<string | null>(null)

  const [draftLang, setDraftLang] = useState(lang)
  const [draftTheme, setDraftTheme] = useState<'light' | 'dark'>(theme)
  const [draftHome, setDraftHome] = useState(() => localStorage.getItem(PREF_HOME_PAGE_KEY) || '/')
  const [draftCompact, setDraftCompact] = useState(() => readBoolPref(PREF_COMPACT_TABLE_KEY, false))
  const [draftNotifInApp, setDraftNotifInApp] = useState(() => readBoolPref(PREF_NOTIF_INAPP_KEY, true))
  const draftNotifEmail = false
  const [rotateConfirm, setRotateConfirm] = useState(false)
  const [rotating, setRotating] = useState(false)

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 4200)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [storage, avAlerts, avStatsRes, stats, maturityRes, healthRes] = await Promise.all([
        api<StorageConfig>('/api/admin/storage').catch(() => null),
        api<AntivirusAlert[]>('/api/admin/security/antivirus-alerts?take=50').catch(() => [] as AntivirusAlert[]),
        api<AntivirusStats>('/api/admin/security/antivirus-stats').catch(() => null),
        api<DashboardStats>('/api/dashboard').catch(() => null),
        api<DocumentMaturityScore>('/api/dashboard/maturity').catch(() => null),
        fetch(apiUrl('/health')).then((r) => r.json() as Promise<HealthResponse>).catch(() => null),
      ])
      if (storage) {
        setConfig(storage)
        setStorageForm(storageToForm(storage))
      } else {
        setStorageForm({
          providerType: 'LocalFileSystem',
          databaseProvider: 'PostgreSql',
          basePath: './storage',
          connectionString: '',
          compressionEnabled: true,
          encryptionAlgorithm: 'AesGcm',
          s3Endpoint: '',
          s3Bucket: '',
          s3AccessKey: '',
          s3SecretKey: '',
        })
      }
      setAlerts(avAlerts || [])
      setAvStats(avStatsRes)
      setDashboard(stats)
      setMaturity(maturityRes)
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

  const openAlerts = avStats?.unresolvedAlerts ?? alerts.filter((a) => !a.isResolved).length
  const encryptionActive = isEncryptionActive(
    config?.encryptionAlgorithm || storageForm?.encryptionAlgorithm,
    config?.activeEncryptionKeyId,
    config?.activeEncryptionKeyIdentifier,
  )
  const clamAvEnabled = isClamAvEngine(avStats?.engine)
  const antivirusEnabled = avStats ? Boolean(avStats.enabled || avStats.engine) : true
  const securityLevel = useMemo(
    () =>
      computeSecurityLevel({
        unresolvedAlerts: openAlerts,
        antivirusEnabled,
        encryptionActive,
      }),
    [openAlerts, antivirusEnabled, encryptionActive]
  )

  const checkSystemStatus = async () => {
    setChecking(true)
    try {
      const [healthRes, storageRes, avRes, avStatsRes] = await Promise.all([
        fetch(apiUrl('/health')).then((r) => r.json() as Promise<HealthResponse>).catch(() => null),
        api<StorageConfig>('/api/admin/storage').catch(() => null),
        api<AntivirusAlert[]>('/api/admin/security/antivirus-alerts?take=50').catch(() => [] as AntivirusAlert[]),
        api<AntivirusStats>('/api/admin/security/antivirus-stats').catch(() => null),
      ])
      if (healthRes) setHealth(healthRes)
      if (storageRes) {
        setConfig(storageRes)
        setStorageForm(storageToForm(storageRes))
      }
      setAlerts(avRes || [])
      setAvStats(avStatsRes)
      showToast(t('settings.systemChecked'))
    } catch (e) {
      onError?.(e instanceof Error ? e.message : t('settings.saveFailed'))
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    setDraftLang(lang)
  }, [lang])

  useEffect(() => {
    setDraftTheme(theme)
  }, [theme])

  const generalDirty =
    draftLang !== lang ||
    draftTheme !== theme ||
    draftHome !== (localStorage.getItem(PREF_HOME_PAGE_KEY) || '/') ||
    draftCompact !== readBoolPref(PREF_COMPACT_TABLE_KEY, false) ||
    draftNotifInApp !== readBoolPref(PREF_NOTIF_INAPP_KEY, true) ||
    draftNotifEmail !== readBoolPref(PREF_NOTIF_EMAIL_KEY, true)

  const saveGeneral = () => {
    setLang(draftLang)
    setTheme(draftTheme)
    localStorage.setItem(PREF_HOME_PAGE_KEY, draftHome)
    localStorage.setItem(PREF_COMPACT_TABLE_KEY, String(draftCompact))
    localStorage.setItem(PREF_NOTIF_INAPP_KEY, String(draftNotifInApp))
    localStorage.setItem(PREF_NOTIF_EMAIL_KEY, String(draftNotifEmail))
    window.dispatchEvent(new StorageEvent('storage', { key: PREF_NOTIF_INAPP_KEY }))
    document.documentElement.dataset.compactTable = draftCompact ? 'true' : 'false'
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
        compressionEnabled: storageForm.compressionEnabled,
        encryptionAlgorithm: storageForm.encryptionAlgorithm,
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
      const updatedStorage = await api<StorageConfig>('/api/admin/storage')
      setConfig(updatedStorage)
      setStorageForm(storageToForm(updatedStorage))
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

      <div className="settings-general-stats">
        <div className="settings-general-stat">
          <span className="settings-stat-label">{t('settings.platform')}</span>
          <strong>{APP_NAME}</strong>
        </div>
        <div className="settings-general-stat">
          <span className="settings-stat-label">{t('settings.language')}</span>
          <strong>{lang === 'fr' ? 'Français' : 'English'}</strong>
        </div>
        <div className="settings-general-stat">
          <span className="settings-stat-label">{t('settings.theme')}</span>
          <strong>{t(theme === 'dark' ? 'settings.theme.dark' : 'settings.theme.light')}</strong>
        </div>
        <div className="settings-general-stat">
          <span className="settings-stat-label">{t('settings.sessionExpiration')}</span>
          <strong>{t('settings.minutesValue', { count: String(JWT_EXPIRATION_MINUTES) })}</strong>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card-title-row">
          <h4>{t('settings.appearance')}</h4>
        </div>
        <p className="settings-card-desc">{t('settings.appearanceDesc')}</p>
        <div className="settings-form-grid">
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
          <div className="settings-field">
            <label className="settings-label" htmlFor="settings-theme">{t('settings.theme')}</label>
            <select
              id="settings-theme"
              value={draftTheme}
              onChange={(e) => setDraftTheme(e.target.value as 'light' | 'dark')}
            >
              <option value="light">{t('settings.theme.light')}</option>
              <option value="dark">{t('settings.theme.dark')}</option>
            </select>
            <p className="settings-hint">{t('settings.themeHint')}</p>
          </div>
          <div className="settings-field">
            <label className="settings-label" htmlFor="settings-home">{t('settings.homePage')}</label>
            <select
              id="settings-home"
              value={draftHome}
              onChange={(e) => setDraftHome(e.target.value)}
            >
              <option value="/">{t('settings.home.dashboard')}</option>
              <option value="/documents">{t('settings.home.documents')}</option>
              <option value="/favorites">{t('settings.home.favorites')}</option>
              <option value="/shared">{t('settings.home.shared')}</option>
              <option value="/categories">{t('settings.home.categories')}</option>
            </select>
            <p className="settings-hint">{t('settings.homePageHint')}</p>
          </div>
          <div className="settings-field">
            <label className="settings-label">{t('settings.tableDensity')}</label>
            <div className="settings-switch-row" style={{ border: 'none', padding: '0.35rem 0' }}>
              <div>
                <strong>{t('settings.compactTable')}</strong>
                <p>{t('settings.compactTableHint')}</p>
              </div>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={draftCompact}
                  onChange={(e) => setDraftCompact(e.target.checked)}
                />
                <span className="settings-switch-slider" />
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card-title-row">
          <h4>{t('settings.nav.notifications')}</h4>
        </div>
        <p className="settings-card-desc">{t('settings.notificationsDesc')}</p>
        <div className="settings-switch-row">
          <div>
            <strong>{t('profile.notifInApp')}</strong>
            <p>{t('profile.notifInAppHint')}</p>
          </div>
          <label className="settings-switch">
            <input
              type="checkbox"
              checked={draftNotifInApp}
              onChange={(e) => setDraftNotifInApp(e.target.checked)}
            />
            <span className="settings-switch-slider" />
          </label>
        </div>
        <div className="settings-switch-row">
          <div>
            <strong>{t('profile.notifEmail')}</strong>
            <p>{t('profile.notifEmailUnavailable')}</p>
          </div>
          <span className="settings-badge settings-badge-disabled">{t('settings.disabled')}</span>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card-title-row">
          <h4>{t('settings.documentPolicy')}</h4>
        </div>
        <p className="settings-card-desc">{t('settings.documentPolicyDesc')}</p>
        <div className="settings-form-grid">
          <ReadOnlyRow
            label={t('settings.maxFileSize')}
            value={fmtSize(MAX_FILE_SIZE_BYTES)}
            hint={t('settings.maxFileSizeHint')}
          />
          <ReadOnlyRow
            label={t('settings.defaultCategories')}
            value={['RH', 'Factures', 'Contrats', 'General'].join(' · ')}
          />
          <div className="settings-field settings-field-full">
            <label className="settings-label">{t('settings.allowedExtensions')}</label>
            <div className="settings-ext-list">
              {ALLOWED_FILE_EXTENSIONS.map((ext) => (
                <span key={ext} className="settings-ext-pill">{ext}</span>
              ))}
            </div>
            <p className="settings-hint">{t('settings.allowedExtensionsHint')}</p>
          </div>
        </div>
      </div>

      <div className="settings-card settings-card-muted">
        <div className="settings-card-title-row">
          <h4>{t('settings.platformInfo')}</h4>
          {health && (
            <StatusIndicator
              status={healthToStatus((health.status || '').toLowerCase() === 'healthy')}
              label={t(`settings.status.${healthToStatus((health.status || '').toLowerCase() === 'healthy')}`)}
            />
          )}
        </div>
        <dl className="settings-info-grid">
          <div>
            <dt>{t('settings.platform')}</dt>
            <dd>{APP_NAME}</dd>
          </div>
          <div>
            <dt>{t('settings.locale')}</dt>
            <dd>{locale}</dd>
          </div>
          <div>
            <dt>{t('settings.storageProvider')}</dt>
            <dd>{config?.providerType || '—'}</dd>
          </div>
          <div>
            <dt>{t('settings.lastHealthCheck')}</dt>
            <dd>{health?.timestamp ? fmtDate(health.timestamp, locale) : '—'}</dd>
          </div>
          <div>
            <dt>{t('settings.documentsTotal')}</dt>
            <dd>{dashboard?.totalDocuments ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('settings.usedStorage')}</dt>
            <dd>{dashboard ? formatBytesShort(dashboard.storageUsedBytes || 0) : '—'}</dd>
          </div>
        </dl>
      </div>

      <div className="settings-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={saveGeneral}
          disabled={!generalDirty}
        >
          {t('settings.saveChanges')}
        </button>
      </div>
    </div>
  )

  const renderSecurity = () => {
    const noScan = t('settings.av.noScan')
    const algo = encryptionAlgorithmLabel(config?.encryptionAlgorithm || storageForm?.encryptionAlgorithm, t)
    const keyId = config?.activeEncryptionKeyIdentifier || lastKeyId
    const keyDate = lastKeyRotation || config?.updatedAt
    const lastDetection = latestDetectionAt(alerts, avStats?.lastDetectionAt)
    const threats = (avStats?.topThreats && avStats.topThreats.length > 0)
      ? avStats.topThreats
      : threatsFromAlerts(alerts)
    const securityPillar = maturity?.security
    const avCleanMetric = securityPillar?.metrics.find((m) => m.key === 'antivirusClean')
    const cleanDocs = (avStats?.cleanDocuments && avStats.cleanDocuments > 0)
      ? avStats.cleanDocuments
      : (avCleanMetric?.value ?? avStats?.cleanDocuments ?? 0)
    const scannedDocs = (avStats?.documentsScanned && avStats.documentsScanned > 0)
      ? avStats.documentsScanned
      : (avCleanMetric?.total ?? dashboard?.totalDocuments ?? 0)

    return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h3>{t('settings.nav.security')}</h3>
        <p>{t('settings.securityDesc')}</p>
      </div>

      <div className={`settings-security-level level-${securityLevel}`}>
        <div>
          <span className="settings-security-level-label">{t('settings.securityLevel')}</span>
          <strong className={`settings-security-level-value level-${securityLevel}`}>
            {t(`settings.securityLevel.${securityLevel}`)}
          </strong>
          <p className="settings-security-level-hint">{t(`settings.securityLevelHint.${securityLevel}`)}</p>
        </div>
        <IconShield size={28} />
      </div>

      <ul className="settings-security-checks">
        <li className="ok">{t('settings.check.jwt')}</li>
        <li className={encryptionActive ? 'ok' : 'warn'}>
          {encryptionActive ? t('settings.check.encryptionOn') : t('settings.check.encryptionOff')}
        </li>
        <li className="ok">{t('settings.check.password')}</li>
        <li className={antivirusEnabled ? 'ok' : 'warn'}>
          {antivirusEnabled ? t('settings.check.avOn') : t('settings.check.avOff')}
        </li>
        <li className={openAlerts === 0 ? 'ok' : 'warn'}>
          {t('settings.check.alerts', { count: String(openAlerts) })}
        </li>
        <li className="ok">{t('settings.check.audit')}</li>
        <li className="ok">{t('settings.rbac')}</li>
        <li className={clamAvEnabled ? 'ok' : 'warn'}>
          {clamAvEnabled ? t('settings.check.clamAvOn') : t('settings.check.clamAvOff')}
        </li>
      </ul>

      <dl className="settings-security-facts">
        <div>
          <dt>{t('settings.jwtAuth')}</dt>
          <dd>{t('settings.minutesValue', { count: String(JWT_EXPIRATION_MINUTES) })}</dd>
        </div>
        <div>
          <dt>{t('settings.hashing')}</dt>
          <dd>{t('settings.hashingValue')}</dd>
        </div>
        <div>
          <dt>{t('settings.accountLockout')}</dt>
          <dd>{t('settings.lockoutValue', { minutes: String(LOCKOUT_MINUTES) })}</dd>
        </div>
        <div>
          <dt>{t('settings.encryptionAlgorithm')}</dt>
          <dd>{algo}</dd>
        </div>
        <div>
          <dt>{t('settings.integrity')}</dt>
          <dd>{t('settings.integrityValue')}</dd>
        </div>
        <div>
          <dt>{t('settings.av.engine')}</dt>
          <dd>{avStats?.engine || t('settings.av.engineFallback')}</dd>
        </div>
        <div>
          <dt>{t('settings.scanCoverage')}</dt>
          <dd>
            {cleanDocs}
            {' / '}
            {scannedDocs}
          </dd>
        </div>
        <div>
          <dt>{t('settings.av.detectionsTitle')}</dt>
          <dd>
            {t('settings.av.detectionsCount', {
              total: String(avStats?.totalAlerts ?? alerts.length),
              open: String(openAlerts),
            })}
          </dd>
        </div>
      </dl>

      <div className="settings-card">
        <h4>{t('settings.authTitle')}</h4>
        <FeatureRow
          name={t('settings.jwtAuth')}
          description={t('settings.jwtAuthDesc')}
          enabled
          t={t}
        />
        <ReadOnlyRow
          label={t('settings.sessionExpiration')}
          value={t('settings.minutesValue', { count: String(JWT_EXPIRATION_MINUTES) })}
          hint={t('settings.sessionExpirationHint')}
        />
        <ReadOnlyRow
          label={t('settings.passwordPolicy')}
          value={t('settings.passwordPolicyValue')}
          hint={t('settings.passwordPolicyHint', { count: String(PASSWORD_MIN_LENGTH) })}
        />
        <ReadOnlyRow
          label={t('settings.hashing')}
          value={t('settings.hashingValue')}
        />
        <ReadOnlyRow
          label={t('settings.maxLoginAttempts')}
          value={String(MAX_FAILED_LOGINS)}
        />
        <ReadOnlyRow
          label={t('settings.accountLockout')}
          value={t('settings.lockoutValue', { minutes: String(LOCKOUT_MINUTES) })}
        />
        <FeatureRow
          name={t('settings.twoFactor')}
          description={t('settings.twoFactorDesc')}
          enabled={false}
          t={t}
        />
        <FeatureRow
          name={t('settings.rbac')}
          description={t('settings.rbacDesc')}
          enabled
          t={t}
        />
        <FeatureRow
          name={t('settings.auditLog')}
          description={t('settings.auditLogDesc')}
          enabled
          t={t}
        />
      </div>

      <div className="settings-card">
        <h4>{t('settings.encryptionKeys')}</h4>
        <p className="settings-card-desc">{t('settings.encryptionKeysDesc')}</p>
        <FeatureRow
          name={t('settings.encryptionAtRest')}
          description={t('settings.encryptionAtRestDesc')}
          enabled={encryptionActive}
          t={t}
        />
        <ReadOnlyRow label={t('settings.encryptionAlgorithm')} value={algo} />
        <FeatureRow
          name={t('settings.sha256')}
          description={t('settings.sha256Desc')}
          enabled
          t={t}
        />
        <FeatureRow
          name={t('settings.compression')}
          description={t('settings.compressionDesc')}
          enabled={storageForm?.compressionEnabled !== false}
          t={t}
        />
        <FeatureRow
          name={t('settings.digitalSignature')}
          description={t('settings.digitalSignatureDesc')}
          enabled={false}
          t={t}
        />
        <dl className="settings-dl">
          <div>
            <dt>{t('settings.keyStatus')}</dt>
            <dd>{encryptionActive ? t('settings.keyStatusActive') : t('settings.notAvailable')}</dd>
          </div>
          <div>
            <dt>{t('settings.keyIdentifier')}</dt>
            <dd className="settings-mono">{keyId || t('settings.keyInitial')}</dd>
          </div>
          <div>
            <dt>{t('settings.lastKeyRotation')}</dt>
            <dd>{keyDate ? fmtDate(keyDate, locale) : t('settings.keyNeverRotated')}</dd>
          </div>
          <div>
            <dt>{t('settings.integrity')}</dt>
            <dd>{t('settings.integrityValue')}</dd>
          </div>
        </dl>
      </div>

      <div className="settings-card">
        <div className="settings-card-title-row">
          <h4>{t('maturity.pillar.security')}</h4>
          <span className={`settings-badge ${securityPillar ? 'settings-badge-enabled' : 'settings-badge-muted'}`}>
            {securityPillar
              ? `${securityPillar.score}% · ${maturityLevelLabel(securityPillar.level, t)}`
              : t('settings.maturityUnavailable')}
          </span>
        </div>
        <p className="settings-card-desc">{t('settings.maturitySecurityDesc')}</p>
        {securityPillar ? (
          <ul className="settings-maturity-metrics">
            {securityPillar.metrics.map((m) => (
              <li key={m.key}>
                <div className="settings-maturity-metric-head">
                  <span>{t(`maturity.metric.${m.key}`)}</span>
                  <strong>
                    {m.value}/{m.total} · {m.percent}%
                  </strong>
                </div>
                <div className="settings-progress-bar">
                  <div className="settings-progress-fill" style={{ width: `${Math.min(m.percent, 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <dl className="settings-dl">
            <div>
              <dt>{t('settings.documentsTotal')}</dt>
              <dd>{dashboard ? String(dashboard.totalDocuments) : '0'}</dd>
            </div>
            <div>
              <dt>{t('settings.scanCoverage')}</dt>
              <dd>
                {cleanDocs}
                {' / '}
                {scannedDocs}
              </dd>
            </div>
            <div>
              <dt>{t('settings.encryptionAlgorithm')}</dt>
              <dd>{algo}</dd>
            </div>
            <div>
              <dt>{t('settings.rbac')}</dt>
              <dd>{t('settings.enabled')}</dd>
            </div>
          </dl>
        )}
      </div>

      <div className="settings-card">
        <div className="settings-card-title-row">
          <h4>{t('settings.av.performanceTitle')}</h4>
          <span className={`settings-badge ${antivirusEnabled ? 'settings-badge-enabled' : 'settings-badge-disabled'}`}>
            {antivirusEnabled ? t('settings.active') : t('settings.inactive')}
          </span>
        </div>
        <p className="settings-card-desc">{t('settings.av.performanceDesc')}</p>
        <FeatureRow
          name={t('settings.av.clamAv')}
          description={clamAvEnabled ? t('settings.av.clamAvActive') : t('settings.av.clamAvInactive')}
          enabled={clamAvEnabled}
          t={t}
        />
        <div className="settings-av-kpis">
          <div className="settings-av-kpi">
            <span className="settings-stat-label">{t('settings.av.engine')}</span>
            <strong>{avStats?.engine || t('settings.av.engineFallback')}</strong>
            <span className="settings-av-kpi-sub">
              {clamAvEnabled && avStats
                ? `${avStats.host}:${avStats.port}`
                : t('settings.av.notConnected')}
            </span>
          </div>
          <div className="settings-av-kpi">
            <span className="settings-stat-label">{t('settings.av.avgScan')}</span>
            <strong>{formatScanMs(avStats?.averageScanMs, noScan)}</strong>
          </div>
          <div className="settings-av-kpi">
            <span className="settings-stat-label">{t('settings.av.lastScan')}</span>
            <strong>{formatScanMs(avStats?.lastScanMs, noScan)}</strong>
          </div>
          <div className="settings-av-kpi">
            <span className="settings-stat-label">{t('settings.av.maxScan')}</span>
            <strong>{formatScanMs(avStats?.maxScanMs, noScan)}</strong>
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
              {cleanDocs}
              <span className="settings-av-kpi-muted">
                {' / '}
                {scannedDocs}
              </span>
            </strong>
          </div>
        </div>
        <div className="settings-av-threats">
          <h5>{t('settings.av.topThreats')}</h5>
          {threats.length === 0 ? (
            <p className="settings-av-empty">{t('settings.av.noThreats')}</p>
          ) : (
            <ul className="settings-av-threat-list">
              {threats.map((th) => (
                <li key={th.threatName}>
                  <span className="settings-av-threat-name">{th.threatName}</span>
                  <span className="settings-av-threat-count">{th.count}</span>
                  <time>{fmtDate(th.lastDetectedAt, locale)}</time>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={`settings-card ${openAlerts > 0 ? 'settings-card-warning' : ''}`}>
        <div className="settings-card-title-row">
          <h4>{t('settings.av.detectionsTitle')}</h4>
          <span className="settings-badge settings-badge-muted">
            {t('settings.av.detectionsCount', {
              total: String(avStats?.totalAlerts ?? alerts.length),
              open: String(openAlerts),
            })}
          </span>
        </div>
        <p className="settings-card-desc">{t('settings.av.detectionsDesc')}</p>
        <p className="settings-hint">
          {t('settings.av.lastDetection')}: {lastDetection ? fmtDate(lastDetection, locale) : t('settings.av.neverDetected')}
        </p>
        {alerts.length === 0 ? (
          <p className="settings-av-empty">{t('settings.av.noDetections')}</p>
        ) : (
          <ul className="settings-av-detection-list">
            {alerts.map((a) => (
              <li key={a.id} className={a.isResolved ? 'resolved' : 'open'}>
                <div className="settings-av-detection-main">
                  <strong className="settings-av-detection-threat">{a.threatName || t('settings.av.unknownThreat')}</strong>
                  <span className={`settings-badge ${a.isResolved ? 'settings-badge-muted' : 'settings-badge-disabled'}`}>
                    {a.isResolved ? t('settings.av.resolved') : t('settings.av.open')}
                  </span>
                </div>
                <div className="settings-av-detection-file">{a.fileName || t('settings.av.unknownFile')}</div>
                <div className="settings-av-detection-details">
                  {a.details?.trim() ? a.details : t('settings.av.noDetails')}
                </div>
                <time>{fmtDate(a.detectedAt, locale)}</time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
    )
  }

  const renderStorage = () => {
    const used = dashboard?.storageUsedBytes ?? 0
    const logical = dashboard?.logicalStorageBytes ?? 0
    const quota = dashboard?.storageQuotaBytes || STORAGE_QUOTA_BYTES
    const pct = storageUsagePercent(used, quota)
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
              <span className="settings-stat-label">{t('settings.storageQuota')}</span>
              <strong>{fmtSize(quota)}</strong>
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
          <p className="settings-card-desc">{t('settings.storageUsageHint')}</p>
        </div>

        {storageForm && (
          <div className="settings-card">
            <h4>{t('settings.storageConfig')}</h4>

            <div className="settings-field">
              <label className="settings-label" htmlFor="storage-provider">
                {t('settings.storageType')}
              </label>
              <select
                id="storage-provider"
                value={storageForm.providerType}
                onChange={(e) =>
                  setStorageForm((f) => f && { ...f, providerType: e.target.value })
                }
              >
                {STORAGE_PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {t(p.labelKey)}
                  </option>
                ))}
              </select>
            </div>

            <div className="settings-field">
              <label className="settings-label" htmlFor="storage-path">
                {t('settings.storageLocation')}
              </label>
              <input
                id="storage-path"
                type="text"
                value={storageForm.basePath}
                onChange={(e) =>
                  setStorageForm((f) => f && { ...f, basePath: e.target.value })
                }
              />
            </div>

            <div className="settings-switch-row">
              <div className="settings-feature-info">
                <strong>{t('settings.compression')}</strong>
                <p>{t('settings.compressionToggleHint')}</p>
              </div>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={storageForm.compressionEnabled}
                  onChange={(e) =>
                    setStorageForm((f) => f && { ...f, compressionEnabled: e.target.checked })
                  }
                />
                <span className="settings-switch-slider" />
                <span className="sr-only">{t('settings.compression')}</span>
              </label>
            </div>

            <div className="settings-field">
              <label className="settings-label" htmlFor="storage-encryption-algorithm">
                {t('settings.encryptionAlgorithm')}
              </label>
              <select
                id="storage-encryption-algorithm"
                value={storageForm.encryptionAlgorithm}
                onChange={(e) =>
                  setStorageForm((f) => f && { ...f, encryptionAlgorithm: e.target.value })
                }
              >
                {ENCRYPTION_ALGORITHMS.map((algorithm) => (
                  <option key={algorithm.value} value={algorithm.value}>
                    {t(algorithm.labelKey)}
                  </option>
                ))}
              </select>
              <p className="settings-hint">{t('settings.encryptionAlgorithmHint')}</p>
            </div>

            <div className="settings-card settings-card-highlight">
              <div className="settings-card-title-row">
                <h4>{t('settings.encryptionKeys')}</h4>
                <span className={`settings-badge ${encryptionActive ? 'settings-badge-enabled' : 'settings-badge-disabled'}`}>
                  {encryptionActive ? t('settings.active') : t('settings.notAvailable')}
                </span>
              </div>
              <p className="settings-card-desc">{t('settings.storageKeyAssociation')}</p>
              <dl className="settings-dl">
                <div>
                  <dt>{t('settings.keyIdentifier')}</dt>
                  <dd className="settings-mono">
                    {config?.activeEncryptionKeyIdentifier || lastKeyId || t('settings.keyInitial')}
                  </dd>
                </div>
                {(lastKeyRotation || config?.updatedAt) && (
                  <div>
                    <dt>{t('settings.lastKeyRotation')}</dt>
                    <dd>{fmtDate(lastKeyRotation || config?.updatedAt || '', locale)}</dd>
                  </div>
                )}
              </dl>
              <div className="settings-actions">
                <button type="button" className="btn btn-warning" onClick={() => setRotateConfirm(true)}>
                  {t('settings.rotateKey')}
                </button>
              </div>
            </div>

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
