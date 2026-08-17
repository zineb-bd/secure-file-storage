import { useLayoutEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export const PAGE_HERO_ACTIONS_ID = 'page-hero-actions'

export function PageHeroSlot({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    setTarget(document.getElementById(PAGE_HERO_ACTIONS_ID))
  }, [])

  if (!target) return null
  return createPortal(children, target)
}
