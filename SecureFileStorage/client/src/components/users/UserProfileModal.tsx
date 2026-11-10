import { useEffect, useMemo, useState } from 'react'
import { api } from '@/api/client'
import { IconActivity, IconCalendar, IconMail, IconShield } from '@/components/profile/ProfileIcons'
import { IconUsers } from '@/components/categories/CategoryIcons'
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/i18n/I18nContext'
import { buildQuery, fmtDate } from '@/utils/format'
import type { AdminUser, AuditLog, DocumentDto } from '@/types'

const USER_PERMS = ['view', 'download', 'upload', 'edit', 'share'] as const
const DOC_PERMS = ['view', 'upload', 'download', 'edit', 'share', 'delete'] as const

function isAdminRole(roles: string[]) {
  return roles.some((r) => r.toLowerCase() === 'admin')
}

function initials(u: AdminUser) {
  const a = (u.firstName?.[0] || u.email?.[0] || '?').toUpperCase()
  const b = (u.lastName?.[0] || '').toUpperCase()
  return `${a}${b}`.slice(0, 2)
}

function fullName(u: AdminUser) {
  const n = `${u.firstName || ''} ${u.lastName || ''}`.trim()
  return n || u.email
}

interface UserProfileModalProps {
  userId: string
  groupNames?: string[]
  canManage?: boolean
  onClose: () => void
  onEdit?: () => void
  onToggleActive?: () => void
}

export function UserProfileModal({
  userId,
  groupNames = [],
  canManage = false,
  onClose,
  onEdit,
  onToggleActive,
}: UserProfileModalProps) {
  const { t, locale } = useI18n()
  const [user, setUser] = useState<AdminUser | null>(null)
  const [activity, setActivity] = useState<AuditLog[]>([])
  const [ownedDocs, setOwnedDocs] = useState<DocumentDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [roleBusy, setRoleBusy] = useState(false)
  const [roleMsg, setRoleMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [u, audit, docs] = await Promise.all([
          api<AdminUser>(`/api/admin/users/${userId}`),
          api<{ items: AuditLog[] }>(`/api/admin/audit${buildQuery({ userId, page: 1, pageSize: 15 })}`),
          api<{ items: DocumentDto[] }>(`/api/documents${buildQuery({ ownerId: userId, page: 1, pageSize: 8 })}`),
        ])
        if (cancelled) return
        setUser(u)
        setActivity(audit.items || [])
        setOwnedDocs((docs.items || []).filter((d) => !d.isFolder))
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : t('msg.loadProfileError'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [userId, t])

  const admin = user ? isAdminRole(user.roles) : false
  const lastActivity = activity[0]?.timestamp

  const permissions = useMemo(() => {
    return DOC_PERMS.map((key) => ({
      key,
      granted: admin || (USER_PERMS as readonly string[]).includes(key),
    }))
  }, [admin])

  const activityLabel = (action: string) => {
    const key = `action.${action}`
    const label = t(key)
    return label !== key ? label : action
  }

  if (loading) {
    return (
      <Modal title={t('users.viewProfile')} onClose={onClose} wide>
        <p className="users-muted">{t('users.loadingProfile')}</p>
      </Modal>
    )
  }

  if (error || !user) {
    return (
      <Modal title={t('users.viewProfile')} onClose={onClose}>
        <div className="msg error">{error || t('msg.loadProfileError')}</div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>{t('btn.close')}</button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title={t('users.viewProfile')} onClose={onClose} wide>
      <div className="users-profile-modal">
        <div className="users-profile-header">
          <div className="users-avatar users-avatar-lg">
            {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="profile-avatar-img" /> : initials(user)}
          </div>
          <div>
            <h4 className="users-profile-name">{fullName(user)}</h4>
            <p className="users-profile-email">
              <IconMail size={15} />
              {user.email}
            </p>
            <div className="users-profile-badges">
              <span className={`users-badge users-badge-role${admin ? ' admin' : ''}`}>
                {admin ? t('role.admin') : t('role.user')}
              </span>
              <span className={`users-badge users-badge-status${user.isActive ? ' active' : ' inactive'}`}>
                {user.isActive ? t('status.active') : t('status.inactive')}
              </span>
            </div>
            {canManage && (
              <div className="form-group" style={{ marginTop: 12 }}>
                <label htmlFor="profile-role">{t('users.roleLabel')}</label>
                <select
                  id="profile-role"
                  value={admin ? 'Admin' : 'User'}
                  disabled={roleBusy}
                  onChange={(e) => {
                    const roleName = e.target.value
                    void (async () => {
                      setRoleBusy(true)
                      setRoleMsg('')
                      try {
                        const updated = await api<AdminUser>(`/api/admin/users/${user.id}/role`, {
                          method: 'POST',
                          body: JSON.stringify({ roleName }),
                        })
                        setUser(updated)
                        setRoleMsg(t('users.roleUpdated'))
                      } catch (err) {
                        setRoleMsg(err instanceof Error ? err.message : t('msg.loadProfileError'))
                      } finally {
                        setRoleBusy(false)
                      }
                    })()
                  }}
                >
                  <option value="User">{t('role.user')}</option>
                  <option value="Admin">{t('role.admin')}</option>
                </select>
                {roleMsg && <p className="muted">{roleMsg}</p>}
              </div>
            )}
          </div>
        </div>

        <div className="users-profile-stats">
          <div className="users-profile-stat">
            <span className="users-profile-stat-label">{t('users.groups')}</span>
            <span className="users-profile-stat-value">
              {groupNames.length ? groupNames.join(', ') : t('annuaire.noGroup')}
            </span>
          </div>
          <div className="users-profile-stat">
            <span className="users-profile-stat-label">{t('profile.memberSince')}</span>
            <span className="users-profile-stat-value">
              <IconCalendar size={14} />
              {fmtDate(user.createdAt, locale)}
            </span>
          </div>
          <div className="users-profile-stat">
            <span className="users-profile-stat-label">{t('users.lastActivity')}</span>
            <span className="users-profile-stat-value">
              {lastActivity ? fmtDate(lastActivity, locale) : t('users.notAvailable')}
            </span>
          </div>
          <div className="users-profile-stat">
            <span className="users-profile-stat-label">{t('users.sharedDocs')}</span>
            <span className="users-profile-stat-value">{ownedDocs.length}</span>
          </div>
        </div>

        <div className="users-profile-section">
          <h5 className="users-section-title">
            <IconShield size={16} />
            {t('users.permissionsTitle')}
          </h5>
          <div className="users-perm-grid">
            {permissions.map((p) => (
              <div key={p.key} className={`users-perm-item${p.granted ? ' granted' : ''}`}>
                <span className="users-perm-icon">{p.granted ? '✓' : '✕'}</span>
                <span>{t(`perm.${p.key}`)}</span>
              </div>
            ))}
          </div>
          {admin && (
            <p className="users-muted users-perm-note">
              <IconUsers size={14} />
              {t('users.adminFullAccess')}
            </p>
          )}
        </div>

        <div className="users-profile-section">
          <h5 className="users-section-title">{t('users.sharedWithUser')}</h5>
          {ownedDocs.length === 0 ? (
            <p className="users-muted">{t('users.noSharedDocs')}</p>
          ) : (
            <ul className="annuaire-doc-list">
              {ownedDocs.map((d) => (
                <li key={d.id}>
                  <strong>{d.fileName}</strong>
                  <span>{d.category}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="users-profile-section">
          <h5 className="users-section-title">
            <IconActivity size={16} />
            {t('users.recentActivity')}
          </h5>
          {!activity.length ? (
            <p className="users-muted">{t('users.noActivity')}</p>
          ) : (
            <ul className="users-activity-list">
              {activity.map((a) => (
                <li key={a.id} className="users-activity-item">
                  <div className="users-activity-main">
                    <span className="users-activity-action">{activityLabel(a.action)}</span>
                    {a.details && <span className="users-activity-detail">{a.details}</span>}
                  </div>
                  <time className="users-activity-time">{fmtDate(a.timestamp, locale)}</time>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn" onClick={onClose}>{t('btn.close')}</button>
        {canManage && onEdit && (
          <button type="button" className="btn btn-outline" onClick={onEdit}>{t('btn.edit')}</button>
        )}
        {canManage && onToggleActive && (
          <button
            type="button"
            className={user.isActive ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={onToggleActive}
          >
            {user.isActive ? t('btn.deactivate') : t('users.activate')}
          </button>
        )}
      </div>
    </Modal>
  )
}
