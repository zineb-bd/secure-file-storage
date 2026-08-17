import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/api/client'
import {
  IconClose,
  IconFilter,
  IconMore,
  IconPlus,
  IconSearch,
  IconUsers,
} from '@/components/categories/CategoryIcons'
import { IconUser } from '@/components/profile/ProfileIcons'
import { UserProfileModal } from '@/components/users/UserProfileModal'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/i18n/I18nContext'
import { fmtDate } from '@/utils/format'
import type { AdminUser } from '@/types'

type SortKey = 'name' | 'created' | 'lastLogin'
type StatusFilter = '' | 'active' | 'inactive'

interface Filters {
  search: string
  status: StatusFilter
  dateFrom: string
  dateTo: string
}

const EMPTY_FILTERS: Filters = {
  search: '',
  status: '',
  dateFrom: '',
  dateTo: '',
}

const USER_PERMS = ['view', 'download', 'upload', 'edit', 'share'] as const
const DOC_PERMS = ['view', 'upload', 'download', 'edit', 'share', 'delete'] as const

type ConfirmKind =
  | 'deactivate-one'
  | 'activate-one'
  | 'delete-one'
  | 'deactivate-bulk'
  | 'activate-bulk'
  | 'delete-bulk'

function isAdminRole(roles: string[]) {
  return roles.some((r) => r.toLowerCase() === 'admin')
}

function fullName(u: AdminUser) {
  const n = `${u.firstName || ''} ${u.lastName || ''}`.trim()
  return n || u.email
}

function initials(u: AdminUser) {
  const a = (u.firstName?.[0] || u.email?.[0] || '?').toUpperCase()
  const b = (u.lastName?.[0] || '').toUpperCase()
  return `${a}${b}`.slice(0, 2)
}

function emailValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

interface UsersListProps {
  users: AdminUser[]
  onChanged: () => void
}

export function UsersList({ users, onChanged }: UsersListProps) {
  const { t, locale } = useI18n()
  const { user: currentUser } = useAuth()

  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [editUser, setEditUser] = useState<AdminUser | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [permUser, setPermUser] = useState<AdminUser | null>(null)
  const [confirm, setConfirm] = useState<{ kind: ConfirmKind; user?: AdminUser } | null>(null)
  const [deleteAck, setDeleteAck] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const [addForm, setAddForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [addError, setAddError] = useState('')

  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', isActive: true })
  const [editError, setEditError] = useState('')

  const standardUsers = useMemo(
    () => users.filter((u) => !isAdminRole(u.roles)),
    [users]
  )

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 4200)
  }, [])

  useEffect(() => {
    setDeleteAck(false)
  }, [confirm])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(null)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  useEffect(() => {
    if (editUser) {
      setEditForm({
        firstName: editUser.firstName,
        lastName: editUser.lastName,
        isActive: editUser.isActive,
      })
      setEditError('')
    }
  }, [editUser])

  const hasActiveFilters = useMemo(
    () => Object.values(filters).some((v) => v.trim() !== ''),
    [filters]
  )

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    return standardUsers.filter((u) => {
      if (q) {
        const hay = `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (filters.status === 'active' && !u.isActive) return false
      if (filters.status === 'inactive' && u.isActive) return false
      const created = u.createdAt?.slice(0, 10)
      if (filters.dateFrom && created && created < filters.dateFrom) return false
      if (filters.dateTo && created && created > filters.dateTo) return false
      return true
    })
  }, [standardUsers, filters])

  const sorted = useMemo(() => {
    const list = [...filtered]
    const dir = sortAsc ? 1 : -1
    list.sort((a, b) => {
      switch (sortKey) {
        case 'created':
          return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        case 'lastLogin':
          return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        case 'name':
        default:
          return dir * fullName(a).localeCompare(fullName(b))
      }
    })
    return list
  }, [filtered, sortKey, sortAsc])

  const stats = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    return {
      total: standardUsers.length,
      active: standardUsers.filter((u) => u.isActive).length,
      inactive: standardUsers.filter((u) => !u.isActive).length,
      newMonth: standardUsers.filter((u) => new Date(u.createdAt) >= monthStart).length,
    }
  }, [standardUsers])

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === sorted.length) setSelected(new Set())
    else setSelected(new Set(sorted.map((u) => u.id)))
  }

  const activateUser = async (u: AdminUser) => {
    await api(`/api/admin/users/${u.id}`, {
      method: 'PUT',
      body: JSON.stringify({ firstName: u.firstName, lastName: u.lastName, isActive: true }),
    })
  }

  const deactivateUser = async (u: AdminUser) => {
    await api(`/api/admin/users/${u.id}/deactivate`, { method: 'POST' })
  }

  const deleteUser = async (id: string) => {
    await api(`/api/admin/users/${id}`, { method: 'DELETE' })
  }

  const openAdd = () => {
    setAddForm({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' })
    setAddError('')
    setAddOpen(true)
  }

  const createUser = async () => {
    setAddError('')
    if (!addForm.firstName.trim() || !addForm.lastName.trim()) {
      setAddError(t('msg.nameRequired'))
      return
    }
    if (!emailValid(addForm.email)) {
      setAddError(t('users.invalidEmail'))
      return
    }
    if (addForm.password.length < 8) {
      setAddError(t('users.passwordMin'))
      return
    }
    if (addForm.password !== addForm.confirmPassword) {
      setAddError(t('users.passwordMismatch'))
      return
    }
    setBusy(true)
    try {
      await api('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: addForm.email.trim(),
          password: addForm.password,
          firstName: addForm.firstName.trim(),
          lastName: addForm.lastName.trim(),
          roleNames: ['User'],
        }),
      })
      setAddOpen(false)
      showToast(t('users.created'))
      onChanged()
    } catch (e) {
      setAddError(e instanceof Error ? e.message : t('msg.loadProfileError'))
    } finally {
      setBusy(false)
    }
  }

  const saveEdit = async () => {
    if (!editUser) return
    setEditError('')
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      setEditError(t('msg.nameRequired'))
      return
    }
    setBusy(true)
    try {
      await api(`/api/admin/users/${editUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          firstName: editForm.firstName.trim(),
          lastName: editForm.lastName.trim(),
          isActive: editForm.isActive,
        }),
      })
      setEditUser(null)
      showToast(t('users.updated'))
      onChanged()
    } catch (e) {
      setEditError(e instanceof Error ? e.message : t('msg.loadProfileError'))
    } finally {
      setBusy(false)
    }
  }

  const runConfirm = async () => {
    if (!confirm) return
    if (confirm.kind.includes('delete') && !deleteAck) return
    setBusy(true)
    try {
      if (confirm.kind === 'deactivate-one' && confirm.user) {
        await deactivateUser(confirm.user)
        showToast(t('users.deactivated'))
      } else if (confirm.kind === 'activate-one' && confirm.user) {
        await activateUser(confirm.user)
        showToast(t('users.activated'))
      } else if (confirm.kind === 'delete-one' && confirm.user) {
        await deleteUser(confirm.user.id)
        showToast(t('users.deleted'))
      } else if (confirm.kind === 'deactivate-bulk') {
        const ids = [...selected]
        await Promise.all(ids.map((id) => deactivateUser(standardUsers.find((u) => u.id === id)!)))
        showToast(t('users.deactivatedBulk', { count: String(ids.length) }))
        setSelected(new Set())
      } else if (confirm.kind === 'activate-bulk') {
        const ids = [...selected]
        await Promise.all(ids.map((id) => activateUser(standardUsers.find((u) => u.id === id)!)))
        showToast(t('users.activatedBulk', { count: String(ids.length) }))
        setSelected(new Set())
      } else if (confirm.kind === 'delete-bulk') {
        const ids = [...selected]
        await Promise.all(ids.map((id) => deleteUser(id)))
        showToast(t('users.deletedBulk', { count: String(ids.length) }))
        setSelected(new Set())
      }
      setConfirm(null)
      onChanged()
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('msg.loadProfileError'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const permRows = useMemo(() => {
    if (!permUser) return []
    return DOC_PERMS.map((key) => ({
      key,
      granted: (USER_PERMS as readonly string[]).includes(key),
    }))
  }, [permUser])

  const renderMenu = (u: AdminUser) => (
    <div className="users-menu-wrap" ref={menuOpen === u.id ? menuRef : undefined}>
      <button
        type="button"
        className="users-menu-btn"
        aria-label={t('table.actions')}
        onClick={(e) => {
          e.stopPropagation()
          setMenuOpen(menuOpen === u.id ? null : u.id)
        }}
      >
        <IconMore size={18} />
      </button>
      {menuOpen === u.id && (
        <div className="cat-dropdown users-dropdown" role="menu">
          <button type="button" role="menuitem" onClick={() => { setProfileId(u.id); setMenuOpen(null) }}>
            {t('users.viewProfile')}
          </button>
          <button type="button" role="menuitem" onClick={() => { setEditUser(u); setMenuOpen(null) }}>
            {t('users.editUser')}
          </button>
          <button type="button" role="menuitem" onClick={() => { setPermUser(u); setMenuOpen(null) }}>
            {t('users.managePermissions')}
          </button>
          <div className="cat-dropdown-divider" role="separator" />
          {u.isActive ? (
            <button
              type="button"
              role="menuitem"
              className="danger"
              disabled={u.email === currentUser?.email}
              onClick={() => { setConfirm({ kind: 'deactivate-one', user: u }); setMenuOpen(null) }}
            >
              {t('btn.deactivate')}
            </button>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => { setConfirm({ kind: 'activate-one', user: u }); setMenuOpen(null) }}
            >
              {t('users.activate')}
            </button>
          )}
          <div className="cat-dropdown-divider" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="danger"
            disabled={u.email === currentUser?.email}
            onClick={() => { setConfirm({ kind: 'delete-one', user: u }); setMenuOpen(null) }}
          >
            {t('btn.delete')}
          </button>
        </div>
      )}
    </div>
  )

  const renderToolbar = () => (
    <>
      <div className="users-toolbar">
        <div className="users-search-wrap">
          <IconSearch size={18} className="users-search-icon" />
          <input
            type="search"
            className="users-search-input"
            placeholder={t('users.searchPlaceholder')}
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
        </div>
        <div className="users-toolbar-actions">
          <button type="button" className="btn btn-primary users-btn-icon" onClick={openAdd}>
            <IconPlus size={16} />
            {t('users.addUser')}
          </button>
          <button
            type="button"
            className={`btn btn-outline users-filter-toggle${filtersOpen ? ' active' : ''}`}
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <IconFilter size={16} />
            {t('filter.advanced')}
          </button>
          {hasActiveFilters && (
            <button type="button" className="btn btn-outline" onClick={() => setFilters(EMPTY_FILTERS)}>
              {t('cat.clearFilters')}
            </button>
          )}
          <select
            className="users-sort-select"
            value={`${sortKey}-${sortAsc ? 'asc' : 'desc'}`}
            onChange={(e) => {
              const [k, dir] = e.target.value.split('-') as [SortKey, 'asc' | 'desc']
              setSortKey(k)
              setSortAsc(dir === 'asc')
            }}
            aria-label={t('users.sortBy')}
          >
            <option value="name-asc">{t('users.sortName')}</option>
            <option value="name-desc">{t('users.sortNameDesc')}</option>
            <option value="created-desc">{t('users.sortCreated')}</option>
            <option value="created-asc">{t('users.sortCreatedAsc')}</option>
            <option value="lastLogin-desc">{t('users.sortLastLogin')}</option>
          </select>
        </div>
      </div>
      {filtersOpen && (
        <div className="users-filters-panel">
          <div className="users-filters-grid users-filters-grid-3">
            <div className="users-filter-field">
              <label htmlFor="users-f-status">{t('table.status')}</label>
              <select
                id="users-f-status"
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as StatusFilter }))}
              >
                <option value="">{t('filter.all')}</option>
                <option value="active">{t('status.active')}</option>
                <option value="inactive">{t('status.inactive')}</option>
              </select>
            </div>
            <div className="users-filter-field">
              <label htmlFor="users-f-from">{t('users.filterFrom')}</label>
              <input
                id="users-f-from"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
              />
            </div>
            <div className="users-filter-field">
              <label htmlFor="users-f-to">{t('users.filterTo')}</label>
              <input
                id="users-f-to"
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )

  const renderStats = () => (
    <div className="users-stats-row">
      <div className="users-stat-card">
        <div className="users-stat-icon users-stat-icon-blue"><IconUsers size={20} /></div>
        <div>
          <div className="users-stat-value">{stats.total}</div>
          <div className="users-stat-label">{t('users.statTotal')}</div>
        </div>
      </div>
      <div className="users-stat-card">
        <div className="users-stat-icon users-stat-icon-green"><IconUser size={20} /></div>
        <div>
          <div className="users-stat-value">{stats.active}</div>
          <div className="users-stat-label">{t('users.statActive')}</div>
        </div>
      </div>
      <div className="users-stat-card">
        <div className="users-stat-icon users-stat-icon-slate"><IconClose size={20} /></div>
        <div>
          <div className="users-stat-value">{stats.inactive}</div>
          <div className="users-stat-label">{t('users.statInactive')}</div>
        </div>
      </div>
      <div className="users-stat-card">
        <div className="users-stat-icon users-stat-icon-amber"><IconPlus size={20} /></div>
        <div>
          <div className="users-stat-value">{stats.newMonth}</div>
          <div className="users-stat-label">{t('users.statNewMonth')}</div>
        </div>
      </div>
    </div>
  )

  const renderBulkBar = () =>
    selected.size > 0 ? (
      <div className="users-bulk-bar">
        <span>{t('users.selectedCount', { count: String(selected.size) })}</span>
        <div className="users-bulk-actions">
          <button type="button" className="btn btn-sm" onClick={() => setConfirm({ kind: 'activate-bulk' })}>
            {t('users.activateSelected')}
          </button>
          <button type="button" className="btn btn-sm btn-outline" onClick={() => setConfirm({ kind: 'deactivate-bulk' })}>
            {t('users.deactivateSelected')}
          </button>
          <button type="button" className="btn btn-sm btn-danger users-btn-icon" onClick={() => setConfirm({ kind: 'delete-bulk' })}>
            {t('users.deleteSelected')}
          </button>
          <button type="button" className="btn btn-sm btn-outline users-btn-icon" onClick={() => setSelected(new Set())}>
            <IconClose size={14} />
            {t('trash.clearSelection')}
          </button>
        </div>
      </div>
    ) : null

  const renderTable = () => (
    <div className="users-table-card">
      <div className="table-wrap users-table-wrap">
        <table className="data-table users-table">
          <thead>
            <tr>
              <th className="users-check-col">
                <input
                  type="checkbox"
                  checked={sorted.length > 0 && selected.size === sorted.length}
                  onChange={toggleSelectAll}
                  aria-label={t('trash.selectAll')}
                />
              </th>
              <th>{t('users.colAvatar')}</th>
              <th>{t('users.colFullName')}</th>
              <th>{t('table.email')}</th>
              <th>{t('table.roles')}</th>
              <th>{t('table.status')}</th>
              <th>{t('table.created')}</th>
              <th>{t('users.lastLogin')}</th>
              <th>{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((u) => (
                <tr key={u.id} className={selected.has(u.id) ? 'users-row-selected' : undefined}>
                  <td className="users-check-col">
                    <input
                      type="checkbox"
                      checked={selected.has(u.id)}
                      onChange={() => toggleSelect(u.id)}
                      aria-label={fullName(u)}
                    />
                  </td>
                  <td>
                    <div className="users-avatar">{initials(u)}</div>
                  </td>
                  <td className="users-name-cell">{fullName(u)}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className="users-badge users-badge-role">
                      {t('role.user')}
                    </span>
                  </td>
                  <td>
                    <span className={`users-badge users-badge-status${u.isActive ? ' active' : ' inactive'}`}>
                      {u.isActive ? t('status.active') : t('status.inactive')}
                    </span>
                  </td>
                  <td>{fmtDate(u.createdAt, locale)}</td>
                  <td className="users-muted-cell">{t('users.notAvailable')}</td>
                  <td>{renderMenu(u)}</td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderCards = () => (
    <div className="users-card-grid">
      {sorted.map((u) => (
          <article key={u.id} className={`users-card${selected.has(u.id) ? ' selected' : ''}`}>
            <div className="users-card-top">
              <input
                type="checkbox"
                checked={selected.has(u.id)}
                onChange={() => toggleSelect(u.id)}
                aria-label={fullName(u)}
              />
              <div className="users-avatar">{initials(u)}</div>
              <div className="users-card-info">
                <h4>{fullName(u)}</h4>
                <p>{u.email}</p>
              </div>
              {renderMenu(u)}
            </div>
            <div className="users-card-meta">
              <span className="users-badge users-badge-role">{t('role.user')}</span>
              <span className={`users-badge users-badge-status${u.isActive ? ' active' : ' inactive'}`}>
                {u.isActive ? t('status.active') : t('status.inactive')}
              </span>
            </div>
            <div className="users-card-dates">
              <span>{fmtDate(u.createdAt, locale)}</span>
            </div>
          </article>
      ))}
    </div>
  )

  const emptyState = () => {
    if (standardUsers.length === 0) {
      return (
        <div className="users-empty">
          <div className="users-empty-icon"><IconUsers size={48} /></div>
          <h3>{t('users.emptyTitle')}</h3>
          <p>{t('users.emptyDesc')}</p>
          <button type="button" className="btn btn-primary users-btn-icon" onClick={openAdd}>
            <IconPlus size={16} />
            {t('users.addUser')}
          </button>
        </div>
      )
    }
    return (
      <div className="users-empty">
        <div className="users-empty-icon"><IconSearch size={48} /></div>
        <h3>{t('users.noResults')}</h3>
        <p>{t('users.noResultsDesc')}</p>
        <button type="button" className="btn btn-outline" onClick={() => setFilters(EMPTY_FILTERS)}>
          {t('cat.clearFilters')}
        </button>
      </div>
    )
  }

  return (
    <div className="users-docs-view">
      {toast && (
        <div className={`profile-toast profile-toast-${toast.type === 'error' ? 'error' : 'success'}`} role="status">
          {toast.message}
        </div>
      )}

      {renderStats()}
      {renderToolbar()}
      {renderBulkBar()}

      {!sorted.length ? (
        emptyState()
      ) : (
        <>
          <div className="users-desktop-table">{renderTable()}</div>
          <div className="users-mobile-cards">{renderCards()}</div>
        </>
      )}

      {addOpen && (
        <Modal title={t('users.addTitle')} onClose={() => !busy && setAddOpen(false)}>
          {addError && <div className="msg error">{addError}</div>}
          <div className="users-form-grid">
            <div className="form-group">
              <label htmlFor="add-fn">{t('users.firstName')}</label>
              <input id="add-fn" value={addForm.firstName} onChange={(e) => setAddForm((f) => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div className="form-group">
              <label htmlFor="add-ln">{t('users.lastName')}</label>
              <input id="add-ln" value={addForm.lastName} onChange={(e) => setAddForm((f) => ({ ...f, lastName: e.target.value }))} />
            </div>
            <div className="form-group users-form-full">
              <label htmlFor="add-email">{t('table.email')}</label>
              <input id="add-email" type="email" value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="form-group users-form-full">
              <label>{t('users.phone')}</label>
              <input disabled placeholder={t('users.notAvailable')} />
            </div>
            <div className="form-group">
              <label htmlFor="add-pwd">{t('users.password')}</label>
              <input id="add-pwd" type="password" value={addForm.password} onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="form-group users-form-full">
              <label htmlFor="add-pwd2">{t('users.confirmPassword')}</label>
              <input id="add-pwd2" type="password" value={addForm.confirmPassword} onChange={(e) => setAddForm((f) => ({ ...f, confirmPassword: e.target.value }))} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={() => setAddOpen(false)} disabled={busy}>{t('btn.cancel')}</button>
            <button type="button" className="btn btn-primary" onClick={() => void createUser()} disabled={busy}>
              {busy ? t('profile.saving') : t('users.createUser')}
            </button>
          </div>
        </Modal>
      )}

      {editUser && (
        <Modal title={t('users.editUser')} onClose={() => !busy && setEditUser(null)}>
          {editError && <div className="msg error">{editError}</div>}
          <div className="users-edit-header">
            <div className="users-avatar users-avatar-lg">{initials(editUser)}</div>
            <div>
              <p className="users-edit-email">{editUser.email}</p>
              <p className="users-muted">{t('users.emailReadOnly')}</p>
            </div>
          </div>
          <div className="users-form-grid">
            <div className="form-group">
              <label htmlFor="edit-fn">{t('users.firstName')}</label>
              <input id="edit-fn" value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div className="form-group">
              <label htmlFor="edit-ln">{t('users.lastName')}</label>
              <input id="edit-ln" value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} />
            </div>
            <div className="form-group users-form-full">
              <label>{t('users.phone')}</label>
              <input disabled placeholder={t('users.notAvailable')} />
            </div>
            <div className="form-group">
              <label htmlFor="edit-status">{t('table.status')}</label>
              <select
                id="edit-status"
                value={editForm.isActive ? 'active' : 'inactive'}
                onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.value === 'active' }))}
              >
                <option value="active">{t('status.active')}</option>
                <option value="inactive">{t('status.inactive')}</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={() => setEditUser(null)} disabled={busy}>{t('btn.cancel')}</button>
            <button type="button" className="btn btn-primary" onClick={() => void saveEdit()} disabled={busy}>
              {busy ? t('profile.saving') : t('btn.save')}
            </button>
          </div>
        </Modal>
      )}

      {permUser && (
        <Modal title={t('users.managePermissions')} onClose={() => setPermUser(null)} wide>
          <p className="users-muted">{fullName(permUser)} · {t('role.user')}</p>
          <p className="users-perm-info">{t('users.permissionsReadOnly')}</p>
          <div className="users-perm-section">
            <h5>{t('users.documentsSection')}</h5>
            <div className="users-perm-grid">
              {permRows.map((p) => (
                <div key={p.key} className={`users-perm-item${p.granted ? ' granted' : ''}`}>
                  <span className="users-perm-icon">{p.granted ? '✓' : '✕'}</span>
                  <span>{t(`perm.${p.key}`)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={() => setPermUser(null)}>{t('btn.close')}</button>
          </div>
        </Modal>
      )}

      {profileId && <UserProfileModal userId={profileId} onClose={() => setProfileId(null)} />}

      {confirm && (
        <Modal
          title={
            confirm.kind.includes('delete')
              ? t('users.deleteConfirmTitle')
              : confirm.kind.includes('deactivate')
                ? t('users.deactivateConfirmTitle')
                : t('users.activateConfirmTitle')
          }
          onClose={() => !busy && setConfirm(null)}
        >
          <p className="users-confirm-msg">
            {confirm.kind === 'deactivate-one' && t('users.deactivateConfirmMsg')}
            {confirm.kind === 'activate-one' && t('users.activateConfirmMsg')}
            {confirm.kind === 'delete-one' && t('users.deleteConfirmMsg')}
            {confirm.kind === 'deactivate-bulk' && t('users.deactivateConfirmBulk', { count: String(selected.size) })}
            {confirm.kind === 'activate-bulk' && t('users.activateConfirmBulk', { count: String(selected.size) })}
            {confirm.kind === 'delete-bulk' && t('users.deleteConfirmBulk', { count: String(selected.size) })}
          </p>
          {confirm.kind.includes('delete') && (
            <label className="users-delete-ack">
              <input type="checkbox" checked={deleteAck} onChange={(e) => setDeleteAck(e.target.checked)} />
              {t('users.deleteAck')}
            </label>
          )}
          <div className="modal-footer">
            <button type="button" className="btn" onClick={() => setConfirm(null)} disabled={busy}>{t('btn.cancel')}</button>
            <button
              type="button"
              className={`btn${confirm.kind.includes('delete') ? ' btn-danger' : ' btn-primary'}`}
              onClick={() => void runConfirm()}
              disabled={busy || (confirm.kind.includes('delete') && !deleteAck)}
            >
              {busy ? t('profile.saving') : t('btn.confirm')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
