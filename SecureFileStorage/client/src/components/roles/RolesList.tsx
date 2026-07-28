import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/api/client'
import {
  IconAdmin,
  IconFilter,
  IconMore,
  IconSearch,
  IconUsers,
} from '@/components/categories/CategoryIcons'
import { IconShield } from '@/components/profile/ProfileIcons'
import { RolePermissionsPanel } from '@/components/roles/RolePermissionsPanel'
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/i18n/I18nContext'
import {
  countRolePermissions,
  isSystemRole,
  totalPermissionCount,
} from '@/utils/rolePermissions'
import type { AdminUser, RoleDto } from '@/types'

type SortKey = 'name' | 'users' | 'permissions'

interface Filters {
  search: string
}

const EMPTY_FILTERS: Filters = { search: '' }

function roleLabel(name: string, t: (k: string) => string) {
  const lower = name.toLowerCase()
  if (lower === 'admin') return t('role.admin')
  if (lower === 'user') return t('role.user')
  return name
}

function userInitials(u: AdminUser) {
  const a = (u.firstName?.[0] || u.email?.[0] || '?').toUpperCase()
  const b = (u.lastName?.[0] || '').toUpperCase()
  return `${a}${b}`.slice(0, 2)
}

function userFullName(u: AdminUser) {
  const n = `${u.firstName || ''} ${u.lastName || ''}`.trim()
  return n || u.email
}

function usersWithRole(users: AdminUser[], roleName: string) {
  return users.filter((u) => u.roles.some((r) => r.toLowerCase() === roleName.toLowerCase()))
}

interface RolesListProps {
  roles: RoleDto[]
  users: AdminUser[]
  onChanged: () => void
}

export function RolesList({ roles, users, onChanged }: RolesListProps) {
  const { t } = useI18n()

  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [editRole, setEditRole] = useState<RoleDto | null>(null)
  const [detailRole, setDetailRole] = useState<RoleDto | null>(null)
  const [permRole, setPermRole] = useState<RoleDto | null>(null)
  const [assignRole, setAssignRole] = useState<RoleDto | null>(null)
  const [deleteRole, setDeleteRole] = useState<RoleDto | null>(null)
  const [deleteAck, setDeleteAck] = useState(false)

  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [formError, setFormError] = useState('')

  const [editForm, setEditForm] = useState({ name: '', description: '' })
  const [assignUserId, setAssignUserId] = useState('')

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 4200)
  }, [])

  useEffect(() => {
    setDeleteAck(false)
  }, [deleteRole])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(null)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  useEffect(() => {
    if (editRole) {
      setEditForm({ name: editRole.name, description: editRole.description })
      setFormError('')
    }
  }, [editRole])

  const enriched = useMemo(
    () =>
      roles.map((r) => ({
        ...r,
        userCount: usersWithRole(users, r.name).length,
        permCount: countRolePermissions(r.name),
        system: isSystemRole(r.name),
      })),
    [roles, users]
  )

  const hasActiveFilters = useMemo(
    () => filters.search.trim() !== '',
    [filters]
  )

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    return enriched.filter((r) => {
      if (q && !`${r.name} ${r.description}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [enriched, filters])

  const sorted = useMemo(() => {
    const list = [...filtered]
    const dir = sortAsc ? 1 : -1
    list.sort((a, b) => {
      switch (sortKey) {
        case 'users':
          return dir * (a.userCount - b.userCount)
        case 'permissions':
          return dir * (a.permCount - b.permCount)
        case 'name':
        default:
          return dir * a.name.localeCompare(b.name)
      }
    })
    return list
  }, [filtered, sortKey, sortAsc])

  const stats = useMemo(() => {
    const withRoles = users.filter((u) => u.roles.length > 0).length
    return {
      total: roles.length,
      active: roles.length,
      permissions: totalPermissionCount(),
      usersWithRoles: withRoles,
    }
  }, [roles, users])

  const assignCandidates = useMemo(() => {
    if (!assignRole) return []
    return users.filter(
      (u) => !u.roles.some((r) => r.toLowerCase() === assignRole.name.toLowerCase())
    )
  }, [assignRole, users])

  const saveEdit = async () => {
    if (!editRole) return
    setFormError('')
    if (!editForm.name.trim() && !isSystemRole(editRole.name)) {
      setFormError(t('roles.nameRequired'))
      return
    }
    setBusy(true)
    try {
      await api(`/api/admin/roles/${editRole.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: isSystemRole(editRole.name) ? undefined : editForm.name.trim(),
          description: editForm.description.trim(),
        }),
      })
      setEditRole(null)
      showToast(t('roles.updated'))
      onChanged()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t('msg.loadProfileError'))
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteRole || !deleteAck) return
    if (isSystemRole(deleteRole.name)) {
      showToast(t('roles.systemDeleteBlocked'), 'error')
      return
    }
    setBusy(true)
    try {
      await api(`/api/admin/roles/${deleteRole.id}`, { method: 'DELETE' })
      setDeleteRole(null)
      showToast(t('roles.deleted'))
      onChanged()
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('roles.deleteFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const assignToUser = async () => {
    if (!assignRole || !assignUserId) return
    setBusy(true)
    try {
      await api('/api/admin/roles/assign', {
        method: 'POST',
        body: JSON.stringify({ userId: assignUserId, roleId: assignRole.id }),
      })
      setAssignRole(null)
      setAssignUserId('')
      showToast(t('roles.assigned'))
      onChanged()
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('msg.loadProfileError'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const renderMenu = (role: (typeof enriched)[0]) => (
    <div className="roles-menu-wrap" ref={menuOpen === role.id ? menuRef : undefined}>
      <button
        type="button"
        className="roles-menu-btn"
        aria-label={t('table.actions')}
        onClick={(e) => {
          e.stopPropagation()
          setMenuOpen(menuOpen === role.id ? null : role.id)
        }}
      >
        <IconMore size={18} />
      </button>
      {menuOpen === role.id && (
        <div className="cat-dropdown roles-dropdown" role="menu">
          <button type="button" role="menuitem" onClick={() => { setDetailRole(role); setMenuOpen(null) }}>
            {t('roles.viewDetails')}
          </button>
          <button type="button" role="menuitem" onClick={() => { setEditRole(role); setMenuOpen(null) }}>
            {t('roles.editRole')}
          </button>
          <button type="button" role="menuitem" onClick={() => { setPermRole(role); setMenuOpen(null) }}>
            {t('roles.managePermissions')}
          </button>
          <div className="cat-dropdown-divider" role="separator" />
          <button type="button" role="menuitem" onClick={() => { setAssignRole(role); setMenuOpen(null) }}>
            {t('roles.assignRole')}
          </button>
          {!role.system && (
            <>
              <div className="cat-dropdown-divider" role="separator" />
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => { setDeleteRole(role); setMenuOpen(null) }}
              >
                {t('roles.deleteRole')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )

  const renderUsersList = (role: RoleDto) => {
    const list = usersWithRole(users, role.name)
    if (!list.length) return <p className="roles-muted">{t('roles.noUsersInRole')}</p>
    return (
      <ul className="roles-user-list">
        {list.map((u) => (
          <li key={u.id} className="roles-user-row">
            <div className="roles-user-avatar">{userInitials(u)}</div>
            <div className="roles-user-info">
              <span className="roles-user-name">{userFullName(u)}</span>
              <span className="roles-user-email">{u.email}</span>
            </div>
            <span className={`users-badge users-badge-status${u.isActive ? ' active' : ' inactive'}`}>
              {u.isActive ? t('status.active') : t('status.inactive')}
            </span>
          </li>
        ))}
      </ul>
    )
  }

  const emptyState = () => (
    <div className="roles-empty">
      <div className="roles-empty-icon"><IconSearch size={48} /></div>
      <h3>{roles.length === 0 ? t('roles.emptyTitle') : t('roles.noResults')}</h3>
      <p>{roles.length === 0 ? t('roles.emptyDescTwo') : t('roles.noResultsDesc')}</p>
      {hasActiveFilters && (
        <button type="button" className="btn btn-outline" onClick={() => setFilters(EMPTY_FILTERS)}>
          {t('cat.clearFilters')}
        </button>
      )}
    </div>
  )

  return (
    <div className="roles-docs-view">
      {toast && (
        <div className={`profile-toast profile-toast-${toast.type === 'error' ? 'error' : 'success'}`} role="status">
          {toast.message}
        </div>
      )}

      <div className="roles-toolbar">
        <div className="roles-search-wrap">
          <IconSearch size={18} className="roles-search-icon" />
          <input
            type="search"
            className="roles-search-input"
            placeholder={t('roles.searchPlaceholder')}
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
        </div>
        <div className="roles-toolbar-actions">
          <button
            type="button"
            className={`btn btn-sm btn-outline roles-filter-toggle${filtersOpen ? ' active' : ''}`}
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <IconFilter size={16} />
            {t('filter.advanced')}
          </button>
          {hasActiveFilters && (
            <button type="button" className="btn btn-sm btn-outline" onClick={() => setFilters(EMPTY_FILTERS)}>
              {t('cat.clearFilters')}
            </button>
          )}
          <select
            className="roles-sort-select"
            value={`${sortKey}-${sortAsc ? 'asc' : 'desc'}`}
            onChange={(e) => {
              const [k, dir] = e.target.value.split('-') as [SortKey, 'asc' | 'desc']
              setSortKey(k)
              setSortAsc(dir === 'asc')
            }}
            aria-label={t('roles.sortBy')}
          >
            <option value="name-asc">{t('roles.sortName')}</option>
            <option value="name-desc">{t('roles.sortNameDesc')}</option>
            <option value="users-desc">{t('roles.sortUsers')}</option>
            <option value="permissions-desc">{t('roles.sortPermissions')}</option>
          </select>
        </div>
      </div>

      {filtersOpen && (
        <div className="roles-filters-panel">
          <p className="roles-muted">{t('roles.twoRolesHint')}</p>
        </div>
      )}

      <div className="roles-stats-row">
        <div className="roles-stat-card">
          <div className="roles-stat-icon roles-stat-icon-blue"><IconShield size={20} /></div>
          <div>
            <div className="roles-stat-value">{stats.total}</div>
            <div className="roles-stat-label">{t('roles.statTotal')}</div>
          </div>
        </div>
        <div className="roles-stat-card">
          <div className="roles-stat-icon roles-stat-icon-green"><IconAdmin size={20} /></div>
          <div>
            <div className="roles-stat-value">{stats.active}</div>
            <div className="roles-stat-label">{t('roles.statActive')}</div>
          </div>
        </div>
        <div className="roles-stat-card">
          <div className="roles-stat-icon roles-stat-icon-indigo"><IconShield size={20} /></div>
          <div>
            <div className="roles-stat-value">{stats.permissions}</div>
            <div className="roles-stat-label">{t('roles.statPermissions')}</div>
          </div>
        </div>
        <div className="roles-stat-card">
          <div className="roles-stat-icon roles-stat-icon-amber"><IconUsers size={20} /></div>
          <div>
            <div className="roles-stat-value">{stats.usersWithRoles}</div>
            <div className="roles-stat-label">{t('roles.statUsersWithRoles')}</div>
          </div>
        </div>
      </div>

      {!sorted.length ? (
        emptyState()
      ) : (
        <div className="roles-grid">
          {sorted.map((role) => (
            <article key={role.id} className="roles-card">
              <div className="roles-card-head">
                <div className="roles-card-icon">
                  {role.system ? <IconAdmin size={22} /> : <IconShield size={22} />}
                </div>
                <div className="roles-card-title-wrap">
                  <h3 className="roles-card-title">{roleLabel(role.name, t)}</h3>
                  <div className="roles-card-badges">
                    {role.system && (
                      <span className="roles-badge roles-badge-system">{t('roles.systemRole')}</span>
                    )}
                    <span className="roles-badge roles-badge-active">{t('status.active')}</span>
                  </div>
                </div>
                {renderMenu(role)}
              </div>
              <p className="roles-card-desc">{role.description || t('roles.noDescription')}</p>
              <div className="roles-card-metrics">
                <div>
                  <span className="roles-metric-value">{role.userCount}</span>
                  <span className="roles-metric-label">{t('roles.usersCount')}</span>
                </div>
                <div>
                  <span className="roles-metric-value">{role.permCount}</span>
                  <span className="roles-metric-label">{t('roles.permissionsCount')}</span>
                </div>
                <div>
                  <span className="roles-metric-value">{t('users.notAvailable')}</span>
                  <span className="roles-metric-label">{t('table.created')}</span>
                </div>
              </div>
              <button type="button" className="btn btn-sm btn-outline roles-card-action" onClick={() => setDetailRole(role)}>
                {t('roles.viewDetails')}
              </button>
            </article>
          ))}
        </div>
      )}

      {editRole && (
        <Modal title={t('roles.editRole')} onClose={() => !busy && setEditRole(null)} wide>
          {formError && <div className="msg error">{formError}</div>}
          <div className="roles-form-grid">
            <div className="form-group">
              <label htmlFor="edit-role-name">{t('roles.roleName')}</label>
              <input
                id="edit-role-name"
                value={editForm.name}
                disabled={isSystemRole(editRole.name)}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
              {isSystemRole(editRole.name) && <p className="roles-muted">{t('roles.systemNameLocked')}</p>}
            </div>
            <div className="form-group roles-form-full">
              <label htmlFor="edit-role-desc">{t('roles.roleDescription')}</label>
              <textarea
                id="edit-role-desc"
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <h4 className="roles-section-label">{t('roles.managePermissions')}</h4>
          <RolePermissionsPanel roleName={editRole.name} readOnly accordion />
          <div className="modal-footer">
            <button type="button" className="btn" onClick={() => setEditRole(null)} disabled={busy}>{t('btn.cancel')}</button>
            <button type="button" className="btn btn-primary" onClick={() => void saveEdit()} disabled={busy}>
              {busy ? t('profile.saving') : t('roles.saveChanges')}
            </button>
          </div>
        </Modal>
      )}

      {detailRole && (
        <Modal title={t('roles.viewDetails')} onClose={() => setDetailRole(null)} wide>
          <div className="roles-detail-header">
            <div className="roles-detail-icon">
              {isSystemRole(detailRole.name) ? <IconAdmin size={28} /> : <IconShield size={28} />}
            </div>
            <div>
              <h3>{roleLabel(detailRole.name, t)}</h3>
              <p className="roles-muted">{detailRole.description || t('roles.noDescription')}</p>
              <div className="roles-card-badges">
                {isSystemRole(detailRole.name) && (
                  <span className="roles-badge roles-badge-system">{t('roles.systemRole')}</span>
                )}
                <span className="roles-badge roles-badge-active">{t('status.active')}</span>
              </div>
            </div>
          </div>
          <div className="roles-detail-metrics">
            <div><strong>{usersWithRole(users, detailRole.name).length}</strong> {t('roles.usersCount')}</div>
            <div><strong>{countRolePermissions(detailRole.name)}</strong> {t('roles.permissionsCount')}</div>
          </div>
          <h4 className="roles-section-label">{t('roles.managePermissions')}</h4>
          <RolePermissionsPanel roleName={detailRole.name} readOnly accordion />
          <h4 className="roles-section-label">{t('roles.usersWithRole')}</h4>
          {renderUsersList(detailRole)}
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={() => { setAssignRole(detailRole); setDetailRole(null) }}>
              {t('roles.assignRole')}
            </button>
            <button type="button" className="btn" onClick={() => setDetailRole(null)}>{t('btn.close')}</button>
          </div>
        </Modal>
      )}

      {permRole && (
        <Modal title={t('roles.managePermissions')} onClose={() => setPermRole(null)} wide>
          <p className="roles-muted">{roleLabel(permRole.name, t)}</p>
          <RolePermissionsPanel roleName={permRole.name} readOnly accordion />
          <div className="modal-footer">
            <button type="button" className="btn" onClick={() => setPermRole(null)}>{t('btn.close')}</button>
          </div>
        </Modal>
      )}

      {assignRole && (
        <Modal title={t('roles.assignRole')} onClose={() => !busy && setAssignRole(null)}>
          <p className="roles-muted">{t('roles.assignIntro', { role: roleLabel(assignRole.name, t) })}</p>
          <div className="roles-assign-flow">
            <div className="roles-assign-step">
              <span className="roles-assign-label">{t('role.user')}</span>
              <select value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}>
                <option value="">{t('roles.selectUser')}</option>
                {assignCandidates.map((u) => (
                  <option key={u.id} value={u.id}>{userFullName(u)} ({u.email})</option>
                ))}
              </select>
            </div>
            <div className="roles-assign-arrow">↓</div>
            <div className="roles-assign-step">
              <span className="roles-assign-label">{t('roles.assignedRole')}</span>
              <strong>{roleLabel(assignRole.name, t)}</strong>
            </div>
            <div className="roles-assign-arrow">↓</div>
            <div className="roles-assign-step">
              <span className="roles-assign-label">{t('roles.inheritedPermissions')}</span>
              <span className="roles-muted">{countRolePermissions(assignRole.name)} {t('roles.permissionsCount')}</span>
            </div>
          </div>
          <p className="roles-muted roles-assign-note">{t('roles.removeRoleNote')}</p>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={() => setAssignRole(null)} disabled={busy}>{t('btn.cancel')}</button>
            <button type="button" className="btn btn-primary" onClick={() => void assignToUser()} disabled={busy || !assignUserId}>
              {busy ? t('profile.saving') : t('roles.assignRole')}
            </button>
          </div>
        </Modal>
      )}

      {deleteRole && (
        <Modal title={t('roles.deleteRole')} onClose={() => !busy && setDeleteRole(null)}>
          <p className="roles-confirm-msg">{t('roles.deleteConfirmMsg')}</p>
          {usersWithRole(users, deleteRole.name).length > 0 && (
            <p className="roles-warning">{t('roles.deleteUsersWarning', { count: String(usersWithRole(users, deleteRole.name).length) })}</p>
          )}
          <label className="roles-delete-ack">
            <input type="checkbox" checked={deleteAck} onChange={(e) => setDeleteAck(e.target.checked)} />
            {t('roles.deleteAck')}
          </label>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={() => setDeleteRole(null)} disabled={busy}>{t('btn.cancel')}</button>
            <button type="button" className="btn btn-danger" onClick={() => void confirmDelete()} disabled={busy || !deleteAck}>
              {busy ? t('profile.saving') : t('btn.confirm')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
