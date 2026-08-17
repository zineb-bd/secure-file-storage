/** Base URL de l'API (vide en local → proxy Vite vers localhost:5001). */
const DEFAULT_PROD_API = 'https://securedocs-api-h0oi.onrender.com'
const DEFAULT_LOCAL_API = 'http://localhost:5001'

export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined
  if (raw?.trim()) return raw.trim().replace(/\/$/, '')

  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (/vercel\.app$/i.test(host) || /securedocs/i.test(host)) {
      return DEFAULT_PROD_API
    }
  }

  return ''
}

/** Préfixe un chemin relatif (`/api/...`, `/health`) avec la base API. */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const base = getApiBaseUrl()
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalized}`
}

/**
 * URL publique du lien de partage (page API share.html).
 * Accessible sans compte, depuis n'importe quel appareil — pas localhost du navigateur.
 */
export function getPublicShareUrl(token: string): string {
  const api =
    getApiBaseUrl() ||
    (import.meta.env.DEV ? DEFAULT_LOCAL_API : DEFAULT_PROD_API)
  return `${api.replace(/\/$/, '')}/share.html?token=${encodeURIComponent(token)}`
}
