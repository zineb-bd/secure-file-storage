import { useCallback, useEffect, useState } from 'react'
import { api } from '@/api/client'
import { UsersList } from '@/components/users/UsersList'
import { UsersSkeleton } from '@/components/users/UsersSkeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/i18n/I18nContext'
import type { AdminUser } from '@/types'

export function AdminUsersPage() {
  const { t } = useI18n()
  const { isAuthenticated } = useAuth()
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
    <section className="page users-page" id="page-admin-users">
      <PageHeader title={t('page.adminUsers.title')} subtitle={t('page.adminUsers.subtitle')} />

      {error && <div className="msg error">{error}</div>}

      {loading ? (
        <UsersSkeleton />
      ) : (
        <UsersList users={users} onChanged={load} />
      )}
    </section>
  )
}
