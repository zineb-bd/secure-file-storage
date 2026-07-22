import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { useI18n } from '@/i18n/I18nContext'
import { fmtDate } from '@/utils/format'
import type { AdminUser, AntivirusAlert, AuditLog, RoleDto, StorageConfig } from '@/types'

export function AdminUsersPage() {
  const { t, locale } = useI18n()
  const [users, setUsers] = useState<AdminUser[]>([])

  const load = async () => {
    setUsers(await api<AdminUser[]>('/api/admin/users'))
  }

  useEffect(() => {
    void load()
  }, [])

  const deactivate = async (id: string) => {
    await api(`/api/admin/users/${id}/deactivate`, { method: 'POST' })
    await load()
  }

  return (
    <section className="page" id="page-admin-users">
      <PageHeader title={t('page.adminUsers.title')} subtitle={t('page.adminUsers.subtitle')} />
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="data-table">
        <thead>
          <tr>
            <th>{t('table.email')}</th>
            <th>{t('table.name')}</th>
            <th>{t('table.roles')}</th>
            <th>{t('table.status')}</th>
            <th>{t('table.created')}</th>
            <th>{t('table.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td>
                {u.firstName} {u.lastName}
              </td>
              <td>{u.roles.join(', ')}</td>
              <td>{u.isActive ? t('status.active') : t('status.inactive')}</td>
              <td>{fmtDate(u.createdAt, locale)}</td>
              <td>
                {u.isActive && (
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => void deactivate(u.id)}>
                    {t('btn.deactivate')}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export function AdminRolesPage() {
  const { t } = useI18n()
  const [roles, setRoles] = useState<RoleDto[]>([])

  useEffect(() => {
    void api<RoleDto[]>('/api/admin/roles').then(setRoles)
  }, [])

  return (
    <section className="page" id="page-admin-roles">
      <PageHeader title={t('page.adminRoles.title')} subtitle={t('page.adminRoles.subtitle')} />
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="data-table">
        <thead>
          <tr>
            <th>{t('table.name')}</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{r.description}</td>
            </tr>
          ))}
        </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export function AdminAuditPage() {
  const { t, locale } = useI18n()
  const [logs, setLogs] = useState<AuditLog[]>([])

  useEffect(() => {
    void api<{ items: AuditLog[] }>('/api/admin/audit?page=1&pageSize=50').then((d) => setLogs(d.items || []))
  }, [])

  return (
    <section className="page" id="page-admin-audit">
      <PageHeader title={t('page.adminAudit.title')} subtitle={t('page.adminAudit.subtitle')} />
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="data-table">
        <thead>
          <tr>
            <th>{t('table.action')}</th>
            <th>{t('table.email')}</th>
            <th>Détails</th>
            <th>{t('table.date')}</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td>{l.action}</td>
              <td>{l.userEmail || '—'}</td>
              <td>{l.details}</td>
              <td>{fmtDate(l.timestamp, locale)}</td>
            </tr>
          ))}
        </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export function AdminConfigPage() {
  const { t, locale } = useI18n()
  const [config, setConfig] = useState<StorageConfig | null>(null)
  const [alerts, setAlerts] = useState<AntivirusAlert[]>([])

  useEffect(() => {
    void Promise.all([
      api<StorageConfig>('/api/admin/storage'),
      api<AntivirusAlert[]>('/api/admin/security/antivirus-alerts'),
    ]).then(([c, a]) => {
      setConfig(c)
      setAlerts(a)
    })
  }, [])

  const rotateKey = async () => {
    const r = await api<{ keyIdentifier: string; rotatedAt: string }>('/api/admin/security/rotate-key', {
      method: 'POST',
    })
    alert(`Clé rotée : ${r.keyIdentifier}`)
  }

  return (
    <section className="page" id="page-admin-config">
      <PageHeader title={t('page.adminConfig.title')} subtitle={t('page.adminConfig.subtitle')} />
      {config && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Stockage</h3>
          </div>
          <p>Provider : {config.providerType}</p>
          <p>Base : {config.basePath}</p>
          <p>Mis à jour : {fmtDate(config.updatedAt, locale)}</p>
        </div>
      )}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Sécurité</h3>
        </div>
        <button type="button" className="btn btn-warning" onClick={() => void rotateKey()}>
          Rotation de clé
        </button>
      </div>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Alertes antivirus</h3>
        </div>
        {!alerts.length ? (
          <p>Aucune alerte.</p>
        ) : (
          <ul>
            {alerts.map((a) => (
              <li key={a.id}>
                {a.fileName} — {a.threatName} ({fmtDate(a.detectedAt, locale)})
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
