/** Constantes alignées sur SecureFileStorage.Infrastructure.Security.FileValidator */
export const UPLOAD_MAX_BYTES = 100 * 1024 * 1024
export const UPLOAD_MAX_MB = UPLOAD_MAX_BYTES / 1024 / 1024

export const UPLOAD_ALLOWED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.txt', '.csv', '.zip',
] as const

export const UPLOAD_SUPPORTED_FORMATS_LABEL =
  'PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, JPG, PNG, GIF, WEBP, TXT, CSV, ZIP'

export type UploadFileStatus = 'ready' | 'uploading' | 'uploaded' | 'failed'

/** Real antivirus outcome from backend — never invent "Safe". */
export type ScanUiStatus =
  | 'idle'
  | 'scanning'
  | 'safe'
  | 'threat'
  | 'skipped'
  | 'error'

export interface SharedRow {
  email: string
  level: string
}

export type UploadVisibility = 'Private' | 'Shared' | 'Public'

export function fileExtension(fileName: string): string {
  const ext = fileName.includes('.') ? fileName.split('.').pop() || '' : ''
  return ext.toLowerCase()
}

export function validateUploadFile(file: File): string | null {
  if (file.size <= 0) return 'empty'
  if (file.size > UPLOAD_MAX_BYTES) return 'tooLarge'
  const ext = `.${fileExtension(file.name)}`
  if (!UPLOAD_ALLOWED_EXTENSIONS.includes(ext as (typeof UPLOAD_ALLOWED_EXTENSIONS)[number])) {
    return 'invalidType'
  }
  return null
}

export function normalizeSharedRows(rows: SharedRow[]): SharedRow[] {
  const map = new Map<string, SharedRow>()
  for (const row of rows) {
    const email = row.email.trim()
    if (!email) continue
    const key = email.toLowerCase()
    map.set(key, { email, level: row.level })
  }
  return [...map.values()]
}

export function buildUploadFormData(options: {
  file: File
  category: string
  description: string
  visibility: UploadVisibility
  publicLevel: string
  sharedRows: SharedRow[]
}): FormData {
  const { file, category, description, visibility, publicLevel, sharedRows } = options
  const form = new FormData()
  form.append('file', file)
  form.append('category', category)
  form.append('description', description)
  form.append('visibility', visibility)
  if (visibility === 'Public') form.append('publicAccessLevel', publicLevel)
  if (visibility === 'Shared') {
    const entries = normalizeSharedRows(sharedRows).map((r) => ({
      userEmail: r.email,
      accessLevel: r.level,
    }))
    if (entries.length) {
      form.append('sharedUsersJson', JSON.stringify(entries))
    }
  }
  return form
}

export function buildVersionFormData(file: File, changeComment: string): FormData {
  const form = new FormData()
  form.append('file', file)
  if (changeComment.trim()) form.append('changeComment', changeComment.trim())
  return form
}

export const SECURITY_FEATURES = [
  'antivirus',
  'encryption',
  'integrity',
  'accessControl',
  'audit',
] as const

/** Aligné sur le parcours sécurité backend (validation → buffer → scan → encrypt → hash → store). */
export const UPLOAD_PIPELINE_STEPS = [
  'validate',
  'tempStore',
  'scan',
  'encrypt',
  'hash',
  'store',
  'audit',
] as const

export function mapScanResultToUi(lastScanResult?: string | null): ScanUiStatus {
  const v = (lastScanResult || '').toLowerCase()
  if (v === 'clean') return 'safe'
  if (v === 'skipped') return 'skipped'
  if (v === 'error') return 'error'
  if (v === 'infected') return 'threat'
  return 'error'
}

export function isThreatUploadError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('threat_detected') ||
    m.includes('security threat') ||
    m.includes('infecté') ||
    m.includes('infected') ||
    m.includes('menace')
  )
}
