import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '@/api/client'
import { CATEGORIES } from '@/constants'
import { useAuth } from '@/context/AuthContext'
import { FileIcon } from '@/components/documents/FileIcon'
import {
  IconAlert,
  IconArrowLeft,
  IconCheckCircle,
  IconFileSecure,
  IconGlobe,
  IconLock,
  IconShieldCheck,
  IconUploadCloud,
  IconUsers,
  IconX,
} from '@/components/upload/UploadIcons'
import { useI18n } from '@/i18n/I18nContext'
import { loadCustomCategories } from '@/utils/categoryStorage'
import { uploadWithProgress } from '@/utils/uploadApi'
import {
  buildUploadFormData,
  buildVersionFormData,
  fileExtension,
  isThreatUploadError,
  mapScanResultToUi,
  normalizeSharedRows,
  SECURITY_FEATURES,
  UPLOAD_MAX_MB,
  UPLOAD_PIPELINE_STEPS,
  UPLOAD_SUPPORTED_FORMATS_LABEL,
  validateUploadFile,
  type ScanUiStatus,
  type SharedRow,
  type UploadFileStatus,
  type UploadVisibility,
} from '@/utils/uploadHelpers'
import { fmtSize } from '@/utils/format'
import type { DocumentDto, DocumentImportSource, UserDirectoryEntry } from '@/types'

type ImportSourceId = 'device' | 'url' | 'googledrive' | 'onedrive' | 'dropbox'

const VIS_OPTIONS: UploadVisibility[] = ['Private', 'Shared', 'Public']

const CLOUD_SOURCES: ImportSourceId[] = ['googledrive', 'onedrive', 'dropbox']

function statusBadgeClass(status: UploadFileStatus) {
  return `upload-status-badge upload-status-${status}`
}

export function UploadPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const documentId = searchParams.get('documentId')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [importSource, setImportSource] = useState<ImportSourceId>('device')
  const [importSources, setImportSources] = useState<DocumentImportSource[]>([])
  const [importUrl, setImportUrl] = useState('')
  const [urlFileName, setUrlFileName] = useState('')

  const [file, setFile] = useState<File | null>(null)
  const [fileQueue, setFileQueue] = useState<File[]>([])
  const [fileStatus, setFileStatus] = useState<UploadFileStatus>('ready')
  const [scanStatus, setScanStatus] = useState<ScanUiStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [pipelineStep, setPipelineStep] = useState(0)

  const [category, setCategory] = useState('General')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<UploadVisibility>('Private')
  const [publicLevel, setPublicLevel] = useState('Download')
  const [sharedRows, setSharedRows] = useState<SharedRow[]>([])
  const [changeComment, setChangeComment] = useState('')
  const [versionConfirmed, setVersionConfirmed] = useState(false)

  const [directory, setDirectory] = useState<UserDirectoryEntry[]>([])
  const [existingDoc, setExistingDoc] = useState<DocumentDto | null>(null)
  const [loadingDoc, setLoadingDoc] = useState(!!documentId)

  const [uploading, setUploading] = useState(false)
  const [uploadDone, setUploadDone] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [resultDoc, setResultDoc] = useState<DocumentDto | null>(null)

  const isVersionMode = !!documentId && !!existingDoc

  const categories = useMemo(() => {
    const custom = loadCustomCategories().map((c) => c.name)
    return [...new Set([...CATEGORIES, ...custom])]
  }, [])

  useEffect(() => {
    void api<UserDirectoryEntry[]>('/api/users/directory')
      .then(setDirectory)
      .catch(() => setDirectory([]))
    void api<DocumentImportSource[]>('/api/documents/import/sources')
      .then(setImportSources)
      .catch(() => setImportSources([]))
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
        if (err === 'invalidType') {
          setUploadError(t('upload.errorInvalidType'))
          continue
        }
        accepted.push(next)
      }
      if (!accepted.length) return
      setUploadError('')
      setImportSource('device')
      if (isVersionMode || accepted.length === 1) {
        setFile(accepted[0])
        setFileQueue([])
      } else {
        setFile(accepted[0])
        setFileQueue(accepted.slice(1))
      }
      setFileStatus('ready')
      setScanStatus('idle')
      setProgress(0)
      setUploadDone(false)
      setResultDoc(null)
    },
    [t, isVersionMode]
  )

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    pickFiles(e.target.files)
    e.target.value = ''
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (importSource !== 'device' && importSource !== 'url') setImportSource('device')
    pickFiles(e.dataTransfer.files)
  }

  const removeFile = () => {
    if (uploading) return
    if (fileQueue.length) {
      setFile(fileQueue[0])
      setFileQueue((q) => q.slice(1))
    } else {
      setFile(null)
    }
    setFileStatus('ready')
    setProgress(0)
    setUploadError('')
    setUploadDone(false)
  }

  const visHint =
    visibility === 'Private'
      ? t('upload.vis.private')
      : visibility === 'Shared'
        ? t('upload.vis.shared')
        : t('upload.vis.public')

  const accessSummary = useMemo(() => {
    if (isVersionMode) return t('upload.summaryVersion')
    if (visibility === 'Private') return t('vis.private')
    if (visibility === 'Public') {
      const level = t(`access.${publicLevel.toLowerCase()}` as 'access.read')
      return `${t('vis.public')} — ${level}`
    }
    const count = sharedRows.filter((r) => r.email.trim()).length
    return count ? `${t('vis.shared')} (${count})` : t('vis.shared')
  }, [isVersionMode, visibility, publicLevel, sharedRows, t])

  const runPipelineAnimation = useCallback(() => {
    setPipelineStep(0)
    setScanStatus('scanning')
    const interval = window.setInterval(() => {
      setPipelineStep((s) => {
        // Stay on antivirus step until the backend responds — do not fake "Safe".
        const scanIdx = UPLOAD_PIPELINE_STEPS.indexOf('scan')
        if (s >= scanIdx) {
          window.clearInterval(interval)
          return scanIdx
        }
        return s + 1
      })
    }, 400)
    return () => window.clearInterval(interval)
  }, [])

  const completePipelineAfterScan = (status: ScanUiStatus) => {
    setScanStatus(status)
    if (status === 'safe' || status === 'skipped' || status === 'error') {
      const scanIdx = UPLOAD_PIPELINE_STEPS.indexOf('scan')
      let step = scanIdx
      const finish = window.setInterval(() => {
        step += 1
        setPipelineStep(step)
        if (step >= UPLOAD_PIPELINE_STEPS.length - 1) window.clearInterval(finish)
      }, 280)
    }
  }

  const uploadSingleFile = async (target: File) => {
    if (isVersionMode && documentId) {
      const form = buildVersionFormData(target, changeComment)
      return uploadWithProgress(`/api/documents/${documentId}`, form, 'PUT', setProgress)
    }
    const form = buildUploadFormData({
      file: target,
      category,
      description,
      visibility,
      publicLevel,
      sharedRows,
    })
    return uploadWithProgress('/api/documents', form, 'POST', setProgress)
  }

  const handleImportFromUrl = async () => {
    if (!importUrl.trim()) {
      setUploadError(t('upload.urlRequired'))
      return
    }
    if (!isVersionMode && visibility === 'Shared' && normalizeSharedRows(sharedRows).length === 0) {
      setUploadError(t('upload.sharedUsersRequired'))
      return
    }

    setUploading(true)
    setUploadError('')
    setFileStatus('uploading')
    setProgress(15)
    setScanStatus('scanning')
    const stopPipeline = runPipelineAnimation()

    try {
      const sharedUsers =
        visibility === 'Shared'
          ? normalizeSharedRows(sharedRows).map((r) => ({
              userEmail: r.email,
              accessLevel: r.level,
            }))
          : undefined
      const result = await api<DocumentDto>('/api/documents/import/url', {
        method: 'POST',
        body: JSON.stringify({
          url: importUrl.trim(),
          fileName: urlFileName.trim() || undefined,
          category,
          description,
          visibility,
          publicAccessLevel: visibility === 'Public' ? publicLevel : undefined,
          sharedUsers,
        }),
      })
      stopPipeline()
      const uiScan = mapScanResultToUi(result.lastScanResult)
      completePipelineAfterScan(uiScan)
      setProgress(100)
      setFileStatus('uploaded')
      setResultDoc(result)
      setUploadDone(true)
    } catch (err) {
      stopPipeline()
      const msg = err instanceof Error ? err.message : t('upload.errorGeneric')
      setFileStatus('failed')
      setScanStatus(isThreatUploadError(msg) ? 'threat' : 'error')
      setUploadError(msg)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    if (importSource === 'url') {
      await handleImportFromUrl()
      return
    }
    if (CLOUD_SOURCES.includes(importSource)) {
      setUploadError(t('upload.cloudSoon'))
      return
    }
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

    setUploading(true)
    setUploadError('')
    setFileStatus('uploading')
    setProgress(0)
    setScanStatus('scanning')
    const stopPipeline = runPipelineAnimation()

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
      stopPipeline()
      const uiScan = mapScanResultToUi(last?.lastScanResult)
      completePipelineAfterScan(uiScan)
      setProgress(100)
      setFileStatus('uploaded')
      setResultDoc(last)
      setUploadDone(true)
      setFileQueue([])
    } catch (err) {
      stopPipeline()
      const msg = err instanceof Error ? err.message : t('upload.errorGeneric')
      setFileStatus('failed')
      setScanStatus(isThreatUploadError(msg) ? 'threat' : 'error')
      setUploadError(msg)
    } finally {
      setUploading(false)
    }
  }

  const statusLabel = (status: UploadFileStatus) => {
    switch (status) {
      case 'ready':
        return t('upload.statusReady')
      case 'uploading':
        return t('upload.statusUploading')
      case 'uploaded':
        return t('upload.statusUploaded')
      case 'failed':
        return t('upload.statusFailed')
    }
  }

  if (loadingDoc) {
    return (
      <section className="page upload-page">
        <div className="loading">
          <div className="spinner" />
        </div>
      </section>
    )
  }

  if (documentId && !existingDoc) {
    return (
      <section className="page upload-page">
        <div className="upload-header-row">
          <Link to="/documents" className="btn btn-secondary upload-back-btn">
            <IconArrowLeft />
            {t('upload.backToDocuments')}
          </Link>
        </div>
        <div className="upload-error-banner">
          <IconAlert />
          {t('upload.documentNotFound')}
        </div>
      </section>
    )
  }

  return (
    <section className="page upload-page" id="page-upload">
      <div className="upload-header-row">
        <Link to="/documents" className="btn btn-secondary upload-back-btn">
          <IconArrowLeft />
          {t('upload.backToDocuments')}
        </Link>
      </div>

      <header className="upload-page-header">
        <div>
          <h1 className="page-title">{isVersionMode ? t('upload.versionTitle') : t('upload.title')}</h1>
          <p className="page-subtitle">
            {isVersionMode ? t('upload.versionSubtitle') : t('upload.subtitle')}
          </p>
        </div>
        <div className="upload-header-badge">
          <IconShieldCheck size={18} />
          <span>{t('upload.secureBadge')}</span>
        </div>
      </header>

      <div className="upload-layout">
        <div className="upload-main">
          {!isVersionMode && (
            <div className="upload-source-tabs" role="tablist" aria-label={t('upload.sources')}>
              <button
                type="button"
                role="tab"
                className={`upload-source-tab${importSource === 'device' ? ' active' : ''}`}
                aria-selected={importSource === 'device'}
                onClick={() => setImportSource('device')}
                disabled={uploading}
              >
                {t('upload.source.device')}
              </button>
              <button
                type="button"
                role="tab"
                className={`upload-source-tab${importSource === 'url' ? ' active' : ''}`}
                aria-selected={importSource === 'url'}
                onClick={() => setImportSource('url')}
                disabled={uploading}
              >
                {t('upload.source.url')}
              </button>
              {(['googledrive', 'onedrive', 'dropbox'] as const).map((id) => {
                const meta = importSources.find((s) => s.id === id)
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    className={`upload-source-tab${importSource === id ? ' active' : ''}`}
                    aria-selected={importSource === id}
                    disabled
                    title={meta?.unavailableReason || t('upload.cloudSoon')}
                  >
                    {t(`upload.source.${id}`)}
                    <span className="upload-source-soon">{t('upload.soon')}</span>
                  </button>
                )
              })}
            </div>
          )}

          {importSource === 'url' && !isVersionMode ? (
            <div className="upload-card upload-url-card">
              <div className="upload-card-header">
                <h3>{t('upload.source.url')}</h3>
              </div>
              <p className="form-hint">{t('upload.urlHint')}</p>
              <div className="form-group">
                <label htmlFor="import-url">{t('upload.urlLabel')}</label>
                <input
                  id="import-url"
                  type="url"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://example.com/document.pdf"
                  disabled={uploading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="import-url-name">{t('upload.urlFileName')}</label>
                <input
                  id="import-url-name"
                  type="text"
                  value={urlFileName}
                  onChange={(e) => setUrlFileName(e.target.value)}
                  placeholder="document.pdf"
                  disabled={uploading}
                />
              </div>
              <p className="form-hint">{t('upload.urlSecurityHint')}</p>
            </div>
          ) : (
          /* Drop zone */
          <div
            className={`upload-dropzone${dragOver ? ' drag-over' : ''}${file ? ' has-file' : ''}`}
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
            <div className="upload-dropzone-inner">
              <div className="upload-dropzone-icon">
                {file ? <IconFileSecure size={44} /> : <IconUploadCloud size={40} />}
              </div>
              <h2 className="upload-dropzone-title">
                {file ? t('upload.replaceFile') : t('upload.emptyTitle')}
              </h2>
              <p className="upload-dropzone-text">
                {file ? file.name : t('upload.emptyHint')}
              </p>
              {!file && (
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
              )}
              <div className="upload-constraints">
                <p>
                  {t('upload.supportedFormats')}: {UPLOAD_SUPPORTED_FORMATS_LABEL}
                </p>
                <p>{t('upload.maxSize', { max: String(UPLOAD_MAX_MB) })}</p>
              </div>
            </div>
          </div>
          )}

          {/* Selected file */}
          {file && importSource === 'device' && (
            <div className="upload-card">
              <div className="upload-card-header">
                <h3>{t('upload.selectedFiles')}</h3>
              </div>
              <div className="upload-file-row">
                <FileIcon contentType={file.type} fileName={file.name} />
                <div className="upload-file-meta">
                  <span className="upload-file-name">{file.name}</span>
                  <span className="upload-file-sub">
                    {fileExtension(file.name).toUpperCase() || '—'} · {fmtSize(file.size)}
                  </span>
                </div>
                <span className={statusBadgeClass(fileStatus)}>{statusLabel(fileStatus)}</span>
                {!uploading && fileStatus !== 'uploaded' && (
                  <button
                    type="button"
                    className="upload-file-remove"
                    aria-label={t('upload.removeFile')}
                    onClick={removeFile}
                  >
                    <IconX />
                  </button>
                )}
              </div>
              {fileQueue.map((queued) => (
                <div key={`${queued.name}-${queued.size}`} className="upload-file-row">
                  <FileIcon contentType={queued.type} fileName={queued.name} />
                  <div className="upload-file-meta">
                    <span className="upload-file-name">{queued.name}</span>
                    <span className="upload-file-sub">
                      {fileExtension(queued.name).toUpperCase() || '—'} · {fmtSize(queued.size)}
                    </span>
                  </div>
                  <span className="upload-status-badge upload-status-ready">{t('upload.statusQueued')}</span>
                </div>
              ))}
              {(fileStatus === 'uploading' || fileStatus === 'uploaded') && (
                <div className="upload-progress-block">
                  <div className="upload-progress-label">
                    {fileStatus === 'uploaded' ? t('upload.successTitle') : t('upload.progressLabel')}
                  </div>
                  <div className="upload-progress-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                    <div className="upload-progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="upload-progress-pct">{progress}%</span>
                </div>
              )}
              {fileStatus === 'failed' && uploadError && (
                <div className="upload-inline-error">
                  <IconAlert />
                  {uploadError}
                </div>
              )}
            </div>
          )}

          {/* Version mode */}
          {isVersionMode && existingDoc && (
            <div className="upload-card upload-version-card">
              <div className="upload-card-header">
                <h3>{t('upload.versionSection')}</h3>
              </div>
              <div className="upload-version-grid">
                <div>
                  <span className="upload-meta-label">{t('upload.existingDocument')}</span>
                  <p className="upload-meta-value">{existingDoc.fileName}</p>
                </div>
                <div>
                  <span className="upload-meta-label">{t('upload.currentVersion')}</span>
                  <p className="upload-meta-value">v{existingDoc.currentVersion}</p>
                </div>
                <div>
                  <span className="upload-meta-label">{t('upload.newVersion')}</span>
                  <p className="upload-meta-value">v{existingDoc.currentVersion + 1}</p>
                </div>
              </div>
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

          {/* Document information — new upload only */}
          {!isVersionMode && (
            <div className="upload-card">
              <div className="upload-card-header">
                <h3>{t('upload.docInfo')}</h3>
              </div>
              <div className="upload-form-grid">
                <div className="form-group">
                  <label htmlFor="upload-doc-name">{t('upload.docName')}</label>
                  <input
                    id="upload-doc-name"
                    type="text"
                    value={file?.name.replace(/\.[^.]+$/, '') || ''}
                    readOnly
                    className="upload-readonly"
                    placeholder={t('upload.docNamePlaceholder')}
                  />
                  <p className="form-hint">{t('upload.docNameHint')}</p>
                </div>
                <div className="form-group">
                  <label htmlFor="upload-owner">{t('upload.owner')}</label>
                  <input
                    id="upload-owner"
                    type="text"
                    value={user?.fullName || '—'}
                    readOnly
                    className="upload-readonly"
                  />
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
              </div>
            </div>
          )}

          {/* Access & visibility */}
          {!isVersionMode && (
            <div className="upload-card">
              <div className="upload-card-header">
                <h3>{t('upload.accessVisibility')}</h3>
              </div>
              <div className="upload-vis-cards">
                {VIS_OPTIONS.map((v) => {
                  const Icon = v === 'Private' ? IconLock : v === 'Shared' ? IconUsers : IconGlobe
                  return (
                    <label
                      key={v}
                      className={`upload-vis-card${visibility === v ? ' selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="visibility"
                        value={v}
                        checked={visibility === v}
                        onChange={() => setVisibility(v)}
                        disabled={uploading}
                      />
                      <Icon size={22} />
                      <span className="upload-vis-card-title">{t(`vis.${v.toLowerCase()}` as 'vis.private')}</span>
                      <span className="upload-vis-card-desc">
                        {v === 'Private'
                          ? t('upload.visCard.private')
                          : v === 'Shared'
                            ? t('upload.visCard.shared')
                            : t('upload.visCard.public')}
                      </span>
                    </label>
                  )
                })}
              </div>
              <p className="form-hint upload-vis-hint">{visHint}</p>

              {visibility === 'Shared' && (
                <div className="upload-shared-block">
                  <p className="upload-shared-title">{t('upload.sharedUsers')}</p>
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
                        onChange={(e) => {
                          const next = [...sharedRows]
                          next[i] = { ...next[i], level: e.target.value }
                          setSharedRows(next)
                        }}
                        disabled={uploading}
                      >
                        <option value="Read">{t('access.read')}</option>
                        <option value="Preview">{t('access.preview')}</option>
                        <option value="Download">{t('access.download')}</option>
                        <option value="Write">{t('access.write')}</option>
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
                    <option value="Read">{t('access.read')}</option>
                    <option value="Preview">{t('access.preview')}</option>
                    <option value="Download">{t('access.download')}</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Metadata — auto fields */}
          {!isVersionMode && (
            <div className="upload-card">
              <div className="upload-card-header">
                <h3>{t('upload.metadata')}</h3>
                <span className="upload-card-badge">{t('upload.autoFields')}</span>
              </div>
              <div className="upload-meta-grid">
                <div>
                  <span className="upload-meta-label">{t('upload.metaType')}</span>
                  <p className="upload-meta-value">{file?.type || '—'}</p>
                </div>
                <div>
                  <span className="upload-meta-label">{t('filter.category')}</span>
                  <p className="upload-meta-value">{category}</p>
                </div>
                <div>
                  <span className="upload-meta-label">{t('upload.metaCreated')}</span>
                  <p className="upload-meta-value">{t('upload.metaCreatedAuto')}</p>
                </div>
              </div>
            </div>
          )}

          {/* Security */}
          <div className="upload-card upload-security-card">
            <div className="upload-card-header">
              <h3>{t('upload.security')}</h3>
            </div>
            <ul className="upload-security-list">
              {SECURITY_FEATURES.map((key) => (
                <li key={key}>
                  <IconShieldCheck size={18} />
                  {t(`upload.security.${key}`)}
                </li>
              ))}
            </ul>

            {(uploading || scanStatus !== 'idle') && (
              <div className={`upload-scan-panel upload-scan-${scanStatus}`}>
                {scanStatus === 'scanning' && (
                  <>
                    <div className="upload-scan-spinner" aria-hidden />
                    <div>
                      <strong>{t('upload.scan.title')}</strong>
                      <p>{t('upload.scan.scanning')}</p>
                    </div>
                  </>
                )}
                {scanStatus === 'safe' && (
                  <>
                    <IconCheckCircle size={28} />
                    <div>
                      <strong>{t('upload.scan.safeTitle')}</strong>
                      <p>{t('upload.scan.safeBody')}</p>
                    </div>
                  </>
                )}
                {scanStatus === 'threat' && (
                  <>
                    <IconAlert size={28} />
                    <div>
                      <strong>{t('upload.scan.threatTitle')}</strong>
                      <p>{t('upload.scan.threatBody')}</p>
                    </div>
                  </>
                )}
                {scanStatus === 'skipped' && (
                  <>
                    <IconAlert size={28} />
                    <div>
                      <strong>{t('upload.scan.skippedTitle')}</strong>
                      <p>{t('upload.scan.skippedBody')}</p>
                    </div>
                  </>
                )}
                {scanStatus === 'error' && fileStatus !== 'failed' && (
                  <>
                    <IconAlert size={28} />
                    <div>
                      <strong>{t('upload.scan.errorTitle')}</strong>
                      <p>{t('upload.scan.errorBody')}</p>
                    </div>
                  </>
                )}
                {scanStatus === 'error' && fileStatus === 'failed' && !isThreatUploadError(uploadError) && (
                  <>
                    <IconAlert size={28} />
                    <div>
                      <strong>{t('upload.scan.errorTitle')}</strong>
                      <p>{uploadError || t('upload.scan.errorBody')}</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {(uploading || uploadDone || scanStatus === 'threat') && (
              <div className="upload-pipeline">
                <p className="upload-pipeline-title">{t('upload.pipelineTitle')}</p>
                <ul>
                  {UPLOAD_PIPELINE_STEPS.map((step, i) => {
                    const scanIdx = UPLOAD_PIPELINE_STEPS.indexOf('scan')
                    const done =
                      scanStatus === 'threat'
                        ? i <= scanIdx
                        : i <= pipelineStep && (scanStatus !== 'scanning' || i < scanIdx || (i === scanIdx && uploading))
                    const active = uploading && i === pipelineStep && step === 'scan' && scanStatus === 'scanning'
                    return (
                      <li
                        key={step}
                        className={`${done ? 'done' : ''}${active ? ' active' : ''}${
                          step === 'scan' && scanStatus === 'threat' ? ' threat' : ''
                        }`}
                      >
                        {done && scanStatus !== 'threat' ? (
                          <IconCheckCircle size={16} />
                        ) : step === 'scan' && scanStatus === 'threat' ? (
                          <IconAlert size={16} />
                        ) : (
                          <span className="upload-pipeline-dot" />
                        )}
                        {t(`upload.pipeline.${step}`)}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Summary sidebar */}
        <aside className="upload-summary-panel">
          <div className="upload-summary-card">
            <h3>{t('upload.summary')}</h3>
            {!file && importSource !== 'url' ? (
              <p className="upload-summary-empty">{t('upload.summaryEmpty')}</p>
            ) : importSource === 'url' && !file ? (
              <dl className="upload-summary-dl">
                <div>
                  <dt>{t('upload.source.url')}</dt>
                  <dd>{importUrl.trim() || '—'}</dd>
                </div>
                {!isVersionMode && (
                  <>
                    <div>
                      <dt>{t('filter.category')}</dt>
                      <dd>{category}</dd>
                    </div>
                    <div>
                      <dt>{t('upload.summaryVisibility')}</dt>
                      <dd>{accessSummary}</dd>
                    </div>
                  </>
                )}
                <div>
                  <dt>{t('upload.summarySecurity')}</dt>
                  <dd className="upload-summary-secure">
                    <IconShieldCheck size={16} />
                    {scanStatus === 'safe'
                      ? t('upload.scan.safeTitle')
                      : scanStatus === 'skipped'
                        ? t('upload.scan.skippedTitle')
                        : scanStatus === 'error'
                          ? t('upload.scan.errorTitle')
                          : scanStatus === 'threat'
                            ? t('upload.scan.threatTitle')
                            : t('upload.summarySecurityOk')}
                  </dd>
                </div>
              </dl>
            ) : (
              <dl className="upload-summary-dl">
                <div>
                  <dt>{t('upload.summaryFile')}</dt>
                  <dd>{file?.name}</dd>
                </div>
                <div>
                  <dt>{t('upload.summaryType')}</dt>
                  <dd>{file?.type || fileExtension(file?.name || '').toUpperCase()}</dd>
                </div>
                <div>
                  <dt>{t('upload.summarySize')}</dt>
                  <dd>{file ? fmtSize(file.size) : '—'}</dd>
                </div>
                {fileQueue.length > 0 && (
                  <div>
                    <dt>{t('upload.queueCount')}</dt>
                    <dd>{fileQueue.length + 1}</dd>
                  </div>
                )}
                {!isVersionMode && (
                  <>
                    <div>
                      <dt>{t('filter.category')}</dt>
                      <dd>{category}</dd>
                    </div>
                    <div>
                      <dt>{t('upload.summaryVisibility')}</dt>
                      <dd>{accessSummary}</dd>
                    </div>
                  </>
                )}
                {isVersionMode && existingDoc && (
                  <div>
                    <dt>{t('upload.existingDocument')}</dt>
                    <dd>{existingDoc.fileName}</dd>
                  </div>
                )}
                <div>
                  <dt>{t('upload.summarySecurity')}</dt>
                  <dd className="upload-summary-secure">
                    <IconShieldCheck size={16} />
                    {scanStatus === 'safe'
                      ? t('upload.scan.safeTitle')
                      : scanStatus === 'skipped'
                        ? t('upload.scan.skippedTitle')
                        : scanStatus === 'error'
                          ? t('upload.scan.errorTitle')
                          : scanStatus === 'threat'
                            ? t('upload.scan.threatTitle')
                            : t('upload.summarySecurityOk')}
                  </dd>
                </div>
              </dl>
            )}

            {uploadDone && resultDoc && (
              <div className="upload-success-banner">
                <IconCheckCircle />
                <div>
                  <strong>{t('upload.successTitle')}</strong>
                  <p>{resultDoc.fileName}</p>
                </div>
              </div>
            )}

            {uploadError && !uploadDone && fileStatus !== 'uploading' && (
              <div className="upload-error-banner compact">
                <IconAlert />
                {uploadError}
              </div>
            )}

            <div className="upload-summary-actions">
              <button
                type="button"
                className="btn"
                onClick={() => navigate('/documents')}
                disabled={uploading}
              >
                {t('btn.cancel')}
              </button>
              {uploadDone ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => navigate('/documents')}
                >
                  {t('upload.backToDocuments')}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary upload-submit-btn"
                  onClick={() => void handleSubmit()}
                  disabled={
                    uploading ||
                    (importSource === 'url' ? !importUrl.trim() : !file) ||
                    CLOUD_SOURCES.includes(importSource)
                  }
                >
                  {uploading ? t('upload.uploading') : t('upload.submitSecure')}
                </button>
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}
