import { TOKEN_KEY } from '@/constants'
import { apiUrl } from '@/api/baseUrl'
import type { DocumentDto } from '@/types'

function parseXhrError(xhr: XMLHttpRequest): string {
  const text = xhr.responseText?.trim()
  if (!text) return `Erreur ${xhr.status}`

  try {
    const data = JSON.parse(text) as { message?: string; title?: string; detail?: string }
    return data.message || data.title || data.detail || `Erreur ${xhr.status}`
  } catch {
    if (text.length <= 240 && !text.startsWith('<')) return text
    return `Erreur ${xhr.status}`
  }
}

export function uploadWithProgress(
  path: string,
  formData: FormData,
  method: 'POST' | 'PUT',
  onProgress: (percent: number) => void
): Promise<DocumentDto> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(method, apiUrl(path))
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)))
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status === 401) {
        reject(new Error('Session expirée. Veuillez vous reconnecter.'))
        return
      }

      const ct = xhr.responseText?.trim() ? xhr.getResponseHeader('content-type') || '' : ''
      const isJson = ct.includes('application/json') || xhr.responseText.trim().startsWith('{')

      if (isJson && xhr.responseText.trim()) {
        try {
          const data = JSON.parse(xhr.responseText) as DocumentDto & {
            message?: string
            title?: string
          }
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(data)
            return
          }
          reject(new Error(data.message || data.title || parseXhrError(xhr)))
          return
        } catch {
          reject(new Error(parseXhrError(xhr)))
          return
        }
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        reject(new Error('Réponse inattendue du serveur.'))
        return
      }

      reject(new Error(parseXhrError(xhr)))
    })

    xhr.addEventListener('error', () => reject(new Error('Échec du téléversement réseau.')))
    xhr.send(formData)
  })
}
