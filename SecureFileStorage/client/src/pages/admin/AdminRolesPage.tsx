import { useCallback, useEffect, useState } from 'react'
import { api } from '@/api/client'
import { RolesList } from '@/components/roles/RolesList'
import { RolesSkeleton } from '@/components/roles/RolesSkeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/i18n/I18nContext'
import type { AdminUser, RoleDto } from '@/types'

export function AdminRolesPage() {
  const { t } = useI18n()
  const { isAuthenticated } = useAuth()
  const [roles, setRoles] = useState<RoleDto[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [r, u] = await Promise.all([
        api<RoleDto[]>('/api/admin/roles'),
        api<AdminUser[]>('/api/admin/users'),
      ])
      setRoles(r || [])
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
    <section className="page roles-page" id="page-admin-roles">
      <PageHeader title={t('page.adminRoles.title')} subtitle={t('page.adminRoles.subtitle')} />

      {error && <div className="msg error">{error}</div>}

      {loading ? (
        <RolesSkeleton />
      ) : (
        <RolesList roles={roles} users={users} onChanged={load} />
      )}
    </section>
  )
}
