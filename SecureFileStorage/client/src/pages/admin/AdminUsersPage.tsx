import { useCallback, useEffect, useState } from 'react'
import { api } from '@/api/client'
import { UsersList } from '@/components/users/UsersList'
import { UsersSkeleton } from '@/components/users/UsersSkeleton'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/i18n/I18nContext'
import { AdminGroupsPanel } from '@/pages/admin/AdminGroupsPage'
import type { AdminUser } from '@/types'

export function AdminUsersPage() {
  const { t } = useI18n()
  const { isAuthenticated } = useAuth()
  const [tab, setTab] = useState<'users' | 'groups'>('users')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const u = await api<AdminUser[]>('/api/admin/users')
      setUsers(u || [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('msg.loadProfileError')
      if (msg.includes('401') || msg.includes('Session')) {
        setError(t('msg.sessionExpired'))
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (!isAuthenticated) return
    void load()
  }, [load, isAuthenticated])

  return (
    <section className="page users-page files-like-page" id="page-admin-users">
      <div className="profile-segmented admin-users-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'users'}
          className={`profile-segment${tab === 'users' ? ' active' : ''}`}
          onClick={() => setTab('users')}
        >
          {t('nav.users')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'groups'}
          className={`profile-segment${tab === 'groups' ? ' active' : ''}`}
          onClick={() => setTab('groups')}
        >
          {t('nav.groups')}
        </button>
      </div>

      {tab === 'users' ? (
        <>
          {error && (
            <div className="msg error">
              {error}
              <button type="button" className="btn btn-outline btn-sm" onClick={() => void load()}>
                {t('audit.refresh')}
              </button>
            </div>
          )}

          {loading ? (
            <UsersSkeleton />
          ) : (
            <UsersList users={users} onChanged={load} />
          )}
        </>
      ) : (
        <AdminGroupsPanel />
      )}
    </section>
  )
}
