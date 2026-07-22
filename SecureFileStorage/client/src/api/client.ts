type ApiOptions = RequestInit & { raw?: boolean }

let tokenGetter: () => string | null = () => null
let onUnauthorized: () => void = () => {}

export function configureApi(getToken: () => string | null, logout: () => void) {
  tokenGetter = getToken
  onUnauthorized = logout
}

export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const token = tokenGetter()
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) }
  const hasJsonBody = options.body != null && !(options.body instanceof FormData)
  if (hasJsonBody) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(path, { ...options, headers })

  if (res.status === 401 && token) {
    onUnauthorized()
    throw new Error('Session expirée. Veuillez vous reconnecter.')
  }

  if (options.raw) return res as T

  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || data.title || `Erreur ${res.status}`)
    return data as T
  }

  if (!res.ok) throw new Error(`Erreur ${res.status}`)
  return res as T
}

export async function downloadBlob(path: string, filename: string): Promise<void> {
  const res = await api<Response>(path, { raw: true })
  if (!res.ok) throw new Error('Téléchargement impossible')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'fichier'
  a.click()
  URL.revokeObjectURL(url)
}
