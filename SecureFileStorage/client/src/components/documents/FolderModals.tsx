import { useEffect, useMemo, useState } from 'react'
import { api } from '@/api/client'
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/i18n/I18nContext'
import type { DocumentDto, FolderTreeItem } from '@/types'

export function CreateFolderModal({
  parentId,
  onClose,
  onCreated,
}: {
  parentId: string | null
  onClose: () => void
  onCreated: () => void
}) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError('')
    try {
      await api('/api/documents/folders', {
        method: 'POST',
        body: JSON.stringify({ name: trimmed, parentId }),
      })
      onCreated()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('files.folderError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={t('files.newFolder')} onClose={onClose}>
      <div className="folder-modal">
        <label htmlFor="folder-name">{t('files.folderName')}</label>
        <input
          id="folder-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit()
          }}
          autoFocus
          maxLength={200}
          placeholder={t('files.folderNamePlaceholder')}
        />
        {error && <p className="msg error">{error}</p>}
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            {t('btn.cancel')}
          </button>
          <button type="button" className="btn btn-primary" disabled={busy || !name.trim()} onClick={() => void submit()}>
            {busy ? t('files.creating') : t('files.createFolder')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function isForbiddenTarget(targetId: string, movingId: string, items: FolderTreeItem[]): boolean {
  if (targetId === movingId) return true
  let current: FolderTreeItem | undefined = items.find((i) => i.id === targetId)
  const guard = new Set<string>()
  while (current?.parentId && !guard.has(current.id)) {
    guard.add(current.id)
    if (current.parentId === movingId) return true
    current = items.find((i) => i.id === current?.parentId)
  }
  return false
}

export function MoveModal({
  doc,
  onClose,
  onMoved,
}: {
  doc: DocumentDto
  onClose: () => void
  onMoved: () => void
}) {
  const { t } = useI18n()
  const [folders, setFolders] = useState<FolderTreeItem[]>([])
  const [target, setTarget] = useState<string | null>(doc.parentId ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void api<FolderTreeItem[]>('/api/documents/folders')
      .then(setFolders)
      .catch(() => setFolders([]))
  }, [])

  const options = useMemo(() => {
    const depthOf = (id: string, seen = new Set<string>()): number => {
      const item = folders.find((f) => f.id === id)
      if (!item?.parentId || seen.has(id)) return 0
      seen.add(id)
      return 1 + depthOf(item.parentId, seen)
    }
    return folders
      .filter((f) => !isForbiddenTarget(f.id, doc.id, folders))
      .map((f) => ({ ...f, depth: depthOf(f.id) }))
  }, [folders, doc.id])

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await api(`/api/documents/${doc.id}/move`, {
        method: 'POST',
        body: JSON.stringify({ targetParentId: target }),
      })
      onMoved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('files.moveError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={t('files.moveTitle', { name: doc.fileName })} onClose={onClose}>
      <div className="folder-modal">
        <p className="folder-move-hint">{t('files.moveHint')}</p>
        <div className="folder-picker" role="listbox" aria-label={t('files.moveHint')}>
          <button
            type="button"
            className={`folder-picker-item${!target ? ' is-selected' : ''}`}
            onClick={() => setTarget(null)}
          >
            {t('files.rootFolder')}
          </button>
          {options.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`folder-picker-item${target === f.id ? ' is-selected' : ''}`}
              style={{ paddingLeft: `${0.75 + f.depth * 0.9}rem` }}
              onClick={() => setTarget(f.id)}
            >
              {f.name}
            </button>
          ))}
        </div>
        {error && <p className="msg error">{error}</p>}
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            {t('btn.cancel')}
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void submit()}>
            {busy ? t('files.moving') : t('action.move')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
