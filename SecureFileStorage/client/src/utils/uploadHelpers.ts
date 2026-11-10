/** Constantes alignées sur SecureFileStorage.Infrastructure.Security.FileValidator */
export const UPLOAD_MAX_BYTES = 1024 * 1024 * 1024 * 1024
export const UPLOAD_MAX_TB = 1

export const UPLOAD_ALLOWED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.heic', '.heif', '.txt', '.csv', '.zip',
  '.mp4', '.webm', '.mkv', '.avi', '.mov', '.m4v', '.wmv', '.3gp',
  '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma',
] as const

export const UPLOAD_ACCEPT_ATTRIBUTE = UPLOAD_ALLOWED_EXTENSIONS.join(',')

export const UPLOAD_SUPPORTED_FORMATS_LABEL =
  'PDF, Office, images (JPG, PNG, GIF, WEBP, BMP, HEIC), ZIP, vidéos (MP4, WEBM, MKV, AVI, MOV, 3GP…) et audio (MP3, WAV, OGG, FLAC, AAC…)'

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

export const PUBLIC_ACCESS_LEVELS = [
  { value: 'Read', labelKey: 'access.read' as const },
  { value: 'Preview', labelKey: 'access.preview' as const },
  { value: 'Download', labelKey: 'access.download' as const },
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
    || type.startsWith('video/')
    || type.startsWith('audio/')
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
  parentId?: string | null
}): FormData {
  const { file, category, description, visibility, publicLevel, sharedRows, parentId } = options
  const form = new FormData()
  form.append('file', file)
  form.append('category', category)
  form.append('description', description)
  form.append('visibility', visibility)
  if (parentId) form.append('parentId', parentId)
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

export function keywordsFromFileName(name: string): string[] {
  return name
    .replace(/\.[^.]+$/, '')
    .split(/[\s_\-.()[\]]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2)
    .slice(0, 6)
}

const TAG_STOPWORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'en', 'dans', 'pour', 'par', 'sur',
  'avec', 'sans', 'the', 'and', 'for', 'from', 'with', 'this', 'that', 'document', 'fichier', 'file',
  'files', 'page', 'pages', 'copie', 'copy', 'final', 'version', 'pdf', 'docx', 'doc', 'xlsx', 'pptx',
  'txt', 'nouveau', 'nouvelle', 'untitled',
])

const TAG_LEXICON: Array<[RegExp, string]> = [
  [/contrat\s+de\s+travail/i, 'Contrat de travail'],
  [/\bcontrats?\b/i, 'Contrat'],
  [/\bconvention\b/i, 'Contrat'],
  [/\bfactures?\b|\binvoices?\b/i, 'Facture'],
  [/\bdevis\b|\bquotes?\b/i, 'Devis'],
  [/\bpaie\b|\bsalaire\b|\bpayroll\b|\bbulletin\b/i, 'Paie'],
  [/\bcv\b|\bcurriculum\b|\bresume\b/i, 'CV'],
  [/\brapports?\b|\breports?\b/i, 'Rapport'],
  [/\brgpd\b|\bgdpr\b/i, 'RGPD'],
  [/\bpolitique\b|\bpolicy\b/i, 'Politique'],
  [/\bconfidentialit[eé]\b|\bprivacy\b/i, 'Confidentialité'],
  [/\bbudget\b|\bcomptabilit[eé]\b|\bfinance\b/i, 'Finance'],
  [/\bformation\b|\btraining\b/i, 'Formation'],
  [/\bs[eé]curit[eé]\b|\bsecurity\b/i, 'Sécurité'],
  [/\baudit\b/i, 'Audit'],
  [/\bprojet\b|\bproject\b/i, 'Projet'],
  [/\breunion\b|\br[eé]union\b|\bmeeting\b/i, 'Réunion'],
  [/\brh\b|\bressources?\s+humaines?\b/i, 'RH'],
  [/\bjuridique\b|\blegal\b/i, 'Juridique'],
  [/\bpr[eé]sentation\b|\bslides?\b/i, 'Présentation'],
  [/\battestation\b/i, 'Attestation'],
]

const PDF_NOISE = /^(endobj|endstream|startxref|xref|obj|stream|trailer|filter|length|type|font|parent|kids|count|mediabox|resources|procset|extgstate|contents|annot|rect|subtype|catalog|outlines|encoding|widths|bbox|matrix)$/i

export function extractTagsLocally(input: {
  fileName: string
  title?: string
  category?: string
  description?: string
  excerpt?: string
}): string[] {
  const haystack = [input.fileName, input.title, input.category, input.description, input.excerpt]
    .filter(Boolean)
    .join(' ')
  const tags: string[] = []
  const seen = new Set<string>()
  const add = (tag: string) => {
    const value = tag.trim()
    if (!value || seen.has(value.toLowerCase())) return
    seen.add(value.toLowerCase())
    tags.push(value)
  }

  for (const [re, tag] of TAG_LEXICON) {
    if (re.test(haystack)) add(tag)
  }

  const cat = (input.category || '').trim()
  if (cat && !/^general|général$/i.test(cat)) add(cat)

  const ext = fileExtension(input.fileName)
  if (['xlsx', 'xls', 'csv', 'ods'].includes(ext)) add('Tableur')
  if (['pptx', 'ppt', 'odp'].includes(ext)) add('Présentation')

  for (const token of keywordsFromFileName(input.fileName)) {
    const key = token.toLowerCase()
    if (TAG_STOPWORDS.has(key) || /^\d+$/.test(token)) continue
    if ([...seen].some((s) => s.includes(key) || key.includes(s))) continue
    add(token)
  }

  return tags.slice(0, 8)
}

export async function extractDocumentExcerpt(file: File): Promise<string> {
  const ext = fileExtension(file.name)
  const isText =
    file.type.startsWith('text/') ||
    ['txt', 'csv', 'json', 'xml', 'md', 'log'].includes(ext)
  if (isText && file.size < 800_000) {
    try {
      return (await file.text()).slice(0, 8000)
    } catch {
      return ''
    }
  }

  try {
    const buf = await file.slice(0, 1_500_000).arrayBuffer()
    return extractPrintableRuns(new Uint8Array(buf), 8000)
  } catch {
    return ''
  }
}

function extractPrintableRuns(bytes: Uint8Array, maxChars: number): string {
  const chunks: string[] = []
  let current = ''
  const flush = () => {
    const trimmed = current.trim()
    current = ''
    if (trimmed.length < 4 || PDF_NOISE.test(trimmed)) return
    if (/^[\d./\\-]+$/.test(trimmed)) return
    chunks.push(trimmed)
  }
  for (const b of bytes) {
    const ok = (b >= 32 && b < 127) || (b >= 192 && b <= 255)
    if (ok) {
      current += String.fromCharCode(b)
    } else {
      flush()
    }
    if (chunks.join(' ').length >= maxChars) break
  }
  flush()
  return chunks.join(' ').slice(0, maxChars)
}

export function guessLanguageFromName(name: string): string {
  const n = name.toLowerCase()
  if (/[àâäéèêëïîôùûüç]/.test(n) || /\b(fr|francais|français)\b/.test(n)) return 'fr'
  if (/\b(en|english)\b/.test(n)) return 'en'
  return '—'
}

export type ConfidentialityLevel = 'internal' | 'confidential' | 'secret'

export const UPLOAD_DRAFT_KEY = 'sfs_upload_draft_v1'

