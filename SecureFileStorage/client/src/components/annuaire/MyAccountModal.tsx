import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { api } from '@/api/client'
import { IconCamera, IconMail, IconShield, IconUser } from '@/components/profile/ProfileIcons'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/context/AuthContext'
import { useProfileAvatar } from '@/hooks/useProfileAvatar'
import { useI18n } from '@/i18n/I18nContext'
import {
  processAvatarFile,
  removeProfileAvatar,
  saveProfileAvatar,
  validateAvatarFile,
} from '@/utils/profileAvatarStorage'
import { PREF_NOTIF_INAPP_KEY } from '@/constants'
import type { ProfileUser } from '@/types'

export function MyAccountModal({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved?: () => void
}) {
  const { t } = useI18n()
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
      await api('/api/auth/me/avatar', {
        method: 'PUT',
        body: JSON.stringify({ dataUrl }),
      })
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

  return (
    <Modal title={t('annuaire.myAccount')} onClose={onClose}>
      {loading ? (
        <p className="muted">{t('files.loading')}</p>
      ) : (
        <div className="folder-modal account-modal">
          <div className="account-modal-identity">
            <div className={`profile-avatar-lg${avatarUrl ? ' has-photo' : ''}`}>
              {avatarUrl ? <img src={avatarUrl} alt="" className="profile-avatar-img" /> : initials}
            </div>
            <div>
              <p className="account-modal-email">
                <IconMail size={14} />
                {accountEmail}
              </p>
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
            </div>
          </div>

          {error && <p className="msg error">{error}</p>}
          {saved && <p className="msg success">{saved}</p>}

          <div className="profile-form-grid">
            <div className="profile-field">
              <label htmlFor="acc-first">
                <IconUser size={16} />
                {t('profile.firstName')}
              </label>
              <input
                id="acc-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
              />
            </div>
            <div className="profile-field">
              <label htmlFor="acc-last">
                <IconUser size={16} />
                {t('profile.lastName')}
              </label>
              <input
                id="acc-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveName()}>
              {saving ? t('profile.saving') : t('btn.save')}
            </button>
          </div>

          <h4 className="account-modal-section">{t('settings.nav.notifications')}</h4>
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

          <h4 className="account-modal-section">
            <IconShield size={16} />
            {t('profile.changePassword')}
          </h4>
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
              <input
                id="acc-pwd-new"
                type="password"
                value={pwdNew}
                onChange={(e) => setPwdNew(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="profile-field">
              <label htmlFor="acc-pwd-confirm">{t('profile.confirmPassword')}</label>
              <input
                id="acc-pwd-confirm"
                type="password"
                value={pwdConfirm}
                onChange={(e) => setPwdConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              {t('btn.close')}
            </button>
            <button type="button" className="btn btn-primary" disabled={savingPwd} onClick={() => void changePassword()}>
              {savingPwd ? t('profile.saving') : t('profile.savePassword')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
