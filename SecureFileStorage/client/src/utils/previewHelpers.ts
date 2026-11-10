export type PreviewKind = 'pdf' | 'image' | 'text' | 'office' | 'video' | 'audio' | 'other'

const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'm4v', 'wmv'] as const
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'] as const
const OFFICE_EXTENSIONS = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf'] as const
const TEXT_EXTENSIONS = ['txt', 'csv', 'json', 'xml', 'md', 'log'] as const

export function fileExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

export function previewKindOf(contentType: string, fileName: string): PreviewKind {
  const ct = (contentType || '').toLowerCase()
  const ext = fileExt(fileName)

  if (ct.includes('pdf') || ext === 'pdf') return 'pdf'
  if (ct.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
    return 'image'
  }
  if (ct.startsWith('video/') || VIDEO_EXTENSIONS.includes(ext as (typeof VIDEO_EXTENSIONS)[number])) {
    return 'video'
  }
  if (ct.startsWith('audio/') || AUDIO_EXTENSIONS.includes(ext as (typeof AUDIO_EXTENSIONS)[number])) {
    return 'audio'
  }
  if (
    ct.includes('word') ||
    ct.includes('excel') ||
    ct.includes('powerpoint') ||
    ct.includes('officedocument') ||
    ct.includes('msword') ||
    ct.includes('ms-excel') ||
    ct.includes('ms-powerpoint') ||
    OFFICE_EXTENSIONS.includes(ext as (typeof OFFICE_EXTENSIONS)[number])
  ) {
    return 'office'
  }
  if (ct.startsWith('text/') || TEXT_EXTENSIONS.includes(ext as (typeof TEXT_EXTENSIONS)[number])) {
    return 'text'
  }
  return 'other'
}

export function canInlinePreview(kind: PreviewKind): boolean {
  return kind === 'pdf' || kind === 'image' || kind === 'text' || kind === 'video' || kind === 'audio'
}
