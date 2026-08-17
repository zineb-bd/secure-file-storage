import { useCallback, useEffect, useState } from 'react'
import { api } from '@/api/client'
import { DocumentAuditList } from '@/components/audit/DocumentAuditList'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/i18n/I18nContext'
import type { AdminUser } from '@/types'

export function AdminAuditPage() {
  const { t } = useI18n()
  const { isAuthenticated } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [error, setError] = useState('')

  const loadUsers = useCallback(async () => {
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
    }
  }, [t])

  useEffect(() => {
    if (!isAuthenticated) return
    void loadUsers()
  }, [loadUsers, isAuthenticated])

  return (
    <section className="page audit-page files-like-page" id="page-admin-audit">
      {error && (
        <div className="msg error">
          {error}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void loadUsers()}>
            {t('audit.refresh')}
          </button>
        </div>
      )}
      <DocumentAuditList users={users} />
    </section>
  )
}
