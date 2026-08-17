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

/** Niveaux alignés sur ShareAccessLevel (backend). */
export const UPLOAD_ACCESS_LEVELS = [
  { value: 'Read', labelKey: 'access.read' as const },
  { value: 'Preview', labelKey: 'access.preview' as const },
  { value: 'Download', labelKey: 'access.download' as const },
  { value: 'Write', labelKey: 'access.write' as const },
] as const

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
  const type = file.type.toLowerCase()
  const isAllowedMime = !type || type === 'application/octet-stream'
    || type === 'application/pdf'
    || type === 'application/msword'
    || type.startsWith('application/vnd.')
    || type.startsWith('image/')
    || type.startsWith('text/')
    || type === 'application/zip'
  if (!isAllowedMime) return 'invalidMime'
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
  'compression',
  'encryption',
  'decryption',
  'integrity',
  'accessControl',
  'audit',
] as const

/** Aligné sur le parcours backend : validation → buffer → scan → compression → chiffrement → hash → stockage. */
export const UPLOAD_PIPELINE_STEPS = [
  'validate',
  'tempStore',
  'scan',
  'compress',
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
    m.includes('menace') ||
    m.includes('antivirus_unavailable') ||
    m.includes('scan antivirus') ||
    m.includes('sfs-demo-threat')
  )
}

/** Signatures alignées sur AntivirusService (moteur intégré) — pré-analyse locale. */
const LOCAL_THREAT_MARKERS = [
  'SFS-DEMO-THREAT-SIGNATURE',
  'EICAR-STANDARD-ANTIVIRUS-TEST-FILE',
] as const

/** Lit le contenu du fichier et détecte les signatures de test antivirus. */
export async function detectLocalThreatSignature(file: File): Promise<string | null> {
  if (file.size <= 0 || file.size > 2 * 1024 * 1024) return null
  try {
    const text = await file.text()
    for (const marker of LOCAL_THREAT_MARKERS) {
      if (text.toUpperCase().includes(marker.toUpperCase())) return marker
    }
  } catch {
    return null
  }
  return null
}

export async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function keywordsFromFileName(name: string): string[] {
  return name
    .replace(/\.[^.]+$/, '')
    .split(/[\s_\-.()[\]]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2)
    .slice(0, 6)
}

export function guessLanguageFromName(name: string): string {
  const n = name.toLowerCase()
  if (/[àâäéèêëïîôùûüç]/.test(n) || /\b(fr|francais|français)\b/.test(n)) return 'fr'
  if (/\b(en|english)\b/.test(n)) return 'en'
  return '—'
}

export type ConfidentialityLevel = 'internal' | 'confidential' | 'secret'

export const UPLOAD_DRAFT_KEY = 'sfs_upload_draft_v1'

