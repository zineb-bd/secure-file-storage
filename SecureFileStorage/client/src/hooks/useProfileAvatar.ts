import { useEffect, useState } from 'react'
import { loadProfileAvatar, PROFILE_AVATAR_CHANGED } from '@/utils/profileAvatarStorage'

export function useProfileAvatar(email: string | undefined) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() =>
    email ? loadProfileAvatar(email) : null
  )

  useEffect(() => {
    setAvatarUrl(email ? loadProfileAvatar(email) : null)
  }, [email])

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ email: string }>).detail
      if (email && detail?.email === email) {
        setAvatarUrl(loadProfileAvatar(email))
      }
    }
    window.addEventListener(PROFILE_AVATAR_CHANGED, onChange)
    return () => window.removeEventListener(PROFILE_AVATAR_CHANGED, onChange)
  }, [email])

  return avatarUrl
}
