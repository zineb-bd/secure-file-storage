import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '@/api/client'
import { AnnuaireMePanel } from '@/components/annuaire/AnnuaireMePanel'
import { IconMore, IconPlus, IconSearch, IconUsers } from '@/components/categories/CategoryIcons'
import { UserProfileModal } from '@/components/users/UserProfileModal'
import { Modal } from '@/components/ui/Modal'
import { CATEGORIES } from '@/constants'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/i18n/I18nContext'
import { loadCustomCategories } from '@/utils/categoryStorage'
import type { AdminUser, CategoryAccessRule, DocumentDto, UserDirectoryEntry, UserGroup } from '@/types'

type Filter = 'me' | 'people' | 'groups'
type StatusFilter = '' | 'active' | 'inactive'

const AVATAR_PAIRS: [string, string][] = [
  ['#0f766e', '#0ea5e9'],
  ['#4f46e5', '#818cf8'],
  ['#c2410c', '#f59e0b'],
  ['#be185d', '#fb7185'],
  ['#0369a1', '#22d3ee'],
  ['#7c3aed', '#c4b5fd'],
]

function avatarPair(seed: string): [string, string] {
  let n = 0
  for (let i = 0; i < seed.length; i++) n = (n + seed.charCodeAt(i) * (i + 1)) % AVATAR_PAIRS.length
  return AVATAR_PAIRS[n]
}

function fullName(u: AdminUser) {
  const n = `${u.firstName || ''} ${u.lastName || ''}`.trim()
  return n || u.email
}

function initialsOf(u: AdminUser) {
  const a = (u.firstName?.[0] || u.email?.[0] || '?').toUpperCase()
  const b = (u.lastName?.[0] || '').toUpperCase()
  return `${a}${b}`.slice(0, 2)
}

function groupInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return (name.slice(0, 2) || '?').toUpperCase()
}

function memberInitials(name: string, email: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return (name[0] || email[0] || '?').toUpperCase()
}

function emailValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function isAdminRole(roles: string[]) {
  return roles.some((r) => r.toLowerCase() === 'admin')
}

function fromDirectory(e: UserDirectoryEntry): AdminUser {
  const parts = (e.fullName || '').trim().split(/\s+/).filter(Boolean)
  return {
    id: e.id,
    email: e.email,
    firstName: e.firstName || parts[0] || '',
    lastName: e.lastName || parts.slice(1).join(' ') || '',
    isActive: true,
    roles: [],
    createdAt: '',
    avatarUrl: e.avatarUrl || null,
  }
}

function groupLead(g: UserGroup) {
  return [...g.members].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))[0] ?? null
}

export function AnnuaireDirectory({ initialFilter = 'me' }: { initialFilter?: Filter }) {
  const { t } = useI18n()
  const { user: currentUser, isAuthenticated, isAdmin } = useAuth()
  const [, setSearchParams] = useSearchParams()

  const [users, setUsers] = useState<AdminUser[]>([])
  const [groups, setGroups] = useState<UserGroup[]>([])
  const [rules, setRules] = useState<CategoryAccessRule[]>([])
  const [documents, setDocuments] = useState<DocumentDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [filter, setFilter] = useState<Filter>(initialFilter)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [profileId, setProfileId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '', role: 'User' })
  const [addError, setAddError] = useState('')
  const [editUser, setEditUser] = useState<AdminUser | null>(null)
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', isActive: true })

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', description: '' })
  const [detail, setDetail] = useState<UserGroup | null>(null)
  const [editGroup, setEditGroup] = useState(false)
  const [groupForm, setGroupForm] = useState({ name: '', description: '' })
  const [addUserId, setAddUserId] = useState('')
  const [permissionForm, setPermissionForm] = useState({ category: CATEGORIES[0] as string, accessLevel: 'Read' })
  const [deleteTarget, setDeleteTarget] = useState<UserGroup | null>(null)
  const [confirm, setConfirm] = useState<{ kind: 'deactivate' | 'activate' | 'delete'; user: AdminUser } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (isAdmin) {
        const [u, g, r, docs] = await Promise.all([
          api<AdminUser[]>('/api/admin/users'),
          api<UserGroup[]>('/api/admin/groups'),
          api<CategoryAccessRule[]>('/api/admin/category-access'),
          api<{ items: DocumentDto[] }>('/api/documents?status=Active&page=1&pageSize=500').catch(() => ({ items: [] })),
        ])
        setUsers(u || [])
        setGroups(g || [])
        setRules(r || [])
        setDocuments((docs.items || []).filter((d) => !d.isFolder))
      } else {
        const entries = await api<UserDirectoryEntry[]>('/api/users/directory')
        setUsers((entries || []).map(fromDirectory))
        setGroups([])
        setRules([])
        setDocuments([])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('msg.loadProfileError'))
    } finally {
      setLoading(false)
    }
  }, [t, isAdmin])

  useEffect(() => {
    if (!isAuthenticated) return
    void load()
  }, [isAuthenticated, load])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(id)
  }, [toast])

  useEffect(() => {
    if (initialFilter === 'groups' && isAdmin) setFilter('groups')
    else if (initialFilter === 'people') setFilter('people')
    else setFilter('me')
  }, [initialFilter, isAdmin])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(null)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const setTab = (next: Filter) => {
    setFilter(next)
    setMenuOpen(null)
    if (next === 'me') setSearchParams({}, { replace: true })
    else if (next === 'groups') setSearchParams({ tab: 'groups' }, { replace: true })
    else setSearchParams({ tab: 'users' }, { replace: true })
  }

  const groupsByUser = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const g of groups) {
      for (const m of g.members) {
        const list = map.get(m.userId) || []
        list.push(g.name)
        map.set(m.userId, list)
      }
    }
    return map
  }, [groups])

  const docsByGroup = useMemo(() => {
    const map = new Map<string, DocumentDto[]>()
    for (const g of groups) {
      const cats = new Set(rules.filter((r) => r.userGroupId === g.id).map((r) => r.category))
      map.set(g.id, documents.filter((d) => cats.has(d.category)))
    }
    return map
  }, [groups, rules, documents])

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users
      .filter((u) => {
        if (q && !`${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q)) return false
        if (roleFilter === 'Admin' && !isAdminRole(u.roles)) return false
        if (roleFilter === 'User' && isAdminRole(u.roles)) return false
        if (statusFilter === 'active' && !u.isActive) return false
        if (statusFilter === 'inactive' && u.isActive) return false
        if (groupFilter) {
          const names = groupsByUser.get(u.id) || []
          const g = groups.find((x) => x.id === groupFilter)
          if (!g || !names.includes(g.name)) return false
        }
        return true
      })
      .sort((a, b) => fullName(a).localeCompare(fullName(b), undefined, { sensitivity: 'base' }))
  }, [users, search, roleFilter, statusFilter, groupFilter, groupsByUser, groups])

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase()
    return groups
      .filter((g) => !q || g.name.toLowerCase().includes(q) || (g.description || '').toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }, [groups, search])

  const categories = useMemo(
    () => [...new Set([...CATEGORIES, ...loadCustomCategories().map((c) => c.name)])],
    [],
  )

  const groupRules = useMemo(
    () => (detail ? rules.filter((rule) => rule.userGroupId === detail.id) : []),
    [detail, rules],
  )

  const availableUsers = useMemo(() => {
    if (!detail) return users.filter((u) => u.isActive)
    const memberIds = new Set(detail.members.map((m) => m.userId))
    return users.filter((u) => u.isActive && !memberIds.has(u.id))
  }, [detail, users])

  const profileUser = users.find((u) => u.id === profileId) || null
  const meUser = users.find((u) => u.email.toLowerCase() === (currentUser?.email || '').toLowerCase()) || null
  const myGroupNames = meUser ? groupsByUser.get(meUser.id) || [] : []
  const empty = !loading && filter !== 'me' && (filter === 'people' ? filteredUsers.length === 0 : filteredGroups.length === 0)

  const openAdd = () => {
    if (filter === 'groups') {
      setCreateForm({ name: '', description: '' })
      setCreateOpen(true)
      return
    }
    setAddForm({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '', role: 'User' })
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
          roleNames: [addForm.role === 'Admin' ? 'Admin' : 'User'],
        }),
      })
      setAddOpen(false)
      setToast({ message: t('users.created'), type: 'success' })
      await load()
    } catch (e) {
      setAddError(e instanceof Error ? e.message : t('msg.loadProfileError'))
    } finally {
      setBusy(false)
    }
  }

  const saveUser = async () => {
    if (!editUser) return
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
      setToast({ message: t('details.saved'), type: 'success' })
      await load()
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : t('msg.loadProfileError'), type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const runConfirm = async () => {
    if (!confirm) return
    setBusy(true)
    try {
      if (confirm.kind === 'deactivate') {
        await api(`/api/admin/users/${confirm.user.id}/deactivate`, { method: 'POST' })
        setToast({ message: t('users.deactivated'), type: 'success' })
      } else if (confirm.kind === 'activate') {
        await api(`/api/admin/users/${confirm.user.id}`, {
          method: 'PUT',
          body: JSON.stringify({ firstName: confirm.user.firstName, lastName: confirm.user.lastName, isActive: true }),
        })
        setToast({ message: t('users.activated'), type: 'success' })
      } else {
        await api(`/api/admin/users/${confirm.user.id}`, { method: 'DELETE' })
        setToast({ message: t('users.deleted'), type: 'success' })
      }
      setConfirm(null)
      setProfileId(null)
      await load()
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : t('msg.loadProfileError'), type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const createGroup = async () => {
    if (!createForm.name.trim()) {
      setToast({ message: t('groups.nameRequired'), type: 'error' })
      return
    }
    setBusy(true)
    try {
      await api('/api/admin/groups', {
        method: 'POST',
        body: JSON.stringify({ name: createForm.name.trim(), description: createForm.description.trim() }),
      })
      setCreateOpen(false)
      setCreateForm({ name: '', description: '' })
      setToast({ message: t('groups.created'), type: 'success' })
      await load()
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : t('groups.saveError'), type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const saveGroupMeta = async () => {
    if (!detail || !groupForm.name.trim()) return
    setBusy(true)
    try {
      const updated = await api<UserGroup>(`/api/admin/groups/${detail.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: groupForm.name.trim(), description: groupForm.description.trim() }),
      })
      setDetail(updated)
      setEditGroup(false)
      setToast({ message: t('groups.created'), type: 'success' })
      await load()
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : t('groups.saveError'), type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const addMember = async () => {
    if (!detail || !addUserId) return
    setBusy(true)
    try {
      const updated = await api<UserGroup>(`/api/admin/groups/${detail.id}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId: addUserId }),
      })
      setDetail(updated)
      setAddUserId('')
      setToast({ message: t('groups.memberAdded'), type: 'success' })
      await load()
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : t('groups.saveError'), type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const removeMember = async (userId: string) => {
    if (!detail) return
    setBusy(true)
    try {
      await api(`/api/admin/groups/${detail.id}/members/${userId}`, { method: 'DELETE' })
      setDetail(await api<UserGroup>(`/api/admin/groups/${detail.id}`))
      setToast({ message: t('groups.memberRemoved'), type: 'success' })
      await load()
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : t('groups.saveError'), type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const savePermission = async () => {
    if (!detail) return
    setBusy(true)
    try {
      await api('/api/admin/category-access', {
        method: 'PUT',
        body: JSON.stringify({
          category: permissionForm.category,
          userGroupId: detail.id,
          accessLevel: permissionForm.accessLevel,
        }),
      })
      setToast({ message: t('groups.permissionSaved'), type: 'success' })
      await load()
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : t('groups.permissionSaveError'), type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const removePermission = async (ruleId: string) => {
    setBusy(true)
    try {
      await api(`/api/admin/category-access/${ruleId}`, { method: 'DELETE' })
      setToast({ message: t('groups.permissionRemoved'), type: 'success' })
      await load()
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : t('groups.permissionSaveError'), type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const deleteGroup = async () => {
    if (!deleteTarget) return
    setBusy(true)
    try {
      await api(`/api/admin/groups/${deleteTarget.id}`, { method: 'DELETE' })
      setDeleteTarget(null)
      if (detail?.id === deleteTarget.id) setDetail(null)
      setToast({ message: t('groups.deleted'), type: 'success' })
      await load()
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : t('groups.saveError'), type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const openGroup = (g: UserGroup) => {
    setDetail(g)
    setEditGroup(false)
    setGroupForm({ name: g.name, description: g.description || '' })
  }

  return (
    <div className="annuaire-directory">
      {toast && (
        <div className={`profile-toast profile-toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      )}

      {error && (
        <div className="msg error">
          {error}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void load()}>
            {t('audit.refresh')}
          </button>
        </div>
      )}

      <div className="annuaire-admin-head">
        <div className="annuaire-tabs" role="tablist" aria-label={t('page.annuaire.title')}>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'me'}
            className={filter === 'me' ? 'is-active' : ''}
            onClick={() => setTab('me')}
          >
            {t('annuaire.tab.me')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'people'}
            className={filter === 'people' ? 'is-active' : ''}
            onClick={() => setTab('people')}
          >
            {t('annuaire.tab.users')}
          </button>
          {isAdmin && (
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'groups'}
              className={filter === 'groups' ? 'is-active' : ''}
              onClick={() => setTab('groups')}
            >
              {t('annuaire.tab.groups')}
            </button>
          )}
        </div>
        {isAdmin && filter !== 'me' && (
          <button type="button" className="btn btn-primary" onClick={openAdd}>
            <IconPlus size={16} />
            {t('annuaire.add')}
          </button>
        )}
      </div>

      {filter !== 'me' && (
      <div className="annuaire-filters-bar">
        <div className="files-search-wrap">
          <span className="files-search-icon" aria-hidden>
            <IconSearch size={16} />
          </span>
          <input
            type="search"
            className="files-search-input"
            placeholder={t('annuaire.searchPeople')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t('annuaire.searchPeople')}
          />
        </div>
        {isAdmin && filter === 'people' && (
          <>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label={t('annuaire.filter.role')}>
              <option value="">{t('annuaire.filter.allRoles')}</option>
              <option value="Admin">{t('role.admin')}</option>
              <option value="User">{t('role.user')}</option>
            </select>
            <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} aria-label={t('annuaire.filter.group')}>
              <option value="">{t('annuaire.filter.allGroups')}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              aria-label={t('annuaire.filter.status')}
            >
              <option value="">{t('annuaire.filter.allStatus')}</option>
              <option value="active">{t('status.active')}</option>
              <option value="inactive">{t('status.inactive')}</option>
            </select>
          </>
        )}
      </div>
      )}

      {filter === 'me' ? (
        <AnnuaireMePanel
          groupNames={myGroupNames}
          isAdmin={isAdmin}
          onGoUsers={() => setTab('people')}
          onGoGroups={() => setTab('groups')}
          onSaved={() => void load()}
        />
      ) : loading ? (
        <div className="annuaire-grid" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="annuaire-card-skel" />
          ))}
        </div>
      ) : empty ? (
        <div className="annuaire-empty">
          <div className="annuaire-empty-icon">
            <IconUsers size={28} />
          </div>
          <h3>{t('annuaire.empty')}</h3>
          <p>{t('annuaire.emptyHint')}</p>
        </div>
      ) : filter === 'people' ? (
        <div className="users-table-card annuaire-table-card">
          <div className="table-wrap">
            <table className="data-table users-table">
              <thead>
                <tr>
                  <th>{t('annuaire.col.user')}</th>
                  <th>{t('table.email')}</th>
                  {isAdmin && <th>{t('users.roleLabel')}</th>}
                  {isAdmin && <th>{t('annuaire.col.group')}</th>}
                  {isAdmin && <th>{t('annuaire.col.status')}</th>}
                  <th>{t('table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const admin = isAdminRole(u.roles)
                  const names = groupsByUser.get(u.id) || []
                  const pair = avatarPair(u.email)
                  const isMe = u.email.toLowerCase() === (currentUser?.email || '').toLowerCase()
                  return (
                    <tr key={u.id}>
                      <td>
                        <button
                          type="button"
                          className="annuaire-user-cell"
                          onClick={() => (isMe ? setTab('me') : isAdmin ? setProfileId(u.id) : undefined)}
                        >
                          <span
                            className={`annuaire-avatar${u.avatarUrl ? ' has-photo' : ''}`}
                            style={!u.avatarUrl ? { background: `linear-gradient(135deg, ${pair[0]}, ${pair[1]})` } : undefined}
                          >
                            {u.avatarUrl ? <img src={u.avatarUrl} alt="" /> : initialsOf(u)}
                          </span>
                          <span>
                            <strong>{fullName(u)}</strong>
                            {isMe && <em className="annuaire-you-inline">{t('annuaire.you')}</em>}
                          </span>
                        </button>
                      </td>
                      <td className="users-muted-cell">{u.email}</td>
                      {isAdmin && (
                        <td>
                          <span className={`users-badge users-badge-role${admin ? ' admin' : ''}`}>
                            {admin ? t('role.admin') : t('role.user')}
                          </span>
                        </td>
                      )}
                      {isAdmin && (
                        <td>{names.length ? names.join(', ') : <span className="users-muted-cell">{t('annuaire.noGroup')}</span>}</td>
                      )}
                      {isAdmin && (
                        <td>
                          <span className={`users-badge users-badge-status${u.isActive ? ' active' : ' inactive'}`}>
                            <span className={`annuaire-status-dot${u.isActive ? ' on' : ''}`} />
                            {u.isActive ? t('status.active') : t('status.inactive')}
                          </span>
                        </td>
                      )}
                      <td>
                        {isAdmin ? (
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
                                <button type="button" role="menuitem" onClick={() => { isMe ? setTab('me') : setProfileId(u.id); setMenuOpen(null) }}>
                                  {t('annuaire.viewDetails')}
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setEditUser(u)
                                    setEditForm({ firstName: u.firstName, lastName: u.lastName, isActive: u.isActive })
                                    setMenuOpen(null)
                                  }}
                                >
                                  {t('btn.edit')}
                                </button>
                                {!isMe && (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className={u.isActive ? 'danger' : ''}
                                    onClick={() => {
                                      setConfirm({ kind: u.isActive ? 'deactivate' : 'activate', user: u })
                                      setMenuOpen(null)
                                    }}
                                  >
                                    {u.isActive ? t('btn.deactivate') : t('users.activate')}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ) : isMe ? (
                          <button type="button" className="btn btn-sm btn-outline" onClick={() => setTab('me')}>
                            {t('annuaire.myAccount')}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="groups-card-grid">
          {filteredGroups.map((g) => {
            const lead = groupLead(g)
            const docs = docsByGroup.get(g.id) || []
            return (
              <article key={g.id} className="groups-card">
                <div className="groups-card-top">
                  <div className="annuaire-avatar is-group">{groupInitials(g.name)}</div>
                  <div className="groups-card-info">
                    <h4>{g.name}</h4>
                    <p>{g.description || t('groups.noDescription')}</p>
                  </div>
                </div>
                <div className="annuaire-card-meta">
                  <span className={`users-badge groups-member-badge${g.memberCount === 0 ? ' empty' : ''}`}>
                    {t('annuaire.membersCount', { count: String(g.memberCount) })}
                  </span>
                  <span className="users-badge groups-member-badge">
                    {t('annuaire.docsCount', { count: String(docs.length) })}
                  </span>
                </div>
                <p className="annuaire-group-owner">
                  {t('annuaire.owner')}: {lead ? (lead.fullName || lead.email) : t('annuaire.ownerUnknown')}
                </p>
                <div className="groups-card-actions">
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => openGroup(g)}>
                    {t('annuaire.viewGroup')}
                  </button>
                  <div className="users-menu-wrap" ref={menuOpen === `g-${g.id}` ? menuRef : undefined}>
                    <button
                      type="button"
                      className="users-menu-btn"
                      aria-label={t('table.actions')}
                      onClick={() => setMenuOpen(menuOpen === `g-${g.id}` ? null : `g-${g.id}`)}
                    >
                      <IconMore size={18} />
                    </button>
                    {menuOpen === `g-${g.id}` && (
                      <div className="cat-dropdown users-dropdown" role="menu">
                        <button type="button" role="menuitem" onClick={() => { openGroup(g); setMenuOpen(null) }}>
                          {t('groups.manage')}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => { openGroup(g); setEditGroup(true); setMenuOpen(null) }}
                        >
                          {t('groups.edit')}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="danger"
                          disabled={g.memberCount > 0}
                          onClick={() => { setDeleteTarget(g); setMenuOpen(null) }}
                        >
                          {t('btn.delete')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {profileId && isAdmin && (
        <UserProfileModal
          userId={profileId}
          groupNames={groupsByUser.get(profileId) || []}
          canManage
          onClose={() => setProfileId(null)}
          onEdit={() => {
            if (!profileUser) return
            setEditUser(profileUser)
            setEditForm({ firstName: profileUser.firstName, lastName: profileUser.lastName, isActive: profileUser.isActive })
            setProfileId(null)
          }}
          onToggleActive={() => {
            if (!profileUser || profileUser.email === currentUser?.email) return
            setConfirm({ kind: profileUser.isActive ? 'deactivate' : 'activate', user: profileUser })
            setProfileId(null)
          }}
        />
      )}
      {addOpen && (
        <Modal title={t('users.addTitle')} onClose={() => !busy && setAddOpen(false)}>
          {addError && <div className="msg error">{addError}</div>}
          <div className="users-form-grid">
            <div className="form-group">
              <label htmlFor="ann-add-fn">{t('users.firstName')}</label>
              <input id="ann-add-fn" value={addForm.firstName} onChange={(e) => setAddForm((f) => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div className="form-group">
              <label htmlFor="ann-add-ln">{t('users.lastName')}</label>
              <input id="ann-add-ln" value={addForm.lastName} onChange={(e) => setAddForm((f) => ({ ...f, lastName: e.target.value }))} />
            </div>
            <div className="form-group users-form-full">
              <label htmlFor="ann-add-email">{t('table.email')}</label>
              <input id="ann-add-email" type="email" value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="form-group">
              <label htmlFor="ann-add-pwd">{t('users.password')}</label>
              <input id="ann-add-pwd" type="password" value={addForm.password} onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="form-group users-form-full">
              <label htmlFor="ann-add-pwd2">{t('users.confirmPassword')}</label>
              <input id="ann-add-pwd2" type="password" value={addForm.confirmPassword} onChange={(e) => setAddForm((f) => ({ ...f, confirmPassword: e.target.value }))} />
            </div>
            <div className="form-group users-form-full">
              <label htmlFor="ann-add-role">{t('users.roleLabel')}</label>
              <select id="ann-add-role" value={addForm.role} onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))}>
                <option value="User">{t('role.user')}</option>
                <option value="Admin">{t('role.admin')}</option>
              </select>
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
          <div className="users-form-grid">
            <div className="form-group">
              <label htmlFor="ann-edit-fn">{t('users.firstName')}</label>
              <input id="ann-edit-fn" value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div className="form-group">
              <label htmlFor="ann-edit-ln">{t('users.lastName')}</label>
              <input id="ann-edit-ln" value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={() => setEditUser(null)} disabled={busy}>{t('btn.cancel')}</button>
            <button type="button" className="btn btn-primary" onClick={() => void saveUser()} disabled={busy}>
              {t('btn.save')}
            </button>
          </div>
        </Modal>
      )}

      {createOpen && (
        <Modal onClose={() => !busy && setCreateOpen(false)} title={t('groups.create')}>
          <div className="form-grid groups-form">
            <label>
              {t('groups.colName')}
              <input value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} maxLength={100} autoFocus />
            </label>
            <label>
              {t('groups.colDescription')}
              <textarea value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} rows={3} maxLength={500} />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setCreateOpen(false)}>{t('btn.cancel')}</button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void createGroup()}>{t('btn.save')}</button>
            </div>
          </div>
        </Modal>
      )}

      {detail && (
        <Modal onClose={() => !busy && setDetail(null)} title={t('groups.manageTitle', { name: detail.name })} wide>
          <div className="groups-manage">
            <div className="groups-manage-header">
              <div className="users-avatar users-avatar-lg groups-avatar">{groupInitials(detail.name)}</div>
              <div className="groups-manage-copy">
                {editGroup ? (
                  <div className="groups-form">
                    <label>
                      {t('groups.colName')}
                      <input value={groupForm.name} onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))} />
                    </label>
                    <label>
                      {t('groups.colDescription')}
                      <textarea value={groupForm.description} onChange={(e) => setGroupForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
                    </label>
                    <div className="modal-actions">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditGroup(false)}>{t('btn.cancel')}</button>
                      <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void saveGroupMeta()}>{t('btn.save')}</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h4>{detail.name}</h4>
                    <p className="muted">{detail.description || t('groups.noDescription')}</p>
                    <p className="muted">
                      {t('groups.owner')}: {groupLead(detail)?.fullName || t('annuaire.ownerUnknown')}
                    </p>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => setEditGroup(true)}>
                      {t('groups.edit')}
                    </button>
                  </>
                )}
              </div>
            </div>

            <section className="groups-permissions-section">
              <div className="groups-section-heading">
                <div>
                  <h5>{t('groups.permissionsTitle')}</h5>
                  <p>{t('groups.permissionsDesc')}</p>
                </div>
                <span className="users-badge groups-member-badge">{groupRules.length}</span>
              </div>
              {groupRules.length === 0 ? (
                <p className="groups-permissions-empty">{t('groups.permissionsEmpty')}</p>
              ) : (
                <ul className="groups-permission-list">
                  {groupRules.map((rule) => (
                    <li key={rule.id}>
                      <div>
                        <strong>{rule.category}</strong>
                        <span>{t(`access.${rule.accessLevel.toLowerCase()}`)}</span>
                      </div>
                      <button type="button" className="btn btn-sm btn-outline" disabled={busy} onClick={() => void removePermission(rule.id)}>
                        {t('btn.delete')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="groups-permission-form">
                <select value={permissionForm.category} onChange={(e) => setPermissionForm((f) => ({ ...f, category: e.target.value }))}>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select value={permissionForm.accessLevel} onChange={(e) => setPermissionForm((f) => ({ ...f, accessLevel: e.target.value }))}>
                  <option value="Read">{t('access.read')}</option>
                  <option value="Preview">{t('access.preview')}</option>
                  <option value="Download">{t('access.download')}</option>
                  <option value="Write">{t('access.write')}</option>
                </select>
                <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void savePermission()}>
                  {t('groups.grantPermission')}
                </button>
              </div>
            </section>

            <section className="groups-permissions-section">
              <div className="groups-section-heading">
                <div>
                  <h5>{t('groups.accessibleDocs')}</h5>
                </div>
                <span className="users-badge groups-member-badge">{(docsByGroup.get(detail.id) || []).length}</span>
              </div>
              {(docsByGroup.get(detail.id) || []).length === 0 ? (
                <p className="groups-permissions-empty">{t('groups.accessibleDocsEmpty')}</p>
              ) : (
                <ul className="annuaire-doc-list">
                  {(docsByGroup.get(detail.id) || []).slice(0, 10).map((d) => (
                    <li key={d.id}>
                      <strong>{d.fileName}</strong>
                      <span>{d.category}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="groups-section-heading">
              <div>
                <h5>{t('groups.membersTitle')}</h5>
                <p>{t('groups.membersDesc')}</p>
              </div>
              <span className="users-badge groups-member-badge">{detail.members.length}</span>
            </div>
            <div className="groups-add-row">
              <select value={addUserId} onChange={(e) => setAddUserId(e.target.value)}>
                <option value="">{t('groups.selectUser')}</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>
                ))}
              </select>
              <button type="button" className="btn btn-primary btn-sm" disabled={busy || !addUserId} onClick={() => void addMember()}>
                {t('groups.addMember')}
              </button>
            </div>
            {detail.members.length === 0 ? (
              <div className="groups-manage-empty">{t('groups.noMembers')}</div>
            ) : (
              <ul className="groups-member-list">
                {detail.members.map((m) => (
                  <li key={m.userId}>
                    <div className="groups-member-row">
                      <span className="users-avatar">{memberInitials(m.fullName, m.email)}</span>
                      <div className="groups-member-meta">
                        <strong>{m.fullName || m.email}</strong>
                        <span>{m.email}</span>
                      </div>
                      <button type="button" className="btn btn-sm btn-outline" disabled={busy} onClick={() => void removeMember(m.userId)}>
                        {t('groups.removeMember')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal onClose={() => !busy && setDeleteTarget(null)} title={t('groups.deleteTitle')}>
          <p>{t('groups.deleteConfirm', { name: deleteTarget.name || '' })}</p>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setDeleteTarget(null)}>{t('btn.cancel')}</button>
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void deleteGroup()}>{t('btn.delete')}</button>
          </div>
        </Modal>
      )}

      {confirm && (
        <Modal
          title={confirm.kind === 'delete' ? t('users.deleteConfirmTitle') : confirm.kind === 'activate' ? t('users.activateConfirmTitle') : t('users.deactivateConfirmTitle')}
          onClose={() => !busy && setConfirm(null)}
        >
          <p>
            {confirm.kind === 'delete'
              ? t('users.deleteConfirmMsg')
              : confirm.kind === 'activate'
                ? t('users.activateConfirmMsg')
                : t('users.deactivateConfirmMsg')}
          </p>
          <div className="modal-footer">
            <button type="button" className="btn" disabled={busy} onClick={() => setConfirm(null)}>{t('btn.cancel')}</button>
            <button type="button" className={confirm.kind === 'activate' ? 'btn btn-primary' : 'btn btn-danger'} disabled={busy} onClick={() => void runConfirm()}>
              {confirm.kind === 'delete' ? t('btn.delete') : confirm.kind === 'activate' ? t('users.activate') : t('btn.deactivate')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
