import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { api } from '@/api/client'
import { IconUsers } from '@/components/categories/CategoryIcons'
import { IconCamera, IconMail, IconShield, IconUser } from '@/components/profile/ProfileIcons'
import { useAuth } from '@/context/AuthContext'
import { useProfileAvatar } from '@/hooks/useProfileAvatar'
import { useI18n } from '@/i18n/I18nContext'
import { fmtDate } from '@/utils/format'
import {
  processAvatarFile,
  removeProfileAvatar,
  saveProfileAvatar,
  validateAvatarFile,
} from '@/utils/profileAvatarStorage'
import { PREF_NOTIF_INAPP_KEY } from '@/constants'
import type { ProfileUser } from '@/types'

function isAdminRole(roles: string[]) {
  return roles.some((r) => r.toLowerCase() === 'admin')
}

export function AnnuaireMePanel({
  groupNames = [],
  isAdmin,
  onGoUsers,
  onGoGroups,
  onSaved,
}: {
  groupNames?: string[]
  isAdmin: boolean
  onGoUsers: () => void
  onGoGroups: () => void
  onSaved?: () => void
}) {
  const { t, locale } = useI18n()
  const { user, patchUser } = useAuth()
  const [profile, setProfile] = useState<ProfileUser | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [pwdCurrent, setPwdCurrent] = useState('')
  const [pwdNew, setPwdNew] = useState('')
  const [pwdConfirm, setPwdConfirm] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)
  const [pwdError, setPwdError] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [notifInApp, setNotifInApp] = useState(() => {
    try {
      return localStorage.getItem(PREF_NOTIF_INAPP_KEY) !== 'false'
    } catch {
      return true
    }
  })
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const accountEmail = profile?.email || user?.email
  const avatarUrl = useProfileAvatar(accountEmail)
  const admin = profile ? isAdminRole(profile.roles) : isAdmin

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const p = await api<ProfileUser>('/api/auth/me')
        if (cancelled) return
        setProfile(p)
        setFirstName(p.firstName)
        setLastName(p.lastName)
        if (p.avatarUrl) saveProfileAvatar(p.email, p.avatarUrl)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : t('msg.loadProfileError'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  const initials = (firstName[0] || lastName[0] || user?.fullName?.[0] || 'U').toUpperCase()
  const displayName = `${firstName} ${lastName}`.trim() || user?.fullName || accountEmail || ''

  const saveName = async () => {
    setError('')
    if (!firstName.trim() || !lastName.trim()) {
      setError(t('msg.nameRequired'))
      return
    }
    setSaving(true)
    try {
      await api('/api/auth/me', {
        method: 'PUT',
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }),
      })
      patchUser({ fullName: `${firstName.trim()} ${lastName.trim()}` })
      setSaved(t('profile.saved'))
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('msg.loadProfileError'))
    } finally {
      setSaving(false)
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
      setPwdCurrent('')
      setPwdNew('')
      setPwdConfirm('')
      setSaved(t('profile.passwordSaved'))
    } catch (e) {
      setPwdError(e instanceof Error ? e.message : t('msg.passwordCurrent'))
    } finally {
      setSavingPwd(false)
    }
  }

  const onAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !accountEmail) return
    const invalid = validateAvatarFile(file)
    if (invalid === 'invalidType') {
      setError(t('profile.avatarInvalidType'))
      return
    }
    if (invalid === 'tooLarge') {
      setError(t('profile.avatarTooLarge'))
      return
    }
    setUploadingAvatar(true)
    setError('')
    try {
      const dataUrl = await processAvatarFile(file)
      await api('/api/auth/me/avatar', { method: 'PUT', body: JSON.stringify({ dataUrl }) })
      saveProfileAvatar(accountEmail, dataUrl)
    } catch {
      setError(t('profile.avatarError'))
    } finally {
      setUploadingAvatar(false)
    }
  }

  const removeAvatar = () => {
    if (!accountEmail) return
    if (!window.confirm(t('profile.avatarRemoveConfirm'))) return
    void api('/api/auth/me/avatar', { method: 'DELETE' }).catch(() => undefined)
    removeProfileAvatar(accountEmail)
  }

  if (loading) {
    return <p className="muted">{t('files.loading')}</p>
  }

  return (
    <div className="annuaire-me">
      <section className="annuaire-me-hero">
        <div className={`profile-avatar-lg${avatarUrl ? ' has-photo' : ''}`}>
          {avatarUrl ? <img src={avatarUrl} alt="" className="profile-avatar-img" /> : initials}
        </div>
        <div className="annuaire-me-hero-text">
          <h2>{displayName}</h2>
          <p>
            <IconMail size={14} />
            {accountEmail}
          </p>
          <div className="annuaire-card-meta">
            <span className={`users-badge users-badge-role${admin ? ' admin' : ''}`}>
              {admin ? t('role.admin') : t('role.user')}
            </span>
            <span className={`users-badge users-badge-status${profile?.isActive !== false ? ' active' : ' inactive'}`}>
              {profile?.isActive !== false ? t('status.active') : t('status.inactive')}
            </span>
          </div>
        </div>
        <div className="account-modal-avatar-actions">
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="profile-avatar-input"
            onChange={(e) => void onAvatarChange(e)}
          />
          <button
            type="button"
            className="btn btn-sm btn-outline"
            disabled={uploadingAvatar}
            onClick={() => avatarInputRef.current?.click()}
          >
            <IconCamera size={14} />
            {t('profile.avatarChange')}
          </button>
          {avatarUrl && (
            <button type="button" className="btn btn-sm btn-outline" onClick={removeAvatar}>
              {t('profile.avatarRemove')}
            </button>
          )}
        </div>
      </section>

      <dl className="annuaire-me-facts">
        <div>
          <dt>{t('users.groups')}</dt>
          <dd>{groupNames.length ? groupNames.join(', ') : t('annuaire.noGroup')}</dd>
        </div>
        <div>
          <dt>{t('profile.memberSince')}</dt>
          <dd>{profile?.createdAt ? fmtDate(profile.createdAt, locale) : '—'}</dd>
        </div>
        <div>
          <dt>{t('table.email')}</dt>
          <dd>{accountEmail}</dd>
        </div>
        <div>
          <dt>{t('users.roleLabel')}</dt>
          <dd>{admin ? t('role.admin') : t('role.user')}</dd>
        </div>
      </dl>

      <div className="annuaire-me-actions">
        {isAdmin ? (
          <>
            <button type="button" className="btn btn-primary" onClick={onGoUsers}>
              <IconUsers size={16} />
              {t('annuaire.manageUsers')}
            </button>
            <button type="button" className="btn btn-outline" onClick={onGoGroups}>
              {t('annuaire.manageGroups')}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={onGoUsers}>
            <IconUsers size={16} />
            {t('annuaire.browsePeople')}
          </button>
        )}
      </div>

      {error && <p className="msg error">{error}</p>}
      {saved && <p className="msg success">{saved}</p>}

      <section className="fiche-card">
        <header className="fiche-card-head">
          <h4>
            <IconUser size={16} />
            {t('profile.personalInfo')}
          </h4>
        </header>
        <div className="profile-form-grid">
          <div className="profile-field">
            <label htmlFor="acc-first">{t('profile.firstName')}</label>
            <input id="acc-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
          </div>
          <div className="profile-field">
            <label htmlFor="acc-last">{t('profile.lastName')}</label>
            <input id="acc-last" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
          </div>
        </div>
        <div className="fiche-card-actions">
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveName()}>
            {saving ? t('profile.saving') : t('btn.save')}
          </button>
        </div>
      </section>

      <section className="fiche-card">
        <header className="fiche-card-head">
          <h4>{t('settings.nav.notifications')}</h4>
        </header>
        <div className="settings-switch-row">
          <div>
            <strong>{t('profile.notifInApp')}</strong>
            <p>{t('profile.notifInAppHint')}</p>
          </div>
          <label className="settings-switch">
            <input
              type="checkbox"
              checked={notifInApp}
              onChange={(e) => {
                const on = e.target.checked
                setNotifInApp(on)
                localStorage.setItem(PREF_NOTIF_INAPP_KEY, String(on))
                window.dispatchEvent(new StorageEvent('storage', { key: PREF_NOTIF_INAPP_KEY }))
              }}
            />
            <span className="settings-switch-slider" />
          </label>
        </div>
        <p className="muted">{t('profile.notifEmailUnavailable')}</p>
      </section>

      <section className="fiche-card">
        <header className="fiche-card-head">
          <h4>
            <IconShield size={16} />
            {t('profile.changePassword')}
          </h4>
        </header>
        {pwdError && <p className="msg error">{pwdError}</p>}
        <div className="profile-field">
          <label htmlFor="acc-pwd-current">{t('profile.currentPassword')}</label>
          <input
            id="acc-pwd-current"
            type="password"
            value={pwdCurrent}
            onChange={(e) => setPwdCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="profile-form-grid">
          <div className="profile-field">
            <label htmlFor="acc-pwd-new">{t('profile.newPassword')}</label>
            <input id="acc-pwd-new" type="password" value={pwdNew} onChange={(e) => setPwdNew(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="profile-field">
            <label htmlFor="acc-pwd-confirm">{t('profile.confirmPassword')}</label>
            <input id="acc-pwd-confirm" type="password" value={pwdConfirm} onChange={(e) => setPwdConfirm(e.target.value)} autoComplete="new-password" />
          </div>
        </div>
        <div className="fiche-card-actions">
          <button type="button" className="btn btn-primary" disabled={savingPwd} onClick={() => void changePassword()}>
            {savingPwd ? t('profile.saving') : t('profile.savePassword')}
          </button>
        </div>
      </section>
    </div>
  )
}
