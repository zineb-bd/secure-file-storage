import { PROFILE_AVATAR_KEY_PREFIX } from '@/constants'

const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export const PROFILE_AVATAR_CHANGED = 'profile-avatar-changed'

function storageKey(email: string) {
  return `${PROFILE_AVATAR_KEY_PREFIX}${email.toLowerCase()}`
}

export function loadProfileAvatar(email: string): string | null {
  try {
    return localStorage.getItem(storageKey(email))
  } catch {
    return null
  }
}

export function saveProfileAvatar(email: string, dataUrl: string) {
  localStorage.setItem(storageKey(email), dataUrl)
  window.dispatchEvent(new CustomEvent(PROFILE_AVATAR_CHANGED, { detail: { email: email.toLowerCase() } }))
}

export function removeProfileAvatar(email: string) {
  localStorage.removeItem(storageKey(email))
  window.dispatchEvent(new CustomEvent(PROFILE_AVATAR_CHANGED, { detail: { email: email.toLowerCase() } }))
}

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) return 'invalidType'
  if (file.size > MAX_BYTES) return 'tooLarge'
  return null
}

export function readAvatarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(file)
  })
}

/** Redimensionne l'image pour limiter la taille en localStorage. */
export function resizeAvatarDataUrl(dataUrl: string, maxSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('canvas unavailable'))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.88))
    }
    img.onerror = () => reject(new Error('image load failed'))
    img.src = dataUrl
  })
}

export async function processAvatarFile(file: File): Promise<string> {
  const dataUrl = await readAvatarFile(file)
  return resizeAvatarDataUrl(dataUrl)
}
