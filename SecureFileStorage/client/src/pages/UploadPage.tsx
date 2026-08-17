import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '@/api/client'
import { CATEGORIES } from '@/constants'
import { FileIcon } from '@/components/documents/FileIcon'
import {
  IconAlert,
  IconArrowLeft,
  IconCheckCircle,
  IconGlobe,
  IconLock,
  IconShieldCheck,
  IconUploadCloud,
  IconUsers,
  IconX,
} from '@/components/upload/UploadIcons'
import { useI18n } from '@/i18n/I18nContext'
import { loadCustomCategories } from '@/utils/categoryStorage'
import { uploadWithProgress, type UploadJob } from '@/utils/uploadApi'
import {
  buildUploadFormData,
  buildVersionFormData,
  detectLocalThreatSignature,
  fileExtension,
  guessLanguageFromName,
  isThreatUploadError,
  keywordsFromFileName,
  mapScanResultToUi,
  normalizeSharedRows,
  sha256Hex,
  UPLOAD_ACCESS_LEVELS,
  UPLOAD_DRAFT_KEY,
  UPLOAD_MAX_MB,
  UPLOAD_SUPPORTED_FORMATS_LABEL,
  validateUploadFile,
  type ScanUiStatus,
  type SharedRow,
  type UploadFileStatus,
  type UploadVisibility,
} from '@/utils/uploadHelpers'
import { fmtSize } from '@/utils/format'
import type { DocumentDto, UserDirectoryEntry } from '@/types'

type ToastKind = 'success' | 'error' | 'info' | 'threat'
type ToastState = { kind: ToastKind; message: string } | null
type PreviewKind = 'image' | 'pdf' | 'office' | 'text' | 'other'

function previewKindOf(file: File): PreviewKind {
  const ext = fileExtension(file.name)
  if (file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return 'image'
  }
  if (file.type === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'office'
  if (file.type.startsWith('text/') || ['txt', 'csv'].includes(ext)) return 'text'
  return 'other'
}

export function UploadPage() {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const documentId = searchParams.get('documentId')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadJobRef = useRef<UploadJob | null>(null)
  const preScanTimerRef = useRef<number | null>(null)

  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [fileQueue, setFileQueue] = useState<File[]>([])
  const [fileStatus, setFileStatus] = useState<UploadFileStatus>('ready')
  const [scanStatus, setScanStatus] = useState<ScanUiStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [preScanProgress, setPreScanProgress] = useState(0)

  const [docName, setDocName] = useState('')
  const [category, setCategory] = useState('General')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [visibility, setVisibility] = useState<UploadVisibility>('Private')
  const [publicLevel, setPublicLevel] = useState('Download')
  const [sharedRows, setSharedRows] = useState<SharedRow[]>([])
  const [changeComment, setChangeComment] = useState('')
  const [versionConfirmed, setVersionConfirmed] = useState(false)

  const [hash, setHash] = useState('')
  const [hashAt, setHashAt] = useState<Date | null>(null)
  const [hashPending, setHashPending] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [textPreview, setTextPreview] = useState('')
  const [scanAt, setScanAt] = useState<Date | null>(null)

  const [directory, setDirectory] = useState<UserDirectoryEntry[]>([])
  const [existingDoc, setExistingDoc] = useState<DocumentDto | null>(null)
  const [loadingDoc, setLoadingDoc] = useState(!!documentId)

  const [uploading, setUploading] = useState(false)
  const [uploadDone, setUploadDone] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [resultDoc, setResultDoc] = useState<DocumentDto | null>(null)
  const [toast, setToast] = useState<ToastState>(null)

  const isVersionMode = !!documentId && !!existingDoc
  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [locale]
  )

  const categories = useMemo(() => {
    const custom = loadCustomCategories().map((c) => c.name)
    return [...new Set([...CATEGORIES, ...custom])]
  }, [])

  const showToast = useCallback((kind: ToastKind, message: string) => {
    setToast({ kind, message })
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(id)
  }, [toast])

  useEffect(() => {
    void api<UserDirectoryEntry[]>('/api/users/directory')
      .then(setDirectory)
      .catch(() => setDirectory([]))
  }, [])

  useEffect(() => {
    if (!documentId) {
      setExistingDoc(null)
      setLoadingDoc(false)
      return
    }
    setLoadingDoc(true)
    void api<DocumentDto>(`/api/documents/${documentId}`)
      .then(setExistingDoc)
      .catch(() => setExistingDoc(null))
      .finally(() => setLoadingDoc(false))
  }, [documentId])

  useEffect(() => {
    if (visibility === 'Shared' && !sharedRows.length) {
      setSharedRows([{ email: '', level: 'Read' }])
    }
  }, [visibility, sharedRows.length])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(UPLOAD_DRAFT_KEY)
      if (!raw || documentId) return
      const draft = JSON.parse(raw) as {
        docName?: string
        category?: string
        description?: string
        tags?: string[]
        visibility?: UploadVisibility
        publicLevel?: string
        sharedRows?: SharedRow[]
      }
      if (draft.docName) setDocName(draft.docName)
      if (draft.category) setCategory(draft.category)
      if (draft.description) setDescription(draft.description)
      if (draft.tags) setTags(draft.tags)
      if (draft.visibility) setVisibility(draft.visibility)
      if (draft.publicLevel) setPublicLevel(draft.publicLevel)
      if (draft.sharedRows?.length) setSharedRows(draft.sharedRows)
    } catch {
      /* ignore corrupt draft */
    }
  }, [documentId])

  useEffect(() => {
    return () => {
      if (preScanTimerRef.current) window.clearInterval(preScanTimerRef.current)
      uploadJobRef.current?.abort()
    }
  }, [])

  const clearPreview = useCallback(() => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setTextPreview('')
  }, [])

  const runLocalAnalysis = useCallback(
    async (target: File) => {
      if (preScanTimerRef.current) {
        window.clearInterval(preScanTimerRef.current)
        preScanTimerRef.current = null
      }

      setScanStatus('scanning')
      setPreScanProgress(8)
      setScanAt(new Date())
      setHash('')
      setHashAt(null)
      setHashPending(true)
      clearPreview()

      const kind = previewKindOf(target)
      if (kind === 'image' || kind === 'pdf') {
        setPreviewUrl(URL.createObjectURL(target))
      } else if (kind === 'text' && target.size < 400_000) {
        try {
          const text = await target.text()
          setTextPreview(text.slice(0, 4000))
        } catch {
          setTextPreview('')
        }
      }

      preScanTimerRef.current = window.setInterval(() => {
        setPreScanProgress((p) => Math.min(92, p + 7 + Math.floor(Math.random() * 8)))
      }, 180)

      try {
        const threat = await detectLocalThreatSignature(target)
        const digest = await sha256Hex(target)
        setHash(digest)
        setHashAt(new Date())
        setHashPending(false)
        setPreScanProgress(100)
        setScanAt(new Date())
        if (threat) {
          setScanStatus('threat')
          showToast('threat', t('upload.studio.toastThreat'))
        } else {
          setScanStatus('idle')
          showToast('info', t('upload.studio.toastScanDone'))
        }
      } catch {
        setHashPending(false)
        setPreScanProgress(100)
        setScanStatus('error')
      } finally {
        if (preScanTimerRef.current) {
          window.clearInterval(preScanTimerRef.current)
          preScanTimerRef.current = null
        }
      }
    },
    [clearPreview, showToast, t]
  )

  const pickFiles = useCallback(
    (list: FileList | File[] | null) => {
      if (!list || !list.length) return
      const incoming = Array.from(list)
      const accepted: File[] = []
      for (const next of incoming) {
        const err = validateUploadFile(next)
        if (err === 'empty') {
          setUploadError(t('upload.errorEmpty'))
          continue
        }
        if (err === 'tooLarge') {
          setUploadError(t('upload.errorTooLarge', { max: String(UPLOAD_MAX_MB) }))
          continue
        }
        if (err === 'invalidType' || err === 'invalidMime') {
          setUploadError(t('upload.errorInvalidType'))
          continue
        }
        accepted.push(next)
      }
      if (!accepted.length) return

      setUploadError('')
      const primary = accepted[0]
      if (isVersionMode || accepted.length === 1) {
        setFile(primary)
        setFileQueue([])
      } else {
        setFile(primary)
        setFileQueue(accepted.slice(1))
      }
      setDocName(primary.name.replace(/\.[^.]+$/, ''))
      setFileStatus('ready')
      setProgress(0)
      setUploadDone(false)
      setResultDoc(null)
      void runLocalAnalysis(primary)
    },
    [t, isVersionMode, runLocalAnalysis]
  )

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    pickFiles(e.target.files)
    e.target.value = ''
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    pickFiles(e.dataTransfer.files)
  }

  const removeFile = () => {
    if (uploading) return
    if (fileQueue.length) {
      const next = fileQueue[0]
      setFile(next)
      setFileQueue((q) => q.slice(1))
      setDocName(next.name.replace(/\.[^.]+$/, ''))
      void runLocalAnalysis(next)
    } else {
      setFile(null)
      setDocName('')
      setScanStatus('idle')
      setPreScanProgress(0)
      setHash('')
      setHashAt(null)
      clearPreview()
    }
    setFileStatus('ready')
    setProgress(0)
    setUploadError('')
    setUploadDone(false)
  }

  const addTag = () => {
    const value = tagInput.trim()
    if (!value) return
    if (!tags.includes(value)) setTags([...tags, value])
    setTagInput('')
  }

  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    }
  }

  const resetForm = () => {
    if (uploading) return
    uploadJobRef.current?.abort()
    setFile(null)
    setFileQueue([])
    setFileStatus('ready')
    setScanStatus('idle')
    setProgress(0)
    setPreScanProgress(0)
    setDocName('')
    setCategory('General')
    setDescription('')
    setTags([])
    setTagInput('')
    setVisibility('Private')
    setPublicLevel('Download')
    setSharedRows([])
    setChangeComment('')
    setVersionConfirmed(false)
    setHash('')
    setHashAt(null)
    setScanAt(null)
    setUploadDone(false)
    setUploadError('')
    setResultDoc(null)
    clearPreview()
    localStorage.removeItem(UPLOAD_DRAFT_KEY)
  }

  const saveDraft = () => {
    const payload = {
      docName,
      category,
      description,
      tags,
      visibility,
      publicLevel,
      sharedRows,
    }
    localStorage.setItem(UPLOAD_DRAFT_KEY, JSON.stringify(payload))
    showToast('success', t('upload.studio.toastDraft'))
  }

  const cancelUpload = () => {
    uploadJobRef.current?.abort()
    uploadJobRef.current = null
    setUploading(false)
    setFileStatus('ready')
    setScanStatus('idle')
    setProgress(0)
    setUploadError(t('upload.studio.cancelUpload'))
  }

  const uploadSingleFile = async (target: File) => {
    const onProgress = (percent: number) => setProgress(percent)
    if (isVersionMode && documentId) {
      const form = buildVersionFormData(target, changeComment)
      const job = uploadWithProgress(`/api/documents/${documentId}`, form, 'PUT', onProgress)
      uploadJobRef.current = job
      return job.promise
    }
    const descParts = [description.trim()]
    if (tags.length) descParts.push(`Tags: ${tags.join(', ')}`)
    if (docName.trim() && docName.trim() !== target.name.replace(/\.[^.]+$/, '')) {
      descParts.push(`Titre: ${docName.trim()}`)
    }

    const form = buildUploadFormData({
      file: target,
      category,
      description: descParts.filter(Boolean).join('\n'),
      visibility,
      publicLevel,
      sharedRows,
    })
    const job = uploadWithProgress('/api/documents', form, 'POST', onProgress)
    uploadJobRef.current = job
    return job.promise
  }

  const handleSubmit = async () => {
    if (!file) {
      setUploadError(t('upload.selectFile'))
      return
    }
    if (isVersionMode && !versionConfirmed) {
      setUploadError(t('upload.versionConfirmRequired'))
      return
    }
    if (!isVersionMode && visibility === 'Shared' && normalizeSharedRows(sharedRows).length === 0) {
      setUploadError(t('upload.sharedUsersRequired'))
      return
    }
    if (scanStatus === 'threat' || scanStatus === 'scanning') return

    setUploading(true)
    setUploadError('')
    setFileStatus('uploading')
    setProgress(0)
    setScanStatus('scanning')
    setPreScanProgress(0)
    setScanAt(new Date())

    try {
      const queue = [file, ...fileQueue]
      let last: DocumentDto | null = null
      for (let i = 0; i < queue.length; i++) {
        setFile(queue[i])
        setFileQueue(queue.slice(i + 1))
        setProgress(0)
        setFileStatus('uploading')
        setScanStatus('scanning')
        last = await uploadSingleFile(queue[i])
      }
      const uiScan = mapScanResultToUi(last?.lastScanResult)
      setScanStatus(uiScan)
      setScanAt(new Date())
      setProgress(100)
      setFileStatus('uploaded')
      setResultDoc(last)
      setUploadDone(true)
      setFileQueue([])
      localStorage.removeItem(UPLOAD_DRAFT_KEY)
      if (uiScan === 'threat') {
        showToast('threat', t('upload.studio.toastThreat'))
      } else {
        showToast('success', t('upload.studio.toastSuccess'))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('upload.errorGeneric')
      const threat = isThreatUploadError(msg)
      setFileStatus('failed')
      setScanStatus(threat ? 'threat' : 'error')
      setUploadError(msg)
      showToast(threat ? 'threat' : 'error', threat ? t('upload.studio.toastThreat') : t('upload.studio.toastError'))
    } finally {
      uploadJobRef.current = null
      setUploading(false)
    }
  }

  const keywords = useMemo(() => (file ? keywordsFromFileName(file.name) : []), [file])
  const previewKind = file ? previewKindOf(file) : 'other'
  const uploadBlocked =
    uploading || !file || scanStatus === 'scanning' || scanStatus === 'threat' || (isVersionMode && !versionConfirmed)

  const securityTone =
    scanStatus === 'safe'
      ? 'safe'
      : scanStatus === 'threat'
        ? 'threat'
        : scanStatus === 'scanning'
          ? 'scanning'
          : ''

  if (loadingDoc) {
    return (
      <section className="page upload-page upload-studio">
        <div className="loading">
          <div className="spinner" />
        </div>
      </section>
    )
  }

  if (documentId && !existingDoc) {
    return (
      <section className="page upload-page upload-studio">
        <Link to="/documents" className="btn btn-secondary upload-back-btn">
          <IconArrowLeft />
          {t('upload.backToDocuments')}
        </Link>
        <div className="upload-error-banner">
          <IconAlert />
          {t('upload.documentNotFound')}
        </div>
      </section>
    )
  }

  return (
    <section className="page upload-page upload-studio" id="page-upload">
      <header className="upload-studio-header">
        <div>
          <Link to="/documents" className="btn btn-secondary upload-back-btn">
            <IconArrowLeft />
            {t('upload.backToDocuments')}
          </Link>
          <h1 className="page-title" style={{ marginTop: '0.75rem' }}>
            {isVersionMode ? t('upload.versionTitle') : t('upload.title')}
          </h1>
          <p className="page-subtitle">
            {isVersionMode ? t('upload.versionSubtitle') : t('upload.subtitle')}
          </p>
        </div>
        <span className="upload-header-badge">
          <IconShieldCheck size={16} />
          {t('upload.secureBadge')}
        </span>
      </header>

      <div className="upload-studio-grid">
        <div className="upload-studio-main">
          <div className="upload-card-modern">
            <div
              className={`upload-dropzone-modern${dragOver ? ' drag-over' : ''}${file ? ' has-file' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={t('upload.dropAria')}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="upload-file-input"
                multiple={!isVersionMode}
                accept={UPLOAD_SUPPORTED_FORMATS_LABEL.split(', ')
                  .map((x) => {
                    const ext = x.trim().toLowerCase()
                    if (ext === 'jpg') return '.jpg,.jpeg'
                    return `.${ext}`
                  })
                  .join(',')}
                onChange={onFileInput}
                disabled={uploading}
              />
              {!file ? (
                <>
                  <div className="upload-dropzone-icon">
                    <IconUploadCloud size={44} />
                  </div>
                  <h2 className="upload-dropzone-title">{t('upload.emptyTitle')}</h2>
                  <p className="upload-dropzone-text">{t('upload.emptyHint')}</p>
                  <button
                    type="button"
                    className="btn btn-primary upload-choose-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      fileInputRef.current?.click()
                    }}
                    disabled={uploading}
                  >
                    {t('upload.chooseFiles')}
                  </button>
                  <p className="upload-constraints-simple">
                    {UPLOAD_SUPPORTED_FORMATS_LABEL} · {t('upload.maxSize', { max: String(UPLOAD_MAX_MB) })}
                  </p>
                </>
              ) : (
                <>
                  <div className="upload-file-chip-list">
                    <div className="upload-file-chip" onClick={(e) => e.stopPropagation()}>
                      <FileIcon contentType={file.type} fileName={file.name} />
                      <span>
                        {file.name} · {fileExtension(file.name).toUpperCase() || '—'} · {fmtSize(file.size)}
                      </span>
                      {!uploading && fileStatus !== 'uploaded' && (
                        <button type="button" aria-label={t('upload.removeFile')} onClick={removeFile}>
                          <IconX />
                        </button>
                      )}
                    </div>
                    {fileQueue.map((queued) => (
                      <div key={`${queued.name}-${queued.size}-${queued.lastModified}`} className="upload-file-chip">
                        <FileIcon contentType={queued.type} fileName={queued.name} />
                        <span>
                          {queued.name} · {fmtSize(queued.size)}
                        </span>
                        <span className="upload-status-badge upload-status-ready">{t('upload.statusQueued')}</span>
                      </div>
                    ))}
                  </div>
                  {(fileStatus === 'uploading' || fileStatus === 'uploaded') && (
                    <div className="upload-progress-modern" onClick={(e) => e.stopPropagation()}>
                      <span className="upload-progress-label">
                        {fileStatus === 'uploaded' ? t('upload.successTitle') : t('upload.progressLabel')}
                      </span>
                      <div
                        className="upload-progress-bar"
                        role="progressbar"
                        aria-valuenow={progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div className="upload-progress-fill" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="upload-progress-pct">{progress}%</span>
                      {uploading && (
                        <button type="button" className="btn btn-sm" onClick={cancelUpload}>
                          {t('upload.studio.cancelUpload')}
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {isVersionMode && existingDoc && (
            <div className="upload-card-modern">
              <h3>
                <IconLock size={18} />
                {existingDoc.fileName} · v{existingDoc.currentVersion} → v{existingDoc.currentVersion + 1}
              </h3>
              <div className="form-group">
                <label htmlFor="upload-change-comment">{t('upload.changeComment')}</label>
                <textarea
                  id="upload-change-comment"
                  value={changeComment}
                  onChange={(e) => setChangeComment(e.target.value)}
                  rows={2}
                  placeholder={t('upload.changeCommentPlaceholder')}
                  disabled={uploading}
                />
              </div>
              <label className="upload-version-confirm">
                <input
                  type="checkbox"
                  checked={versionConfirmed}
                  onChange={(e) => setVersionConfirmed(e.target.checked)}
                  disabled={uploading}
                />
                {t('upload.versionConfirm')}
              </label>
            </div>
          )}

          {!isVersionMode && (
            <div className="upload-card-modern">
              <h3>
                <IconUsers size={18} />
                {t('upload.studio.infoTitle')}
              </h3>
              <div className="upload-form-grid upload-form-simple">
                <div className="form-group">
                  <label htmlFor="upload-doc-name">{t('upload.studio.docName')}</label>
                  <input
                    id="upload-doc-name"
                    type="text"
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    placeholder={t('upload.docNamePlaceholder')}
                    disabled={uploading}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="upload-category">{t('filter.category')}</label>
                  <select
                    id="upload-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={uploading}
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group upload-form-full">
                  <label htmlFor="upload-desc">{t('upload.description')}</label>
                  <textarea
                    id="upload-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    disabled={uploading}
                  />
                </div>
                <div className="form-group upload-form-full">
                  <label htmlFor="upload-tags">{t('upload.studio.tags')}</label>
                  <div className="upload-tag-input">
                    {tags.map((tag) => (
                      <span key={tag} className="upload-tag-chip">
                        {tag}
                        <button
                          type="button"
                          aria-label={t('upload.removeFile')}
                          onClick={() => setTags(tags.filter((x) => x !== tag))}
                          disabled={uploading}
                        >
                          <IconX size={12} />
                        </button>
                      </span>
                    ))}
                    <input
                      id="upload-tags"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={onTagKey}
                      onBlur={addTag}
                      placeholder={t('upload.studio.tagsPlaceholder')}
                      disabled={uploading}
                    />
                  </div>
                </div>
                <div className="form-group upload-form-full">
                  <label>{t('upload.accessVisibility')}</label>
                  <div className="upload-vis-pills" role="group">
                    {(
                      [
                        { value: 'Private' as const, icon: <IconLock size={16} />, label: t('vis.private') },
                        { value: 'Shared' as const, icon: <IconUsers size={16} />, label: t('vis.shared') },
                        { value: 'Public' as const, icon: <IconGlobe size={16} />, label: t('vis.public') },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={visibility === opt.value ? 'selected' : ''}
                        aria-pressed={visibility === opt.value}
                        onClick={() => setVisibility(opt.value)}
                        disabled={uploading}
                      >
                        {opt.icon}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {visibility === 'Shared' && (
                <div className="upload-shared-block">
                  <p className="upload-shared-title">{t('upload.studio.collaborators')}</p>
                  <p className="settings-hint">{t('access.levelHint')}</p>
                  {sharedRows.map((row, i) => (
                    <div key={i} className="upload-shared-row">
                      <input
                        type="email"
                        list="upload-user-list"
                        placeholder="collegue@entreprise.local"
                        value={row.email}
                        onChange={(e) => {
                          const next = [...sharedRows]
                          next[i] = { ...next[i], email: e.target.value }
                          setSharedRows(next)
                        }}
                        disabled={uploading}
                      />
                      <select
                        value={row.level}
                        aria-label={t('upload.accessLevel')}
                        onChange={(e) => {
                          const next = [...sharedRows]
                          next[i] = { ...next[i], level: e.target.value }
                          setSharedRows(next)
                        }}
                        disabled={uploading}
                      >
                        {UPLOAD_ACCESS_LEVELS.map((level) => (
                          <option key={level.value} value={level.value}>
                            {t(level.labelKey)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-sm btn-icon-only"
                        onClick={() => setSharedRows(sharedRows.filter((_, j) => j !== i))}
                        disabled={uploading}
                      >
                        <IconX />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setSharedRows([...sharedRows, { email: '', level: 'Read' }])}
                    disabled={uploading}
                  >
                    + {t('upload.addUser')}
                  </button>
                  <datalist id="upload-user-list">
                    {directory.map((u) => (
                      <option key={u.id} value={u.email}>
                        {u.fullName}
                      </option>
                    ))}
                  </datalist>
                </div>
              )}

              {visibility === 'Public' && (
                <div className="form-group">
                  <label htmlFor="upload-public-level">{t('upload.publicLevel')}</label>
                  <select
                    id="upload-public-level"
                    value={publicLevel}
                    onChange={(e) => setPublicLevel(e.target.value)}
                    disabled={uploading}
                  >
                    {UPLOAD_ACCESS_LEVELS.map((level) => (
                      <option key={level.value} value={level.value}>
                        {t(level.labelKey)}
                      </option>
                    ))}
                  </select>
                  <p className="settings-hint">{t('access.levelHint')}</p>
                </div>
              )}
            </div>
          )}

          <div className={`upload-card-modern upload-security-card ${securityTone}`}>
            <h3>
              <IconShieldCheck size={18} />
              {t('upload.studio.securityTitle')}
            </h3>
            {!file && <p className="settings-hint">{t('upload.studio.waitingFile')}</p>}
            {file && scanStatus === 'scanning' && (
              <>
                <span className="upload-badge-scanning">{t('upload.scan.scanning')}</span>
                <div className="upload-progress-modern">
                  <span>{t('upload.studio.scanProgress')}</span>
                  <div className="upload-progress-bar" role="progressbar" aria-valuenow={uploading ? progress : preScanProgress}>
                    <div
                      className="upload-progress-fill"
                      style={{ width: `${uploading ? progress : preScanProgress}%` }}
                    />
                  </div>
                  <span className="pct">{uploading ? progress : preScanProgress}%</span>
                </div>
                <dl className="upload-meta-grid">
                  <div>
                    <dt>{t('upload.studio.scanEngine')}</dt>
                    <dd>{uploading ? t('upload.studio.engineName') : t('upload.studio.preScan')}</dd>
                  </div>
                  <div>
                    <dt>{t('upload.studio.scanTime')}</dt>
                    <dd>{scanAt ? dateFmt.format(scanAt) : '—'}</dd>
                  </div>
                </dl>
              </>
            )}
            {file && scanStatus === 'idle' && preScanProgress === 100 && (
              <>
                <span className="upload-badge-scanning">{t('upload.studio.preScanDone')}</span>
                <p>{t('upload.studio.localCheckOk')}</p>
                <dl className="upload-meta-grid">
                  <div>
                    <dt>{t('upload.studio.scanEngine')}</dt>
                    <dd>{t('upload.studio.preScan')}</dd>
                  </div>
                  <div>
                    <dt>{t('upload.studio.scanTime')}</dt>
                    <dd>{scanAt ? dateFmt.format(scanAt) : '—'}</dd>
                  </div>
                </dl>
              </>
            )}
            {file && scanStatus === 'safe' && (
              <>
                <span className="upload-badge-safe">
                  <IconCheckCircle size={14} />
                  {t('upload.scan.safeTitle')}
                </span>
                <p>
                  <strong>{t('upload.scan.safeBody')}</strong>
                </p>
                <dl className="upload-meta-grid">
                  <div>
                    <dt>{t('upload.studio.scanEngine')}</dt>
                    <dd>{t('upload.studio.engineName')}</dd>
                  </div>
                  <div>
                    <dt>{t('upload.studio.scanTime')}</dt>
                    <dd>{scanAt ? dateFmt.format(scanAt) : '—'}</dd>
                  </div>
                </dl>
              </>
            )}
            {file && scanStatus === 'threat' && (
              <>
                <span className="upload-badge-threat">
                  <IconAlert size={14} />
                  {t('upload.scan.threatTitle')}
                </span>
                <p>{t('upload.scan.threatBody')}</p>
                <dl className="upload-meta-grid">
                  <div>
                    <dt>{t('upload.studio.riskHigh')}</dt>
                    <dd>{t('upload.studio.riskHigh')}</dd>
                  </div>
                  <div>
                    <dt>{t('upload.studio.scanEngine')}</dt>
                    <dd>{t('upload.studio.engineName')}</dd>
                  </div>
                </dl>
                <p className="settings-hint">{t('upload.studio.threatRec')}</p>
              </>
            )}
            {file && (scanStatus === 'skipped' || scanStatus === 'error') && (
              <>
                <span className="upload-badge-scanning">
                  {scanStatus === 'skipped' ? t('upload.scan.skippedTitle') : t('upload.scan.errorTitle')}
                </span>
                <p>{scanStatus === 'skipped' ? t('upload.scan.skippedBody') : t('upload.scan.errorBody')}</p>
              </>
            )}
          </div>
        </div>

        <aside className="upload-studio-side">
          <div className="upload-card-modern upload-preview-card">
            <h3>{t('upload.studio.previewTitle')}</h3>
            <div className="upload-preview-pane">
              {!file && (
                <div className="upload-preview-empty">
                  <IconUploadCloud size={36} />
                  <span>{t('upload.studio.waitingFile')}</span>
                </div>
              )}
              {file && previewKind === 'image' && previewUrl && <img src={previewUrl} alt={file.name} />}
              {file && previewKind === 'pdf' && previewUrl && (
                <iframe title={file.name} src={previewUrl} />
              )}
              {file && previewKind === 'text' && textPreview && (
                <pre className="upload-hash-mono" style={{ maxHeight: 320, overflow: 'auto', width: '100%' }}>
                  {textPreview}
                </pre>
              )}
              {file && (previewKind === 'office' || previewKind === 'other' || (previewKind === 'text' && !textPreview)) && (
                <div className="upload-preview-empty">
                  <FileIcon contentType={file.type} fileName={file.name} />
                  <span>
                    {previewKind === 'office'
                      ? `${fileExtension(file.name).toUpperCase()} · ${t('upload.studio.previewUnavailable')}`
                      : t('upload.studio.previewUnavailable')}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="upload-card-modern upload-integrity-card">
            <h3>
              <IconLock size={18} />
              {t('upload.studio.integrityTitle')}
            </h3>
            <p className="settings-hint">
              {hashPending
                ? t('upload.studio.integrityPending')
                : hash
                  ? t('upload.studio.integrityOk')
                  : t('upload.studio.waitingFile')}
            </p>
            <p className="upload-hash-mono">{hash || '—'}</p>
            <dl className="upload-meta-grid">
              <div>
                <dt>{t('upload.studio.hashLabel')}</dt>
                <dd>SHA-256</dd>
              </div>
              <div>
                <dt>{t('upload.studio.verifiedAt')}</dt>
                <dd>{hashAt ? dateFmt.format(hashAt) : '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="upload-card-modern upload-ai-card">
            <h3>{t('upload.studio.aiTitle')}</h3>
            {!file ? (
              <p className="settings-hint">{t('upload.studio.waitingFile')}</p>
            ) : hashPending ? (
              <p className="settings-hint">{t('upload.studio.aiPending')}</p>
            ) : (
              <>
                <p>
                  <strong>{t('upload.studio.aiSummary')}</strong>
                  <br />
                  {t('upload.studio.aiSummaryText')}
                </p>
                <dl className="upload-meta-grid">
                  <div>
                    <dt>{t('upload.studio.aiLanguage')}</dt>
                    <dd>{guessLanguageFromName(file.name)}</dd>
                  </div>
                  <div>
                    <dt>{t('upload.studio.aiPages')}</dt>
                    <dd>{previewKind === 'pdf' ? '—' : '1'}</dd>
                  </div>
                  <div>
                    <dt>{t('upload.studio.aiWords')}</dt>
                    <dd>{textPreview ? textPreview.split(/\s+/).filter(Boolean).length : '—'}</dd>
                  </div>
                  <div>
                    <dt>{t('upload.studio.aiCategory')}</dt>
                    <dd>{category}</dd>
                  </div>
                </dl>
                {!!keywords.length && (
                  <div className="upload-tag-input">
                    <span className="settings-hint">{t('upload.studio.aiKeywords')}</span>
                    {keywords.map((k) => (
                      <span key={k} className="upload-tag-chip">
                        {k}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="upload-card-modern">
            <h3>{t('upload.studio.metaTitle')}</h3>
            {!file ? (
              <p className="settings-hint">{t('upload.studio.waitingFile')}</p>
            ) : (
              <dl className="upload-meta-grid">
                <div>
                  <dt>{t('upload.studio.metaSize')}</dt>
                  <dd>{fmtSize(file.size)}</dd>
                </div>
                <div>
                  <dt>{t('upload.studio.metaExt')}</dt>
                  <dd>.{fileExtension(file.name) || '—'}</dd>
                </div>
                <div>
                  <dt>{t('upload.studio.metaMime')}</dt>
                  <dd>{file.type || 'application/octet-stream'}</dd>
                </div>
                <div>
                  <dt>{t('upload.studio.metaModified')}</dt>
                  <dd>{dateFmt.format(new Date(file.lastModified))}</dd>
                </div>
                <div>
                  <dt>{t('upload.studio.metaCreated')}</dt>
                  <dd>{dateFmt.format(new Date(file.lastModified))}</dd>
                </div>
                <div>
                  <dt>{t('upload.studio.metaAuthor')}</dt>
                  <dd>{t('upload.studio.metaAuthorUnknown')}</dd>
                </div>
              </dl>
            )}
          </div>
        </aside>
      </div>

      {uploadDone && resultDoc && (
        <div className="upload-success-banner">
          <IconCheckCircle />
          <div>
            <strong>{t('upload.successTitle')}</strong>
            <p>{resultDoc.fileName}</p>
          </div>
        </div>
      )}

      {uploadError && !uploadDone && (
        <div className="upload-error-banner">
          <IconAlert />
          {uploadError}
        </div>
      )}

      <div className="upload-actions-bar">
        <button
          type="button"
          className="btn"
          disabled={!file || uploading || hashPending}
          onClick={() => file && void runLocalAnalysis(file)}
        >
          {t('upload.studio.analyze')}
        </button>
        <button type="button" className="btn" disabled={uploading} onClick={resetForm}>
          {t('upload.studio.reset')}
        </button>
        {!isVersionMode && (
          <button type="button" className="btn" disabled={uploading} onClick={saveDraft}>
            {t('upload.studio.draft')}
          </button>
        )}
        <button type="button" className="btn" disabled={uploading} onClick={() => navigate('/documents')}>
          {t('upload.studio.cancel')}
        </button>
        {uploadDone ? (
          <button type="button" className="btn btn-primary" onClick={() => navigate('/documents')}>
            {t('upload.backToDocuments')}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleSubmit()}
            disabled={uploadBlocked}
          >
            {uploading ? t('upload.uploading') : t('upload.studio.upload')}
          </button>
        )}
      </div>

      {toast && (
        <div className={`upload-toast ${toast.kind}`} role="status">
          {toast.kind === 'success' || toast.kind === 'info' ? <IconCheckCircle /> : <IconAlert />}
          <span>{toast.message}</span>
          <button type="button" className="btn btn-sm btn-icon-only" onClick={() => setToast(null)} aria-label="Close">
            <IconX />
          </button>
        </div>
      )}
    </section>
  )
}
