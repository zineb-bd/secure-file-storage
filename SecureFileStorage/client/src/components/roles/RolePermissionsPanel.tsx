import { useMemo, useState } from 'react'
import { useI18n } from '@/i18n/I18nContext'
import {
  ROLE_PERMISSION_CATALOG,
  deriveRolePermissions,
  totalPermissionCount,
} from '@/utils/rolePermissions'

interface RolePermissionsPanelProps {
  roleName: string
  readOnly?: boolean
  selected?: Set<string>
  onChange?: (next: Set<string>) => void
  accordion?: boolean
}

export function RolePermissionsPanel({
  roleName,
  readOnly = true,
  selected,
  onChange,
  accordion = false,
}: RolePermissionsPanelProps) {
  const { t } = useI18n()
  const derived = useMemo(() => deriveRolePermissions(roleName), [roleName])
  const activeSet = selected ?? derived

  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(ROLE_PERMISSION_CATALOG.map((c) => c.id))
  )

  const togglePerm = (id: string) => {
    if (readOnly || !onChange) return
    const next = new Set(activeSet)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  const selectAll = () => {
    if (readOnly || !onChange) return
    onChange(new Set(ROLE_PERMISSION_CATALOG.flatMap((c) => c.permissions.map((p) => p.id))))
  }

  const deselectAll = () => {
    if (readOnly || !onChange) return
    onChange(new Set())
  }

  const toggleSection = (id: string) => {
    if (!accordion) return
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="roles-perm-panel">
      {!readOnly && onChange && (
        <div className="roles-perm-toolbar">
          <button type="button" className="btn btn-sm btn-outline" onClick={selectAll}>
            {t('roles.selectAll')}
          </button>
          <button type="button" className="btn btn-sm btn-outline" onClick={deselectAll}>
            {t('roles.deselectAll')}
          </button>
        </div>
      )}

      {readOnly && (
        <p className="roles-perm-note">{t('roles.permissionsReadOnly')}</p>
      )}

      <div className="roles-perm-categories">
        {ROLE_PERMISSION_CATALOG.map((cat) => {
          const isOpen = !accordion || openSections.has(cat.id)
          const catGranted = cat.permissions.filter((p) => activeSet.has(p.id)).length

          return (
            <section key={cat.id} className="roles-perm-category">
              {accordion ? (
                <button
                  type="button"
                  className="roles-perm-category-head roles-perm-accordion-head"
                  onClick={() => toggleSection(cat.id)}
                  aria-expanded={isOpen}
                >
                  <span>{t(cat.labelKey)}</span>
                  <span className="roles-perm-count">{catGranted}/{cat.permissions.length}</span>
                </button>
              ) : (
                <div className="roles-perm-category-head">
                  <span>{t(cat.labelKey)}</span>
                  <span className="roles-perm-count">{catGranted}/{cat.permissions.length}</span>
                </div>
              )}

              {isOpen && (
                <div className="roles-perm-list">
                  {cat.permissions.map((perm) => {
                    const granted = activeSet.has(perm.id)
                    return (
                      <label
                        key={perm.id}
                        className={`roles-perm-row${granted ? ' granted' : ''}${readOnly ? ' readonly' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={granted}
                          disabled={readOnly}
                          onChange={() => togglePerm(perm.id)}
                        />
                        <span className="roles-perm-label">{t(perm.labelKey)}</span>
                        <span className="roles-perm-status">{granted ? '✓' : '✕'}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}
      </div>

      <p className="roles-perm-meta">
        {t('roles.permissionTotal', {
          count: String(activeSet.size),
          total: String(totalPermissionCount()),
        })}
      </p>
    </div>
  )
}
