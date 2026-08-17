import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/api/client'
import { IconPlus, IconSearch, IconUsers } from '@/components/categories/CategoryIcons'
import { IconShield } from '@/components/profile/ProfileIcons'
import { Modal } from '@/components/ui/Modal'
import { CATEGORIES } from '@/constants'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/i18n/I18nContext'
import { loadCustomCategories } from '@/utils/categoryStorage'
import type { AdminUser, CategoryAccessRule, UserGroup } from '@/types'

function groupInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return (name.slice(0, 2) || '?').toUpperCase()
}

function memberInitials(fullName: string, email: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return (fullName[0] || email[0] || '?').toUpperCase()
}

export function AdminGroupsPanel() {
  const { t } = useI18n()
  const { isAuthenticated } = useAuth()
  const [groups, setGroups] = useState<UserGroup[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [rules, setRules] = useState<CategoryAccessRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', description: '' })
  const [detail, setDetail] = useState<UserGroup | null>(null)
  const [addUserId, setAddUserId] = useState('')
  const [permissionForm, setPermissionForm] = useState({ category: CATEGORIES[0] as string, accessLevel: 'Read' })
  const [deleteTarget, setDeleteTarget] = useState<UserGroup | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [g, u, r] = await Promise.all([
        api<UserGroup[]>('/api/admin/groups'),
        api<AdminUser[]>('/api/admin/users'),
        api<CategoryAccessRule[]>('/api/admin/category-access'),
      ])
      setGroups(g || [])
      setUsers((u || []).filter((x) => x.isActive))
      setRules(r || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : t('groups.loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (!isAuthenticated) return
    void load()
  }, [isAuthenticated, load])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(id)
  }, [toast])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return groups
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.description || '').toLowerCase().includes(q)
    )
  }, [groups, search])

  const stats = useMemo(() => {
    const members = groups.reduce((sum, g) => sum + g.memberCount, 0)
    const empty = groups.filter((g) => g.memberCount === 0).length
    return {
      total: groups.length,
      members,
      empty,
      withMembers: groups.length - empty,
    }
  }, [groups])

  const availableUsers = useMemo(() => {
    if (!detail) return users
    const memberIds = new Set(detail.members.map((m) => m.userId))
    return users.filter((u) => !memberIds.has(u.id))
  }, [detail, users])

  const categories = useMemo(
    () => [...new Set([...CATEGORIES, ...loadCustomCategories().map((category) => category.name)])],
    []
  )

  const groupRules = useMemo(
    () => (detail ? rules.filter((rule) => rule.userGroupId === detail.id) : []),
    [detail, rules]
  )

  const createGroup = async () => {
    if (!createForm.name.trim()) {
      setToast({ message: t('groups.nameRequired'), type: 'error' })
      return
    }
    setBusy(true)
    try {
      await api('/api/admin/groups', {
        method: 'POST',
        body: JSON.stringify({
          name: createForm.name.trim(),
          description: createForm.description.trim(),
        }),
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
      const refreshed = await api<UserGroup>(`/api/admin/groups/${detail.id}`)
      setDetail(refreshed)
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

  return (
    <div className="admin-groups-panel users-docs-view" id="admin-groups-panel">
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

      <div className="users-stats-row groups-stats-row">
        <article className="users-stat-card">
          <div className="users-stat-icon users-stat-icon-blue">
            <IconShield size={18} />
          </div>
          <div>
            <div className="users-stat-value">{stats.total}</div>
            <div className="users-stat-label">{t('groups.statTotal')}</div>
          </div>
        </article>
        <article className="users-stat-card">
          <div className="users-stat-icon users-stat-icon-green">
            <IconUsers size={18} />
          </div>
          <div>
            <div className="users-stat-value">{stats.members}</div>
            <div className="users-stat-label">{t('groups.statMembers')}</div>
          </div>
        </article>
        <article className="users-stat-card">
          <div className="users-stat-icon users-stat-icon-indigo">
            <IconUsers size={18} />
          </div>
          <div>
            <div className="users-stat-value">{stats.withMembers}</div>
            <div className="users-stat-label">{t('groups.statActive')}</div>
          </div>
        </article>
        <article className="users-stat-card">
          <div className="users-stat-icon users-stat-icon-amber">
            <IconShield size={18} />
          </div>
          <div>
            <div className="users-stat-value">{stats.empty}</div>
            <div className="users-stat-label">{t('groups.statEmpty')}</div>
          </div>
        </article>
      </div>

      <div className="users-toolbar">
        <div className="users-search-wrap">
          <IconSearch size={16} className="users-search-icon" />
          <input
            className="users-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('groups.searchPlaceholder')}
            aria-label={t('groups.searchPlaceholder')}
          />
        </div>
        <div className="users-toolbar-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}>
            <IconPlus size={16} />
            {t('groups.create')}
          </button>
        </div>
      </div>

      <p className="groups-hint">{t('groups.hint')}</p>

      {loading ? (
        <div className="groups-skeleton-grid" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="groups-skeleton-card" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="groups-empty">
          <div className="groups-empty-icon">
            <IconUsers size={28} />
          </div>
          <h3>{search.trim() ? t('groups.noResults') : t('groups.empty')}</h3>
          <p>{search.trim() ? t('groups.noResultsHint') : t('groups.emptyHint')}</p>
          {!search.trim() && (
            <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
              <IconPlus size={16} />
              {t('groups.create')}
            </button>
          )}
        </div>
      ) : (
        <div className="groups-card-grid">
          {filtered.map((g) => (
            <article key={g.id} className="groups-card">
              <div className="groups-card-top">
                <div className="users-avatar groups-avatar" aria-hidden="true">
                  {groupInitials(g.name)}
                </div>
                <div className="groups-card-info">
                  <h4>{g.name}</h4>
                  <p>{g.description || t('groups.noDescription')}</p>
                </div>
                <span className={`users-badge groups-member-badge${g.memberCount === 0 ? ' empty' : ''}`}>
                  {g.memberCount} {t('groups.colMembers').toLowerCase()}
                </span>
              </div>

              {g.members.length > 0 ? (
                <div className="groups-member-stack" aria-label={t('groups.colMembers')}>
                  {g.members.slice(0, 5).map((m) => (
                    <span
                      key={m.userId}
                      className="groups-member-chip"
                      title={`${m.fullName || m.email} (${m.email})`}
                    >
                      {memberInitials(m.fullName, m.email)}
                    </span>
                  ))}
                  {g.members.length > 5 && (
                    <span className="groups-member-chip more">+{g.members.length - 5}</span>
                  )}
                </div>
              ) : (
                <p className="groups-card-empty-members">{t('groups.noMembers')}</p>
              )}

              <div className="groups-card-actions">
                <button type="button" className="btn btn-sm btn-primary" onClick={() => setDetail(g)}>
                  {t('groups.manage')}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  disabled={g.memberCount > 0}
                  title={g.memberCount > 0 ? t('groups.deleteBlocked') : undefined}
                  onClick={() => setDeleteTarget(g)}
                >
                  {t('btn.delete')}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {createOpen && (
        <Modal onClose={() => !busy && setCreateOpen(false)} title={t('groups.create')}>
          <div className="form-grid groups-form">
            <label>
              {t('groups.colName')}
              <input
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                maxLength={100}
                placeholder="RH, Finance…"
                autoFocus
              />
            </label>
            <label>
              {t('groups.colDescription')}
              <textarea
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                maxLength={500}
                placeholder={t('groups.noDescription')}
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setCreateOpen(false)}>
                {t('btn.cancel')}
              </button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void createGroup()}>
                {t('btn.save')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {detail && (
        <Modal onClose={() => !busy && setDetail(null)} title={t('groups.manageTitle', { name: detail.name })} wide>
          <div className="groups-manage">
            <div className="groups-manage-header">
              <div className="users-avatar users-avatar-lg groups-avatar" aria-hidden="true">
                {groupInitials(detail.name)}
              </div>
              <div>
                <h4>{detail.name}</h4>
                <p className="muted">{detail.description || t('groups.noDescription')}</p>
              </div>
            </div>

            <section className="groups-permissions-section">
              <div className="groups-section-heading">
                <div>
                  <h5>{t('groups.permissionsTitle')}</h5>
                  <p>{t('groups.permissionsDesc')}</p>
                </div>
                <span className="users-badge groups-member-badge">
                  {groupRules.length}
                </span>
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
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        disabled={busy}
                        onClick={() => void removePermission(rule.id)}
                      >
                        {t('btn.delete')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="groups-permission-form">
                <select
                  value={permissionForm.category}
                  onChange={(e) => setPermissionForm((form) => ({ ...form, category: e.target.value }))}
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <select
                  value={permissionForm.accessLevel}
                  onChange={(e) => setPermissionForm((form) => ({ ...form, accessLevel: e.target.value }))}
                >
                  <option value="Read">{t('access.read')}</option>
                  <option value="Preview">{t('access.preview')}</option>
                  <option value="Download">{t('access.download')}</option>
                  <option value="Write">{t('access.write')}</option>
                </select>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busy}
                  onClick={() => void savePermission()}
                >
                  {t('groups.grantPermission')}
                </button>
              </div>
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
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} ({u.email})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busy || !addUserId}
                onClick={() => void addMember()}
              >
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
                      <span className="users-avatar" aria-hidden="true">
                        {memberInitials(m.fullName, m.email)}
                      </span>
                      <div className="groups-member-meta">
                        <strong>{m.fullName || m.email}</strong>
                        <span>{m.email}</span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        disabled={busy}
                        onClick={() => void removeMember(m.userId)}
                      >
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
            <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setDeleteTarget(null)}>
              {t('btn.cancel')}
            </button>
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void deleteGroup()}>
              {t('btn.delete')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
