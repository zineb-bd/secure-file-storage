import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/api/client'
import { CATEGORIES } from '@/constants'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { CategoryDocumentView } from '@/components/categories/CategoryDocumentView'
import { CategoryAccessPanel } from '@/components/categories/CategoryAccessPanel'
import {
  CategoryIcon,
  IconChevronRight,
  IconClock,
  IconEmptyFolder,
  IconFileStack,
  IconGrid,
  IconLayers,
  IconList,
  IconMore,
  IconPlus,
  IconSearch,
  IconTrending,
} from '@/components/categories/CategoryIcons'
import { CategorySkeleton } from '@/components/categories/CategorySkeleton'
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/i18n/I18nContext'
import { buildQuery, fmtDate } from '@/utils/format'
import {
  BUILTIN_META,
  CATEGORY_COLOR_IDS,
  CATEGORY_ICON_IDS,
  getCategoryMeta,
  isCustomCategory,
  loadCategoryOverrides,
  loadCustomCategories,
  saveCategoryOverrides,
  saveCustomCategories,
  type CategoryIconId,
  type CategoryColorId,
} from '@/utils/categoryStorage'
import type { DocumentDto } from '@/types'

type ViewMode = 'grid' | 'list'
type ToastType = 'success' | 'error'
type ModalMode = 'create' | 'edit'

interface CategoryForm {
  name: string
  description: string
  icon: CategoryIconId
  color: CategoryColorId
}

const DEFAULT_FORM: CategoryForm = {
  name: '',
  description: '',
  icon: 'folder',
  color: 'blue',
}

function fmtRelativeDate(
  dateStr: string | null | undefined,
  locale: string,
  t: (key: string) => string
) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86400000)
  if (diffDays === 0) return t('cat.today')
  if (diffDays === 1) return t('cat.yesterday')
  return fmtDate(dateStr, locale)
}

export function CategoriesPage() {
  const { t, locale } = useI18n()
  const { isAuthenticated, isAdmin } = useAuth()
  const [docs, setDocs] = useState<DocumentDto[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>('create')
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [form, setForm] = useState<CategoryForm>(DEFAULT_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [moveToCategory, setMoveToCategory] = useState('General')

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 4200)
  }, [])

  const bumpRefresh = () => setRefreshKey((k) => k + 1)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const q = buildQuery({ page: 1, pageSize: 500, status: 'Active' })
      const data = await api<{ items: DocumentDto[] }>(`/api/documents${q}`)
      setDocs(data.items || [])
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

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(null)
      }
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  const getLabel = useCallback(
    (key: string) => {
      const overrides = loadCategoryOverrides()[key]
      if (overrides?.label) return overrides.label
      const meta = BUILTIN_META[key]
      if (meta?.labelKey) return t(meta.labelKey)
      return key
    },
    [t, refreshKey]
  )

  const getDesc = useCallback(
    (key: string) => {
      const custom = loadCustomCategories().find((c) => c.name === key)
      if (custom?.description) return custom.description
      const override = loadCategoryOverrides()[key]
      if (override?.description) return override.description
      const builtin = BUILTIN_META[key]
      return builtin ? t(builtin.descKey) : t('cat.desc.default')
    },
    [t, refreshKey]
  )

  const keys = useMemo(() => {
    const set = new Set<string>(CATEGORIES)
    loadCustomCategories().forEach((c) => set.add(c.name))
    docs.forEach((d) => set.add(d.category || 'General'))
    return Array.from(set).sort((a, b) => getLabel(a).localeCompare(getLabel(b)))
  }, [docs, getLabel, refreshKey])

  const filteredKeys = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return keys
    return keys.filter(
      (k) =>
        getLabel(k).toLowerCase().includes(q) ||
        k.toLowerCase().includes(q) ||
        getDesc(k).toLowerCase().includes(q) ||
        docs.some((d) => (d.category || 'General') === k && d.fileName.toLowerCase().includes(q))
    )
  }, [keys, search, docs, getLabel, getDesc])

  const categoryDocs = useMemo(() => {
    if (!selected) return []
    return docs.filter((d) => (d.category || 'General') === selected)
  }, [docs, selected])

  const stats = useMemo(() => {
    const counts = keys.map((k) => ({
      key: k,
      count: docs.filter((d) => (d.category || 'General') === k).length,
    }))
    const top = counts.reduce((best, c) => (c.count > best.count ? c : best), { key: '—', count: 0 })
    const recentDoc = [...docs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0]
    return {
      totalCategories: keys.length,
      totalDocuments: docs.length,
      topCategory: top.count > 0 ? getLabel(top.key) : '—',
      topCount: top.count,
      recentLabel: recentDoc ? getLabel(recentDoc.category || 'General') : '—',
      recentDate: recentDoc?.createdAt,
    }
  }, [keys, docs, getLabel])

  const getLastModified = (key: string) => {
    const catDocs = docs.filter((d) => (d.category || 'General') === key)
    if (!catDocs.length) return null
    return catDocs.reduce((latest, d) => {
      const ts = new Date(d.updatedAt || d.createdAt).getTime()
      return ts > latest ? ts : latest
    }, 0)
  }

  const openCreateModal = () => {
    setModalMode('create')
    setEditingKey(null)
    setForm(DEFAULT_FORM)
    setFormError('')
    setModalOpen(true)
  }

  const openEditModal = (key: string) => {
    const meta = getCategoryMeta(key)
    setModalMode('edit')
    setEditingKey(key)
    setForm({
      name: getLabel(key),
      description: getDesc(key),
      icon: meta.icon,
      color: meta.color,
    })
    setFormError('')
    setModalOpen(true)
    setMenuOpen(null)
  }

  const saveCategory = async () => {
    setFormError('')
    if (!form.name.trim()) {
      setFormError(t('cat.nameRequired'))
      return
    }

    setSaving(true)
    try {
      if (modalMode === 'create') {
        const trimmed = form.name.trim()
        if (keys.includes(trimmed)) {
          setFormError(t('cat.nameExists'))
          return
        }
        const list = loadCustomCategories()
        list.push({
          name: trimmed,
          description: form.description.trim(),
          icon: form.icon,
          color: form.color,
        })
        saveCustomCategories(list)
        showToast(t('cat.created'))
      } else if (editingKey) {
        const trimmedLabel = form.name.trim()
        if (isCustomCategory(editingKey)) {
          const list = loadCustomCategories()
          const idx = list.findIndex((c) => c.name === editingKey)
          if (idx >= 0) {
            const oldName = editingKey
            const newName = trimmedLabel
            if (newName !== oldName && keys.includes(newName)) {
              setFormError(t('cat.nameExists'))
              return
            }
            list[idx] = {
              name: newName,
              description: form.description.trim(),
              icon: form.icon,
              color: form.color,
            }
            saveCustomCategories(list)
            if (newName !== oldName) {
              const affected = docs.filter((d) => (d.category || 'General') === oldName)
              await Promise.all(
                affected.map((d) =>
                  api(`/api/documents/${d.id}/metadata`, {
                    method: 'PUT',
                    body: JSON.stringify({ category: newName, description: d.description || '' }),
                  })
                )
              )
              if (selected === oldName) setSelected(newName)
            }
          }
        } else {
          const overrides = loadCategoryOverrides()
          overrides[editingKey] = {
            label: trimmedLabel,
            description: form.description.trim(),
            icon: form.icon,
            color: form.color,
          }
          saveCategoryOverrides(overrides)
        }
        showToast(t('cat.updated'))
        await load()
      }
      setModalOpen(false)
      bumpRefresh()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t('msg.loadProfileError'))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = (key: string) => {
    setDeleteTarget(key)
    setMoveToCategory(keys.find((k) => k !== key && k !== 'General') || 'General')
    setMenuOpen(null)
  }

  const deleteCategory = async () => {
    if (!deleteTarget) return

    if (!isCustomCategory(deleteTarget)) {
      showToast(t('cat.builtinProtected'), 'error')
      setDeleteTarget(null)
      return
    }

    const count = docs.filter((d) => (d.category || 'General') === deleteTarget).length

    try {
      if (count > 0) {
        const affected = docs.filter((d) => (d.category || 'General') === deleteTarget)
        await Promise.all(
          affected.map((d) =>
            api(`/api/documents/${d.id}/metadata`, {
              method: 'PUT',
              body: JSON.stringify({ category: moveToCategory, description: d.description || '' }),
            })
          )
        )
      }

      saveCustomCategories(loadCustomCategories().filter((c) => c.name !== deleteTarget))
      if (selected === deleteTarget) setSelected(null)
      setDeleteTarget(null)
      showToast(t('cat.deleted'))
      bumpRefresh()
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('msg.loadProfileError'), 'error')
    }
  }

  const renderCategoryCard = (key: string) => {
    const count = docs.filter((d) => (d.category || 'General') === key).length
    const meta = getCategoryMeta(key)
    const lastTs = getLastModified(key)
    const lastModified = lastTs ? fmtRelativeDate(new Date(lastTs).toISOString(), locale, t) : '—'

    return (
      <article key={key} className={`cat-card cat-color-${meta.color}`}>
        <div className="cat-card-top">
          <div className={`cat-card-icon cat-icon-${meta.color}`}>
            <CategoryIcon icon={meta.icon} size={22} />
          </div>
          <div className="cat-card-menu-wrap" ref={menuOpen === key ? menuRef : undefined}>
            <button
              type="button"
              className="cat-card-menu-btn"
              aria-label={t('table.actions')}
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen(menuOpen === key ? null : key)
              }}
            >
              <IconMore size={18} />
            </button>
            {menuOpen === key && (
              <div className="cat-dropdown" role="menu">
                <button type="button" role="menuitem" onClick={() => { setSelected(key); setMenuOpen(null) }}>
                  {t('cat.open')}
                </button>
                <button type="button" role="menuitem" onClick={() => openEditModal(key)}>
                  {isCustomCategory(key) ? t('btn.edit') : t('cat.rename')}
                </button>
                {isCustomCategory(key) && (
                  <button type="button" role="menuitem" className="danger" onClick={() => confirmDelete(key)}>
                    {t('btn.delete')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <h3 className="cat-card-name">{getLabel(key)}</h3>
        <p className="cat-card-count">
          {count} {t('cat.documents')}
        </p>
        <p className="cat-card-modified">
          {t('cat.lastModified')} {lastModified}
        </p>
        <p className="cat-card-desc">{getDesc(key)}</p>
        <div className="cat-card-actions">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => setSelected(key)}
          >
            {t('cat.open')}
          </button>
        </div>
      </article>
    )
  }

  const renderCategoryRow = (key: string) => {
    const count = docs.filter((d) => (d.category || 'General') === key).length
    const meta = getCategoryMeta(key)
    const lastTs = getLastModified(key)
    const lastModified = lastTs ? fmtRelativeDate(new Date(lastTs).toISOString(), locale, t) : '—'

    return (
      <article
        key={key}
        className={`cat-list-row cat-color-${meta.color}`}
        onClick={() => setSelected(key)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setSelected(key)}
      >
        <div className={`cat-list-icon cat-icon-${meta.color}`}>
          <CategoryIcon icon={meta.icon} size={20} />
        </div>
        <div className="cat-list-body">
          <strong>{getLabel(key)}</strong>
          <span>{getDesc(key)}</span>
        </div>
        <div className="cat-list-meta">
          <span>{count} {t('cat.documents')}</span>
          <span>{t('cat.lastModified')} {lastModified}</span>
        </div>
        <div className="cat-list-actions" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="btn btn-sm btn-outline" onClick={() => setSelected(key)}>
            {t('cat.open')}
          </button>
          <div className="cat-card-menu-wrap" ref={menuOpen === key ? menuRef : undefined}>
            <button
              type="button"
              className="cat-card-menu-btn"
              aria-label={t('table.actions')}
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen(menuOpen === key ? null : key)
              }}
            >
              <IconMore size={18} />
            </button>
            {menuOpen === key && (
              <div className="cat-dropdown" role="menu">
                <button type="button" role="menuitem" onClick={() => { setSelected(key); setMenuOpen(null) }}>
                  {t('cat.open')}
                </button>
                <button type="button" role="menuitem" onClick={() => openEditModal(key)}>
                  {isCustomCategory(key) ? t('btn.edit') : t('cat.rename')}
                </button>
                {isCustomCategory(key) && (
                  <button type="button" role="menuitem" className="danger" onClick={() => confirmDelete(key)}>
                    {t('btn.delete')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </article>
    )
  }

  if (selected) {
    return (
      <section className="page cat-page" id="page-categories">
        <nav className="cat-breadcrumb" aria-label="Breadcrumb">
          <button type="button" className="cat-crumb-link" onClick={() => setSelected(null)}>
            {t('page.categories.title')}
          </button>
          <IconChevronRight size={14} />
          <span className="cat-crumb-current">{getLabel(selected)}</span>
          <IconChevronRight size={14} />
          <span className="cat-crumb-muted">{t('cat.breadcrumbDocs')}</span>
        </nav>

        <PageHeader
          title={getLabel(selected)}
          subtitle={getDesc(selected)}
          actions={
            <button type="button" className="btn btn-outline" onClick={() => setSelected(null)}>
              {t('cat.back')}
            </button>
          }
        />

        <CategoryDocumentView
          documents={categoryDocs}
          emptyMsg={t('cat.noDocsInCategory')}
          onChanged={load}
        />

        {isAdmin && (
          <CategoryAccessPanel category={selected} categoryLabel={getLabel(selected)} />
        )}

        {toast && (
          <div className={`profile-toast profile-toast-${toast.type}`} role="status">
            {toast.message}
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="page cat-page" id="page-categories">
      <div className="cat-stats-row">
        <article className="cat-stat-card cat-stat-tone-blue">
          <div className="cat-stat-icon cat-stat-icon-blue">
            <IconLayers size={18} />
          </div>
          <div>
            <div className="cat-stat-value">{stats.totalCategories}</div>
            <div className="cat-stat-label">{t('cat.statTotal')}</div>
          </div>
        </article>
        <article className="cat-stat-card cat-stat-tone-green">
          <div className="cat-stat-icon cat-stat-icon-green">
            <IconFileStack size={18} />
          </div>
          <div>
            <div className="cat-stat-value">{stats.totalDocuments}</div>
            <div className="cat-stat-label">{t('cat.statDocs')}</div>
          </div>
        </article>
        <article className="cat-stat-card cat-stat-tone-indigo">
          <div className="cat-stat-icon cat-stat-icon-indigo">
            <IconTrending size={18} />
          </div>
          <div>
            <div className="cat-stat-value cat-stat-value-sm">{stats.topCategory}</div>
            <div className="cat-stat-label">{t('cat.statTop')}</div>
            {stats.topCount > 0 && (
              <div className="cat-stat-hint">{stats.topCount} {t('cat.documents')}</div>
            )}
          </div>
        </article>
        <article className="cat-stat-card cat-stat-tone-amber">
          <div className="cat-stat-icon cat-stat-icon-amber">
            <IconClock size={18} />
          </div>
          <div>
            <div className="cat-stat-value cat-stat-value-sm">{stats.recentLabel}</div>
            <div className="cat-stat-label">{t('cat.statRecent')}</div>
            {stats.recentDate && (
              <div className="cat-stat-hint">{fmtRelativeDate(stats.recentDate, locale, t)}</div>
            )}
          </div>
        </article>
      </div>

      <div className="cat-toolbar">
        <div className="cat-search-wrap">
          <IconSearch size={16} className="cat-search-icon" />
          <input
            type="search"
            className="cat-search-input"
            placeholder={t('cat.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t('filter.search')}
          />
        </div>
        <div className="cat-toolbar-actions">
          <div className="cat-view-toggle" role="group" aria-label={t('cat.viewMode')}>
            <button
              type="button"
              className={`cat-view-btn${viewMode === 'grid' ? ' active' : ''}`}
              onClick={() => setViewMode('grid')}
              title={t('cat.viewGrid')}
              aria-pressed={viewMode === 'grid'}
            >
              <IconGrid size={16} />
            </button>
            <button
              type="button"
              className={`cat-view-btn${viewMode === 'list' ? ' active' : ''}`}
              onClick={() => setViewMode('list')}
              title={t('cat.viewList')}
              aria-pressed={viewMode === 'list'}
            >
              <IconList size={16} />
            </button>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreateModal}>
            <IconPlus size={16} />
            {t('cat.newCategory')}
          </button>
        </div>
      </div>

      {error && <div className="msg error">{error}</div>}

      <section className="cat-panel">
        <div className="cat-panel-header">
          <div>
            <h2>{t('cat.listTitle')}</h2>
            <p>
              {loading
                ? t('files.loading')
                : t('cat.count', { count: String(filteredKeys.length) })}
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void load()}>
            {t('audit.refresh')}
          </button>
        </div>

        <div className="cat-panel-body">
          {loading ? (
            <CategorySkeleton />
          ) : !filteredKeys.length ? (
            <div className="cat-empty-state">
              <div className="cat-empty-icon">
                <IconEmptyFolder size={48} />
              </div>
              <h3>{search.trim() ? t('cat.noResults') : t('cat.emptyTitle')}</h3>
              <p>{search.trim() ? t('cat.noResultsDesc') : t('cat.emptyDesc')}</p>
              {!search.trim() && (
                <button type="button" className="btn btn-primary" onClick={openCreateModal}>
                  {t('cat.emptyCta')}
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="cat-grid">{filteredKeys.map(renderCategoryCard)}</div>
          ) : (
            <div className="cat-list">{filteredKeys.map(renderCategoryRow)}</div>
          )}
        </div>
      </section>

      {modalOpen && (
        <Modal
          title={modalMode === 'create' ? t('cat.newCategory') : t('cat.editCategory')}
          onClose={() => setModalOpen(false)}
        >
          <div className="cat-modal-form">
            <div className="form-group">
              <label htmlFor="cat-modal-name">{t('cat.fieldName')}</label>
              <input
                id="cat-modal-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label htmlFor="cat-modal-desc">{t('cat.fieldDesc')}</label>
              <textarea
                id="cat-modal-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="form-group">
              <label>{t('cat.fieldIcon')}</label>
              <div className="cat-icon-picker">
                {CATEGORY_ICON_IDS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    className={`cat-icon-option${form.icon === icon ? ' active' : ''}`}
                    onClick={() => setForm((f) => ({ ...f, icon }))}
                    title={icon}
                  >
                    <CategoryIcon icon={icon} size={18} />
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>{t('cat.fieldColor')}</label>
              <div className="cat-color-picker">
                {CATEGORY_COLOR_IDS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`cat-color-option cat-icon-${color}${form.color === color ? ' active' : ''}`}
                    onClick={() => setForm((f) => ({ ...f, color }))}
                    aria-label={color}
                  />
                ))}
              </div>
            </div>
            {formError && <div className="msg error">{formError}</div>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={() => setModalOpen(false)} disabled={saving}>
              {t('btn.cancel')}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void saveCategory()} disabled={saving}>
              {saving ? t('profile.saving') : modalMode === 'create' ? t('cat.createCategory') : t('btn.save')}
            </button>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title={t('cat.deleteConfirm')} onClose={() => setDeleteTarget(null)}>
          {(() => {
            const count = docs.filter((d) => (d.category || 'General') === deleteTarget).length
            return (
              <>
                <p className="cat-delete-msg">
                  {count > 0
                    ? t('cat.deleteWarnDocs', { count: String(count) })
                    : t('cat.deleteConfirm')}
                </p>
                {count > 0 && (
                  <div className="form-group">
                    <label htmlFor="cat-move-to">{t('cat.moveToCategory')}</label>
                    <select
                      id="cat-move-to"
                      value={moveToCategory}
                      onChange={(e) => setMoveToCategory(e.target.value)}
                    >
                      {keys.filter((k) => k !== deleteTarget).map((k) => (
                        <option key={k} value={k}>
                          {getLabel(k)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )
          })()}
          <div className="modal-footer">
            <button type="button" className="btn" onClick={() => setDeleteTarget(null)}>
              {t('btn.cancel')}
            </button>
            <button type="button" className="btn btn-danger" onClick={() => void deleteCategory()}>
              {t('btn.delete')}
            </button>
          </div>
        </Modal>
      )}

      {toast && (
        <div className={`profile-toast profile-toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      )}
    </section>
  )
}
