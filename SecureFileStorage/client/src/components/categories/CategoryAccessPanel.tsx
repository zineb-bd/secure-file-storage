import { useCallback, useEffect, useState } from 'react'
import { api } from '@/api/client'
import { useI18n } from '@/i18n/I18nContext'
import type { CategoryAccessRule, UserGroup } from '@/types'

const LEVELS = ['Read', 'Preview', 'Download', 'Write'] as const

interface CategoryAccessPanelProps {
  category: string
  categoryLabel: string
}

export function CategoryAccessPanel({ category, categoryLabel }: CategoryAccessPanelProps) {
  const { t } = useI18n()
  const [rules, setRules] = useState<CategoryAccessRule[]>([])
  const [groups, setGroups] = useState<UserGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [groupId, setGroupId] = useState('')
  const [level, setLevel] = useState<string>('Read')
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [r, g] = await Promise.all([
        api<CategoryAccessRule[]>(`/api/admin/category-access?category=${encodeURIComponent(category)}`),
        api<UserGroup[]>('/api/admin/groups'),
      ])
      setRules(r || [])
      setGroups(g || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : t('cat.accessLoadError'))
    } finally {
      setLoading(false)
    }
  }, [category, t])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(id)
  }, [toast])

  const upsert = async () => {
    if (!groupId) return
    setBusy(true)
    try {
      await api('/api/admin/category-access', {
        method: 'PUT',
        body: JSON.stringify({
          category,
          userGroupId: groupId,
          accessLevel: level,
        }),
      })
      setToast(t('cat.accessSaved'))
      setGroupId('')
      setLevel('Read')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('cat.accessSaveError'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    setBusy(true)
    try {
      await api(`/api/admin/category-access/${id}`, { method: 'DELETE' })
      setToast(t('cat.accessDeleted'))
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('cat.accessSaveError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cat-access-panel card" style={{ marginTop: 20, padding: 16 }}>
      <h3 style={{ marginTop: 0 }}>{t('cat.accessTitle')}</h3>
      <p className="muted">{t('cat.accessDesc', { category: categoryLabel })}</p>
      {toast && <div className="msg success">{toast}</div>}
      {error && <div className="msg error">{error}</div>}

      {loading ? (
        <p className="muted">{t('groups.loading')}</p>
      ) : (
        <>
          {rules.length === 0 ? (
            <p className="muted">{t('cat.accessEmpty')}</p>
          ) : (
            <ul className="simple-list">
              {rules.map((r) => (
                <li key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <span>
                    <strong>{r.userGroupName}</strong>
                    {' — '}
                    {t(`access.${r.accessLevel.toLowerCase()}`)}
                  </span>
                  <button type="button" className="btn btn-sm btn-outline" disabled={busy} onClick={() => void remove(r.id)}>
                    {t('btn.delete')}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} style={{ minWidth: 180 }}>
              <option value="">{t('cat.accessSelectGroup')}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {t(`access.${l.toLowerCase()}`)}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy || !groupId} onClick={() => void upsert()}>
              {t('cat.accessAdd')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
