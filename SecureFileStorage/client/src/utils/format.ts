export function fmtDate(d: string | null | undefined, locale = 'fr-FR'): string {
  if (!d) return '—'
  return new Date(d).toLocaleString(locale)
}

export function fmtSize(bytes: number | null | undefined): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} Ko`
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(2)} Mo`
  if (bytes < 1099511627776) return `${(bytes / 1073741824).toFixed(2)} Go`
  return `${(bytes / 1099511627776).toFixed(2)} To`
}

export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== '' && v != null && v !== undefined) q.set(k, String(v))
  })
  const s = q.toString()
  return s ? `?${s}` : ''
}
