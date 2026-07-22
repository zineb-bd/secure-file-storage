import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/api/client'
import {
  CATEGORIES,
  CATEGORY_OVERRIDES_KEY,
  CUSTOM_CATEGORIES_KEY,
} from '@/constants'
import { PageHeader } from '@/components/layout/PageHeader'
import { DocumentTable } from '@/components/documents/DocumentTable'
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/i18n/I18nContext'
import { buildQuery } from '@/utils/format'
import type { DocumentDto } from '@/types'

interface CustomCategory {
  name: string
  description?: string
  icon?: string
  color?: string
}

const BUILTIN_META: Record<string, { icon: string; color: string; descKey: string }> = {
  RH: { icon: 'users', color: 'blue', descKey: 'cat.desc.rh' },
  Factures: { icon: 'finance', color: 'green', descKey: 'cat.desc.invoices' },
  Contrats: { icon: 'contract', color: 'indigo', descKey: 'cat.desc.contracts' },
  General: { icon: 'folder', color: 'slate', descKey: 'cat.desc.general' },
}

function loadCustom(): CustomCategory[] {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_CATEGORIES_KEY) || '[]')
  } catch {
    return []
  }
}

function loadOverrides(): Record<string, Partial<CustomCategory & { label?: string }>> {
  try {
    return JSON.parse(localStorage.getItem(CATEGORY_OVERRIDES_KEY) || '{}')
  } catch {
    return {}
  }
}

export function CategoriesPage() {
  const { t } = useI18n()
  const [docs, setDocs] = useState<DocumentDto[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = buildQuery({ page: 1, pageSize: 500, status: 'Active' })
      const data = await api<{ items: DocumentDto[] }>(`/api/documents${q}`)
      setDocs(data.items || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const getLabel = (key: string) => {
    const overrides = loadOverrides()[key]
    if (overrides?.label) return overrides.label
    const labels: Record<string, string> = {
      General: t('cat.label.general'),
      RH: t('cat.label.rh'),
      Factures: t('cat.label.invoices'),
      Contrats: t('cat.label.contracts'),
    }
    return labels[key] || key
  }

  const keys = useMemo(() => {
    const set = new Set<string>(CATEGORIES)
    loadCustom().forEach((c) => set.add(c.name))
    docs.forEach((d) => set.add(d.category || 'General'))
    return Array.from(set).sort((a, b) => getLabel(a).localeCompare(getLabel(b)))
  }, [docs, t])

  const filteredKeys = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return keys
    return keys.filter(
      (k) =>
        getLabel(k).toLowerCase().includes(q) ||
        k.toLowerCase().includes(q) ||
        docs.some((d) => (d.category || 'General') === k && d.fileName.toLowerCase().includes(q))
    )
  }, [keys, search, docs, t])

  const categoryDocs = useMemo(() => {
    if (!selected) return []
    return docs.filter((d) => (d.category || 'General') === selected)
  }, [docs, selected])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3200)
  }

  const createCategory = () => {
    if (!editName.trim()) {
      showToast(t('cat.nameRequired'))
      return
    }
    if (keys.includes(editName.trim())) {
      showToast(t('cat.nameExists'))
      return
    }
    const list = loadCustom()
    list.push({ name: editName.trim(), description: editDesc.trim() })
    localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(list))
    setModalOpen(false)
    setEditName('')
    setEditDesc('')
    showToast(t('cat.created'))
    void load()
  }

  const getDesc = (key: string) => {
    const custom = loadCustom().find((c) => c.name === key)
    if (custom?.description) return custom.description
    const builtin = BUILTIN_META[key]
    return builtin ? t(builtin.descKey) : t('cat.desc.default')
  }

  if (selected) {
    return (
      <section className="page" id="page-categories">
        <PageHeader
          title={getLabel(selected)}
          subtitle={getDesc(selected)}
          actions={
            <button type="button" className="btn btn-outline" onClick={() => setSelected(null)}>
              {t('cat.back')}
            </button>
          }
        />
        <DocumentTable documents={categoryDocs} onChanged={load} emptyMsg={t('cat.noDocsInCategory')} />
      </section>
    )
  }

  return (
    <section className="page" id="page-categories">
      <PageHeader
        title={t('page.categories.title')}
        subtitle={t('page.categories.subtitle')}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
            {t('cat.newCategory')}
          </button>
        }
      />
      <div className="cat-toolbar">
        <input
          type="search"
          placeholder={t('cat.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {toast && <div className="profile-toast">{toast}</div>}
      {loading ? (
        <div className="cat-loading">
          <div className="spinner" />
        </div>
      ) : !filteredKeys.length ? (
        <div className="cat-empty">
          <h3>{t('cat.emptyTitle')}</h3>
          <p>{t('cat.emptyDesc')}</p>
          <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
            {t('cat.emptyCta')}
          </button>
        </div>
      ) : (
        <div className="cat-grid">
          {filteredKeys.map((key) => {
            const count = docs.filter((d) => (d.category || 'General') === key).length
            const meta = BUILTIN_META[key] || { color: 'slate' }
            return (
              <div key={key} className="cat-card" onClick={() => setSelected(key)} role="button" tabIndex={0}>
                <div className={`cat-card-icon cat-icon-${meta.color}`} />
                <div className="cat-card-name">{getLabel(key)}</div>
                <div className="cat-card-meta">
                  {count} {t('cat.documents')}
                </div>
                <p className="cat-card-desc">{getDesc(key)}</p>
                <button type="button" className="btn btn-sm btn-outline" onClick={(e) => { e.stopPropagation(); setSelected(key) }}>
                  {t('cat.open')}
                </button>
              </div>
            )
          })}
        </div>
      )}
      {modalOpen && (
        <Modal title={t('cat.newCategory')} onClose={() => setModalOpen(false)}>
          <div className="form-group">
            <label htmlFor="cat-modal-name">{t('cat.fieldName')}</label>
            <input id="cat-modal-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="cat-modal-desc">{t('cat.fieldDesc')}</label>
            <textarea id="cat-modal-desc" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={() => setModalOpen(false)}>
              {t('btn.cancel')}
            </button>
            <button type="button" className="btn btn-primary" onClick={createCategory}>
              {t('cat.createCategory')}
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}
