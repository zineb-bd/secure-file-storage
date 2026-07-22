/** Logo SecureDocs — couleur pilotée par CSS (--brand) */
export function BrandLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" className="brand-logo">
      <rect width="48" height="48" rx="12" className="brand-logo-bg" />
      <path
        d="M24 10L34 16V26C34 32.627 29.523 37.902 24 39C18.477 37.902 14 32.627 14 26V16L24 10Z"
        fill="white"
        fillOpacity="0.95"
      />
      <path
        d="M21 25L23 27L27 23"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="brand-logo-check"
      />
    </svg>
  )
}
