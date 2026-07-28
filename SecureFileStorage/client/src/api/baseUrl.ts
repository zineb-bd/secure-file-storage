/** Base URL de l'API (vide en local → proxy Vite vers localhost:5001). */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined
  return (raw || '').replace(/\/$/, '')
}

/** Préfixe un chemin relatif (`/api/...`, `/health`) avec la base API. */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const base = getApiBaseUrl()
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalized}`
}
