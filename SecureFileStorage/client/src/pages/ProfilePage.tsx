import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { api } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { ProfileSkeleton } from '@/components/profile/ProfileSkeleton'
import {
  IconActivity,
  IconCalendar,
  IconCamera,
  IconMail,
  IconPhone,
  IconShield,
  IconUser,
} from '@/components/profile/ProfileIcons'
import { PREF_NOTIF_EMAIL_KEY, PREF_NOTIF_INAPP_KEY } from '@/constants'
import { useI18n } from '@/i18n/I18nContext'
import { buildQuery, fmtDate, fmtSize } from '@/utils/format'
import { useProfileAvatar } from '@/hooks/useProfileAvatar'
import {
  processAvatarFile,
  removeProfileAvatar,
  saveProfileAvatar,
  validateAvatarFile,
} from '@/utils/profileAvatarStorage'
import type { DashboardStats, ProfileUser, RecentActivity } from '@/types'

type ToastType = 'success' | 'error'

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

  const [profile, setProfile] = useState<ProfileUser | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [archivedCount, setArchivedCount] = useState(0)
  const [loading, setLoading] = useState(true)

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
    const [p, d, archived] = await Promise.all([
      api<ProfileUser>('/api/auth/me'),
      api<DashboardStats>('/api/dashboard'),
      api<{ totalCount: number }>(`/api/documents${buildQuery({ status: 'Archived', page: 1, pageSize: 1 })}`),
    ])
    setProfile(p)
    setStats(d)
    setArchivedCount(archived.totalCount ?? 0)
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

  const privateCount = useMemo(
    () => stats?.recentDocuments?.filter((d) => d.visibility === 'Private').length ?? 0,
    [stats]
  )
  const sharedCount = useMemo(
    () => stats?.recentDocuments?.filter((d) => d.visibility !== 'Private').length ?? 0,
    [stats]
  )

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
      { id: 'update', label: t('profile.timeline.update'), item: find((a) => /update|edit|version/i.test(a.action)) },
      { id: 'share', label: t('profile.timeline.share'), item: find((a) => /share/i.test(a.action)) },
    ]
    return items.filter((x) => x.item)
  }, [stats, t])

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

  const toggleNotifInApp = (on: boolean) => {
    setNotifInApp(on)
    localStorage.setItem(PREF_NOTIF_INAPP_KEY, String(on))
    showToast(t('profile.langSaved'))
  }

  const toggleNotifEmail = (on: boolean) => {
    setNotifEmail(on)
    localStorage.setItem(PREF_NOTIF_EMAIL_KEY, String(on))
    showToast(t('profile.langSaved'))
  }

  const handleAvatarClick = () => {
    avatarInputRef.current?.click()
  }

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
  const primaryRole = profile?.roles?.includes('Admin') ? t('role.admin') : t('role.user')

  return (
    <section className="page profile-page files-like-page" id="page-profile">
      {toast && (
        <div className={`profile-toast profile-toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      )}

      {/* ── En-tête profil ── */}
      <header className="profile-header-card">
        <div className="profile-header-main">
          <div className="profile-avatar-wrap">
            <div
              className={`profile-avatar-lg${avatarUrl ? ' has-photo' : ''}`}
              aria-hidden={!!avatarUrl}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="profile-avatar-img" />
              ) : (
                initials
              )}
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
          <div className="profile-header-info">
            <h2 className="profile-header-name">{fullName}</h2>
            <p className="profile-header-email">
              <IconMail size={16} />
              {profile?.email || user?.email}
            </p>
            <div className="profile-header-badges">
              <span className="profile-badge profile-badge-role">{primaryRole}</span>
              <span className={`profile-badge profile-badge-status${profile?.isActive ? ' active' : ''}`}>
                {profile?.isActive ? t('status.active') : t('status.inactive')}
              </span>
            </div>
            <p className="profile-header-meta">
              <IconCalendar size={15} />
              {t('profile.memberSince')} {fmtDate(profile?.createdAt, locale)}
            </p>
            {avatarUrl && (
              <button
                type="button"
                className="profile-avatar-remove"
                onClick={handleAvatarRemove}
                disabled={uploadingAvatar}
              >
                {t('profile.avatarRemove')}
              </button>
            )}
          </div>
        </div>
        <div className="profile-header-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditing(true)
              setFormError('')
            }}
          >
            {t('profile.editProfile')}
          </button>
        </div>
      </header>

      {/* ── Statistiques ── */}
      <div className="profile-stats-row" id="profile-stats">
        <div className="profile-stat-card">
          <span className="profile-stat-value">{stats?.totalDocuments ?? 0}</span>
          <span className="profile-stat-label">{t('profile.statTotal')}</span>
        </div>
        <div className="profile-stat-card">
          <span className="profile-stat-value">{privateCount}</span>
          <span className="profile-stat-label">{t('profile.statPrivate')}</span>
        </div>
        <div className="profile-stat-card">
          <span className="profile-stat-value">{sharedCount}</span>
          <span className="profile-stat-label">{t('profile.statShared')}</span>
        </div>
        <div className="profile-stat-card">
          <span className="profile-stat-value">{archivedCount}</span>
          <span className="profile-stat-label">{t('profile.statArchived')}</span>
        </div>
        <div className="profile-stat-card profile-stat-card-accent">
          <span className="profile-stat-value">{fmtSize(stats?.storageUsedBytes)}</span>
          <span className="profile-stat-label">{t('profile.statStorage')}</span>
        </div>
      </div>

      <div className="profile-layout">
        <div className="profile-column profile-column-main">
          {/* ── Informations personnelles ── */}
          <section className="profile-section card">
            <div className="profile-section-head">
              <div>
                <h3 className="profile-section-title">{t('profile.personalInfo')}</h3>
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
                  <dt><IconPhone size={16} />{t('profile.phone')}</dt>
                  <dd className="profile-detail-muted">{t('profile.phoneEmpty')}</dd>
                </div>
                <div className="profile-detail-item profile-detail-full">
                  <dt><IconCalendar size={16} />{t('profile.accountCreated')}</dt>
                  <dd>{fmtDate(profile?.createdAt, locale)}</dd>
                </div>
              </dl>
            )}
          </section>

          {/* ── Sécurité ── */}
          <section className="profile-section card">
            <div className="profile-section-head">
              <h3 className="profile-section-title">{t('profile.security')}</h3>
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
                <div className="profile-action-icon"><IconShield /></div>
                <div className="profile-action-body">
                  <strong>{t('profile.twoFactor')}</strong>
                  <p>{t('profile.twoFactorOff')}</p>
                </div>
                <span className="profile-soon-badge">{t('profile.soon')}</span>
              </div>

              <div className="profile-action-row">
                <div className="profile-action-icon"><IconUser /></div>
                <div className="profile-action-body">
                  <strong>{t('profile.activeSession')}</strong>
                  <p>
                    {t('profile.sessionEmail')} {user?.email}<br />
                    {t('profile.sessionRoles')} {(profile?.roles || []).map(roleLabel).join(', ') || '—'}<br />
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

          {/* ── Préférences ── */}
          <section className="profile-section card">
            <div className="profile-section-head">
              <h3 className="profile-section-title">{t('profile.preferences')}</h3>
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
                    showToast(t('profile.langSaved'))
                  }}
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
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
        </div>

        <div className="profile-column profile-column-aside">
          {/* ── Activité récente ── */}
          <section className="profile-section card">
            <div className="profile-section-head">
              <h3 className="profile-section-title">{t('profile.recentActivity')}</h3>
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

