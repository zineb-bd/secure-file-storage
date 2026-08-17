import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { ProfileSkeleton } from '@/components/profile/ProfileSkeleton'
import {
  IconActivity,
  IconCalendar,
  IconCamera,
  IconMail,
  IconShield,
  IconUser,
} from '@/components/profile/ProfileIcons'
import {
  PREF_COMPACT_TABLE_KEY,
  PREF_HOME_PAGE_KEY,
  PREF_NOTIF_EMAIL_KEY,
  PREF_NOTIF_INAPP_KEY,
} from '@/constants'
import { useI18n } from '@/i18n/I18nContext'
import { buildQuery, fmtDate, fmtSize } from '@/utils/format'
import { useProfileAvatar } from '@/hooks/useProfileAvatar'
import {
  processAvatarFile,
  removeProfileAvatar,
  saveProfileAvatar,
  validateAvatarFile,
} from '@/utils/profileAvatarStorage'
import type { DashboardStats, DocumentDto, ProfileUser, RecentActivity } from '@/types'

type ToastType = 'success' | 'error'
type ProfileTab = 'overview' | 'security' | 'preferences'

function readBoolPref(key: string, defaultValue = true) {
  const v = localStorage.getItem(key)
  if (v === null) return defaultValue
  return v === 'true'
}

function actionIcon(action: string) {
  const a = action.toLowerCase()
  if (a.includes('login') || a.includes('auth')) return 'login'
  if (a.includes('upload') || a.includes('create')) return 'upload'
  if (a.includes('download')) return 'download'
  if (a.includes('share')) return 'share'
  if (a.includes('update') || a.includes('edit') || a.includes('version')) return 'update'
  return 'default'
}

export function ProfilePage() {
  const { t, locale, lang, setLang } = useI18n()
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()

  const [profile, setProfile] = useState<ProfileUser | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [archivedCount, setArchivedCount] = useState(0)
  const [favoritesCount, setFavoritesCount] = useState(0)
  const [sharedCount, setSharedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<ProfileTab>('overview')

  const [editing, setEditing] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [formError, setFormError] = useState('')

  const [pwdOpen, setPwdOpen] = useState(false)
  const [pwdCurrent, setPwdCurrent] = useState('')
  const [pwdNew, setPwdNew] = useState('')
  const [pwdConfirm, setPwdConfirm] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)
  const [pwdError, setPwdError] = useState('')

  const [notifInApp, setNotifInApp] = useState(() => readBoolPref(PREF_NOTIF_INAPP_KEY))
  const [notifEmail, setNotifEmail] = useState(() => readBoolPref(PREF_NOTIF_EMAIL_KEY))
  const [homePage, setHomePage] = useState(() => localStorage.getItem(PREF_HOME_PAGE_KEY) || '/')
  const [compactTable, setCompactTable] = useState(() => readBoolPref(PREF_COMPACT_TABLE_KEY, false))

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const accountEmail = profile?.email || user?.email
  const avatarUrl = useProfileAvatar(accountEmail)

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 4200)
  }, [])

  const loadData = useCallback(async () => {
    const [p, d, archived, favorites, shared] = await Promise.all([
      api<ProfileUser>('/api/auth/me'),
      api<DashboardStats>('/api/dashboard'),
      api<{ totalCount: number }>(`/api/documents${buildQuery({ status: 'Archived', page: 1, pageSize: 1 })}`),
      api<{ totalCount?: number; items?: DocumentDto[] }>(`/api/documents/favorites${buildQuery({ page: 1, pageSize: 1 })}`),
      api<{ totalCount?: number; items?: DocumentDto[] }>(`/api/documents/shared-with-me${buildQuery({ page: 1, pageSize: 1 })}`),
    ])
    setProfile(p)
    setStats(d)
    setArchivedCount(archived.totalCount ?? 0)
    setFavoritesCount(favorites.totalCount ?? favorites.items?.length ?? 0)
    setSharedCount(shared.totalCount ?? shared.items?.length ?? 0)
    setFirstName(p.firstName)
    setLastName(p.lastName)
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        await loadData()
      } catch (e) {
        showToast(e instanceof Error ? e.message : t('msg.loadProfileError'), 'error')
      } finally {
        setLoading(false)
      }
    })()
  }, [loadData, showToast, t])

  const roleLabel = (r: string) => (r === 'Admin' ? t('role.admin') : t('role.user'))

  const activityLabel = (action: string) => {
    const key = `action.${action}`
    const label = t(key)
    return label !== key ? label : action
  }

  const timelineHighlights = useMemo(() => {
    if (!stats?.recentActivity?.length) return []
    const find = (pred: (a: RecentActivity) => boolean) => stats.recentActivity.find(pred)
    const items = [
      { id: 'login', label: t('profile.timeline.login'), item: find((a) => /login|auth/i.test(a.action)) },
      { id: 'upload', label: t('profile.timeline.upload'), item: find((a) => /upload|create/i.test(a.action)) },
      { id: 'download', label: t('profile.timeline.download'), item: find((a) => /download/i.test(a.action)) },
      { id: 'share', label: t('profile.timeline.share'), item: find((a) => /share/i.test(a.action)) },
    ]
    return items.filter((x) => x.item)
  }, [stats, t])

  const storagePct = useMemo(() => {
    const used = stats?.storageUsedBytes ?? 0
    const logical = stats?.logicalStorageBytes ?? used
    if (!logical) return 0
    return Math.min(100, Math.round((used / logical) * 100))
  }, [stats])

  const cancelEdit = () => {
    setEditing(false)
    setFormError('')
    if (profile) {
      setFirstName(profile.firstName)
      setLastName(profile.lastName)
    }
  }

  const saveProfile = async () => {
    setFormError('')
    if (!firstName.trim() || !lastName.trim()) {
      setFormError(t('msg.nameRequired'))
      return
    }
    setSavingProfile(true)
    try {
      await api('/api/auth/me', {
        method: 'PUT',
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }),
      })
      setEditing(false)
      await loadData()
      showToast(t('profile.saved'))
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t('msg.loadProfileError'))
    } finally {
      setSavingProfile(false)
    }
  }

  const changePassword = async () => {
    setPwdError('')
    if (!pwdCurrent) {
      setPwdError(t('msg.passwordCurrent'))
      return
    }
    if (pwdNew.length < 8) {
      setPwdError(t('msg.passwordLength'))
      return
    }
    if (pwdNew !== pwdConfirm) {
      setPwdError(t('msg.passwordMismatch'))
      return
    }
    setSavingPwd(true)
    try {
      await api('/api/auth/me/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: pwdCurrent, newPassword: pwdNew }),
      })
      setPwdOpen(false)
      setPwdCurrent('')
      setPwdNew('')
      setPwdConfirm('')
      showToast(t('profile.passwordSaved'))
    } catch (e) {
      setPwdError(e instanceof Error ? e.message : t('msg.passwordCurrent'))
    } finally {
      setSavingPwd(false)
    }
  }

  const handleLogout = () => {
    if (window.confirm(t('profile.logoutConfirm'))) {
      void logout()
    }
  }

  const persistPrefToast = () => showToast(t('profile.prefSaved'))

  const toggleNotifInApp = (on: boolean) => {
    setNotifInApp(on)
    localStorage.setItem(PREF_NOTIF_INAPP_KEY, String(on))
    persistPrefToast()
  }

  const toggleNotifEmail = (on: boolean) => {
    setNotifEmail(on)
    localStorage.setItem(PREF_NOTIF_EMAIL_KEY, String(on))
    persistPrefToast()
  }

  const toggleCompact = (on: boolean) => {
    setCompactTable(on)
    localStorage.setItem(PREF_COMPACT_TABLE_KEY, String(on))
    document.documentElement.setAttribute('data-compact-table', on ? 'true' : 'false')
    persistPrefToast()
  }

  const handleHomeChange = (value: string) => {
    setHomePage(value)
    localStorage.setItem(PREF_HOME_PAGE_KEY, value)
    persistPrefToast()
  }

  const handleThemeChange = (value: 'light' | 'dark') => {
    setTheme(value)
    persistPrefToast()
  }

  const handleAvatarClick = () => avatarInputRef.current?.click()

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !accountEmail) return

    const validationError = validateAvatarFile(file)
    if (validationError === 'invalidType') {
      showToast(t('profile.avatarInvalidType'), 'error')
      return
    }
    if (validationError === 'tooLarge') {
      showToast(t('profile.avatarTooLarge'), 'error')
      return
    }

    setUploadingAvatar(true)
    try {
      const dataUrl = await processAvatarFile(file)
      saveProfileAvatar(accountEmail, dataUrl)
      showToast(t('profile.avatarSaved'))
    } catch {
      showToast(t('profile.avatarError'), 'error')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleAvatarRemove = () => {
    if (!accountEmail || !avatarUrl) return
    if (!window.confirm(t('profile.avatarRemoveConfirm'))) return
    removeProfileAvatar(accountEmail)
    showToast(t('profile.avatarRemoved'))
  }

  if (loading) return <ProfileSkeleton />

  const fullName = profile ? `${profile.firstName} ${profile.lastName}` : user?.fullName || '—'
  const initials = (profile?.firstName || user?.fullName || 'U').charAt(0).toUpperCase()
  const isProfileAdmin = profile?.roles?.includes('Admin') ?? false
  const primaryRole = isProfileAdmin ? t('role.admin') : t('role.user')
  const roles = (profile?.roles || []).map(roleLabel).join(', ') || '—'
  const recentDocs = stats?.recentDocuments?.slice(0, 5) ?? []
  const notifCount = stats?.notifications?.length ?? 0

  return (
    <section className="page files-page profile-page" id="page-profile">
      {toast && (
        <div className={`profile-toast profile-toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      )}

      <div className="files-stats" id="profile-stats">
        <article className="files-stat files-stat-blue">
          <div className="files-stat-value">{stats?.totalDocuments ?? 0}</div>
          <div className="files-stat-label">{t('profile.statTotal')}</div>
        </article>
        <article className="files-stat files-stat-amber">
          <div className="files-stat-value">{favoritesCount}</div>
          <div className="files-stat-label">{t('profile.statFavorites')}</div>
        </article>
        <article className="files-stat files-stat-green">
          <div className="files-stat-value">{sharedCount}</div>
          <div className="files-stat-label">{t('profile.statSharedWithMe')}</div>
        </article>
        <article className="files-stat files-stat-cyan">
          <div className="files-stat-value">{fmtSize(stats?.storageUsedBytes)}</div>
          <div className="files-stat-label">{t('profile.statStorage')}</div>
        </article>
      </div>

      <div className="files-toolbar">
        <div className="profile-identity">
          <div className="profile-avatar-wrap">
            <div className={`profile-avatar-lg${avatarUrl ? ' has-photo' : ''}`} aria-hidden={!!avatarUrl}>
              {avatarUrl ? <img src={avatarUrl} alt="" className="profile-avatar-img" /> : initials}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="profile-avatar-input"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => void handleAvatarChange(e)}
            />
            <button
              type="button"
              className="profile-avatar-edit"
              title={t('profile.avatarChange')}
              aria-label={t('profile.avatarChange')}
              onClick={handleAvatarClick}
              disabled={uploadingAvatar}
            >
              <IconCamera />
            </button>
          </div>
          <div className="profile-identity-text">
            <strong className="profile-header-name">{fullName}</strong>
            <p className="profile-header-email">
              <IconMail size={14} />
              {profile?.email || user?.email}
              <span className="profile-identity-sep" aria-hidden>·</span>
              {t('profile.memberSince')} {fmtDate(profile?.createdAt, locale)}
              <span className="profile-identity-sep" aria-hidden>·</span>
              {archivedCount} {t('profile.statArchived')}
            </p>
            <div className="profile-header-badges">
              <span className="profile-badge profile-badge-role">{primaryRole}</span>
              <span className={`profile-badge profile-badge-status${profile?.isActive ? ' active' : ''}`}>
                {profile?.isActive ? t('status.active') : t('status.inactive')}
              </span>
              {notifCount > 0 && (
                <span className="profile-badge profile-badge-notif">
                  {t('profile.notifBadge', { count: String(notifCount) })}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="files-toolbar-end">
          {avatarUrl && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleAvatarRemove}
              disabled={uploadingAvatar}
            >
              {t('profile.avatarRemove')}
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm files-upload-btn"
            onClick={() => {
              setTab('overview')
              setEditing(true)
              setFormError('')
            }}
          >
            {t('profile.editProfile')}
          </button>
        </div>
      </div>

      <nav className="collab-tabs" aria-label={t('profile.tabs')}>
        {(
          [
            ['overview', t('profile.tab.overview')],
            ['security', t('profile.tab.security')],
            ['preferences', t('profile.tab.preferences')],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`collab-tab${tab === id ? ' active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="profile-layout">
        <div className="profile-column profile-column-main">
          {tab === 'overview' && (
            <>
              <section className="files-panel">
                <div className="files-panel-header">
                  <div>
                    <h2>{t('profile.personalInfo')}</h2>
                    <p>{t('profile.personalInfoDesc')}</p>
                  </div>
                  {!editing && (
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => setEditing(true)}>
                      {t('btn.edit')}
                    </button>
                  )}
                </div>

                {editing ? (
                  <div className="profile-form">
                    {formError && <div className="msg error">{formError}</div>}
                    <div className="profile-form-grid">
                      <div className="profile-field">
                        <label htmlFor="profile-first">
                          <IconUser size={16} />
                          {t('profile.firstName')}
                        </label>
                        <input
                          id="profile-first"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          autoComplete="given-name"
                        />
                      </div>
                      <div className="profile-field">
                        <label htmlFor="profile-last">
                          <IconUser size={16} />
                          {t('profile.lastName')}
                        </label>
                        <input
                          id="profile-last"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          autoComplete="family-name"
                        />
                      </div>
                    </div>
                    <div className="profile-form-actions">
                      <button type="button" className="btn btn-primary" disabled={savingProfile} onClick={() => void saveProfile()}>
                        {savingProfile ? t('profile.saving') : t('btn.save')}
                      </button>
                      <button type="button" className="btn btn-secondary" disabled={savingProfile} onClick={cancelEdit}>
                        {t('btn.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <dl className="profile-details-grid">
                    <div className="profile-detail-item">
                      <dt><IconUser size={16} />{t('profile.firstName')}</dt>
                      <dd>{profile?.firstName || '—'}</dd>
                    </div>
                    <div className="profile-detail-item">
                      <dt><IconUser size={16} />{t('profile.lastName')}</dt>
                      <dd>{profile?.lastName || '—'}</dd>
                    </div>
                    <div className="profile-detail-item">
                      <dt><IconMail size={16} />{t('profile.email')}</dt>
                      <dd>{profile?.email || '—'}</dd>
                    </div>
                    <div className="profile-detail-item">
                      <dt><IconShield size={16} />{t('profile.roles')}</dt>
                      <dd>{roles}</dd>
                    </div>
                    <div className="profile-detail-item profile-detail-full">
                      <dt><IconCalendar size={16} />{t('profile.accountCreated')}</dt>
                      <dd>{fmtDate(profile?.createdAt, locale)}</dd>
                    </div>
                  </dl>
                )}
              </section>

              <section className="files-panel">
                <div className="files-panel-header">
                  <div>
                    <h2>{t('profile.roleRights')}</h2>
                    <p>{t('profile.roleRightsDesc')}</p>
                  </div>
                </div>
                <div className="profile-role-summary">
                  <div className="profile-role-current">
                    <span>{t('profile.currentRole')}</span>
                    <strong>{roles}</strong>
                  </div>
                  <ul className="profile-rights-list">
                    {(isProfileAdmin
                      ? ['profile.right.adminUsers', 'profile.right.adminAccess', 'profile.right.adminAudit']
                      : ['profile.right.userDocuments', 'profile.right.userShare', 'profile.right.userAccess']
                    ).map((right) => (
                      <li key={right}>{t(right)}</li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className="files-panel">
                <div className="files-panel-header">
                  <div>
                    <h2>{t('profile.storageTitle')}</h2>
                    <p>{t('profile.storageDesc')}</p>
                  </div>
                </div>
                <div className="profile-storage">
                  <div className="profile-storage-row">
                    <span>{t('profile.storageUsed')}</span>
                    <strong>{fmtSize(stats?.storageUsedBytes)}</strong>
                  </div>
                  <div className="profile-storage-bar" aria-hidden>
                    <span style={{ width: `${Math.max(storagePct, 4)}%` }} />
                  </div>
                  <div className="profile-storage-meta">
                    <span>{t('profile.storageLogical')}: {fmtSize(stats?.logicalStorageBytes)}</span>
                    <span>{t('profile.storageSaved')}: {fmtSize(stats?.bytesSavedByDedup)}</span>
                  </div>
                </div>
              </section>

              <section className="files-panel">
                <div className="files-panel-header">
                  <div>
                    <h2>{t('profile.shortcuts')}</h2>
                    <p>{t('profile.shortcutsDesc')}</p>
                  </div>
                </div>
                <div className="profile-shortcuts">
                  <Link to="/documents" className="profile-shortcut">{t('nav.documents')}</Link>
                  <Link to="/favorites" className="profile-shortcut">{t('nav.favorites')}</Link>
                  <Link to="/shared" className="profile-shortcut">{t('nav.shared')}</Link>
                  <Link to="/archived" className="profile-shortcut">{t('nav.archived')}</Link>
                </div>
              </section>
            </>
          )}

          {tab === 'security' && (
            <section className="files-panel">
              <div className="files-panel-header">
                <div>
                  <h2>{t('profile.security')}</h2>
                  <p>{t('profile.securityDesc')}</p>
                </div>
              </div>

              <div className="profile-action-list">
                <div className="profile-action-row">
                  <div className="profile-action-icon"><IconShield /></div>
                  <div className="profile-action-body">
                    <strong>{t('profile.changePassword')}</strong>
                    <p>{t('profile.passwordHint')}</p>
                  </div>
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => { setPwdOpen((o) => !o); setPwdError('') }}>
                    {pwdOpen ? t('btn.cancel') : t('btn.edit')}
                  </button>
                </div>

                {pwdOpen && (
                  <div className="profile-inline-form">
                    {pwdError && <div className="msg error">{pwdError}</div>}
                    <div className="profile-field">
                      <label htmlFor="pwd-current">{t('profile.currentPassword')}</label>
                      <input id="pwd-current" type="password" value={pwdCurrent} onChange={(e) => setPwdCurrent(e.target.value)} autoComplete="current-password" />
                    </div>
                    <div className="profile-form-grid">
                      <div className="profile-field">
                        <label htmlFor="pwd-new">{t('profile.newPassword')}</label>
                        <input id="pwd-new" type="password" value={pwdNew} onChange={(e) => setPwdNew(e.target.value)} autoComplete="new-password" />
                      </div>
                      <div className="profile-field">
                        <label htmlFor="pwd-confirm">{t('profile.confirmPassword')}</label>
                        <input id="pwd-confirm" type="password" value={pwdConfirm} onChange={(e) => setPwdConfirm(e.target.value)} autoComplete="new-password" />
                      </div>
                    </div>
                    <div className="profile-form-actions">
                      <button type="button" className="btn btn-primary" disabled={savingPwd} onClick={() => void changePassword()}>
                        {savingPwd ? t('profile.saving') : t('profile.savePassword')}
                      </button>
                    </div>
                  </div>
                )}

                <div className="profile-action-row">
                  <div className="profile-action-icon"><IconActivity /></div>
                  <div className="profile-action-body">
                    <strong>{t('profile.lastLogin')}</strong>
                    <p>
                      {user?.expiresAt
                        ? t('profile.tokenExpires', { date: fmtDate(user.expiresAt, locale) })
                        : t('profile.sessionActive')}
                    </p>
                  </div>
                </div>

                <div className="profile-action-row">
                  <div className="profile-action-icon"><IconUser /></div>
                  <div className="profile-action-body">
                    <strong>{t('profile.activeSession')}</strong>
                    <p>
                      {t('profile.sessionEmail')} {user?.email}<br />
                      {t('profile.sessionRoles')} {roles}<br />
                      {user?.expiresAt && (
                        <>{t('profile.sessionToken')} {fmtDate(user.expiresAt, locale)}</>
                      )}
                    </p>
                  </div>
                  <button type="button" className="btn btn-sm btn-danger" onClick={handleLogout}>
                    {t('profile.disconnect')}
                  </button>
                </div>
              </div>
            </section>
          )}

          {tab === 'preferences' && (
            <section className="files-panel">
              <div className="files-panel-header">
                <div>
                  <h2>{t('profile.preferences')}</h2>
                  <p>{t('profile.preferencesDesc')}</p>
                </div>
              </div>

              <div className="profile-pref-list">
                <div className="profile-pref-item">
                  <div>
                    <strong>{t('profile.language')}</strong>
                    <p>{t('profile.languageHint')}</p>
                  </div>
                  <select
                    className="profile-select"
                    value={lang}
                    onChange={(e) => {
                      setLang(e.target.value as 'fr' | 'en')
                      persistPrefToast()
                    }}
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>
                </div>

                <div className="profile-pref-item">
                  <div>
                    <strong>{t('settings.theme')}</strong>
                    <p>{t('settings.themeHint')}</p>
                  </div>
                  <select
                    className="profile-select"
                    value={theme}
                    onChange={(e) => handleThemeChange(e.target.value as 'light' | 'dark')}
                  >
                    <option value="light">{t('settings.theme.light')}</option>
                    <option value="dark">{t('settings.theme.dark')}</option>
                  </select>
                </div>

                <div className="profile-pref-item">
                  <div>
                    <strong>{t('settings.homePage')}</strong>
                    <p>{t('settings.homePageHint')}</p>
                  </div>
                  <select className="profile-select" value={homePage} onChange={(e) => handleHomeChange(e.target.value)}>
                    <option value="/">{t('settings.home.dashboard')}</option>
                    <option value="/documents">{t('settings.home.documents')}</option>
                    <option value="/favorites">{t('settings.home.favorites')}</option>
                    <option value="/shared">{t('settings.home.shared')}</option>
                    <option value="/categories">{t('settings.home.categories')}</option>
                  </select>
                </div>

                <div className="profile-pref-item">
                  <div>
                    <strong>{t('settings.compactTable')}</strong>
                    <p>{t('settings.compactTableHint')}</p>
                  </div>
                  <label className="profile-switch">
                    <input type="checkbox" checked={compactTable} onChange={(e) => toggleCompact(e.target.checked)} />
                    <span className="profile-switch-slider" />
                  </label>
                </div>

                <div className="profile-pref-item">
                  <div>
                    <strong>{t('profile.notifInApp')}</strong>
                    <p>{t('profile.notifInAppHint')}</p>
                  </div>
                  <label className="profile-switch">
                    <input type="checkbox" checked={notifInApp} onChange={(e) => toggleNotifInApp(e.target.checked)} />
                    <span className="profile-switch-slider" />
                  </label>
                </div>

                <div className="profile-pref-item">
                  <div>
                    <strong>{t('profile.notifEmail')}</strong>
                    <p>{t('profile.notifEmailHint')}</p>
                  </div>
                  <label className="profile-switch">
                    <input type="checkbox" checked={notifEmail} onChange={(e) => toggleNotifEmail(e.target.checked)} />
                    <span className="profile-switch-slider" />
                  </label>
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="profile-column profile-column-aside">
          <section className="files-panel">
            <div className="files-panel-header">
              <div>
                <h2>{t('profile.recentDocs')}</h2>
                <p>{t('profile.recentDocsDesc')}</p>
              </div>
              <Link to="/documents" className="btn btn-sm btn-outline">{t('profile.seeAll')}</Link>
            </div>
            {!recentDocs.length ? (
              <p className="profile-empty">{t('profile.noRecentDocs')}</p>
            ) : (
              <ul className="profile-doc-list">
                {recentDocs.map((d) => (
                  <li key={d.id}>
                    <div>
                      <strong title={d.fileName}>{d.fileName}</strong>
                      <p>{d.category || '—'} · {fmtSize(d.sizeBytes)}</p>
                    </div>
                    <time>{fmtDate(d.updatedAt || d.createdAt, locale)}</time>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="files-panel">
            <div className="files-panel-header">
              <div>
                <h2>{t('profile.recentActivity')}</h2>
                <p>{t('profile.recentActivityDesc')}</p>
              </div>
            </div>

            {timelineHighlights.length > 0 && (
              <ul className="profile-timeline-highlights">
                {timelineHighlights.map(({ id, label, item }) => (
                  <li key={id}>
                    <span className="profile-timeline-dot" data-type={id} />
                    <div>
                      <strong>{label}</strong>
                      <p>{item!.documentName || activityLabel(item!.action)}</p>
                      <time>{fmtDate(item!.timestamp, locale)}</time>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {!stats?.recentActivity?.length ? (
              <p className="profile-empty">{t('profile.noActivity')}</p>
            ) : (
              <ul className="profile-timeline">
                {stats.recentActivity.slice(0, 8).map((a, i) => (
                  <li key={i} className="profile-timeline-entry">
                    <span className="profile-timeline-dot" data-type={actionIcon(a.action)} />
                    <div>
                      <strong>{activityLabel(a.action)}</strong>
                      {a.documentName && <p>{a.documentName}</p>}
                      <time>{fmtDate(a.timestamp, locale)}</time>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </section>
  )
}
