export function IconEye({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function IconEyeOff({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

export function IconMail({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}

export function IconLock({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

export function IconUser({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

export function IconSpinner({ size = 18 }: { size?: number }) {
  return (
    <svg className="auth-btn-spinner" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export function IconShieldCheck({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 20 7v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V7l8-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m9 12 2.1 2.1L15.5 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconCloudLock({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7.5 18h9.2A3.8 3.8 0 0 0 20.4 12a4.6 4.6 0 0 0-8.7-2.1A3.7 3.7 0 0 0 4 13.2 3.4 3.4 0 0 0 7.5 18Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <rect x="10" y="14.2" width="4.2" height="3.2" rx="0.8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11.2 14.2v-1.1a0.9 0.9 0 0 1 1.8 0v1.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function IconFolderSecure({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h3.2l1.6 2H18.5A2 2 0 0 1 20.5 9.5v8A2 2 0 0 1 18.5 19.5h-13A2 2 0 0 1 3.5 17.5v-10Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 12.2v-.8a1.2 1.2 0 0 1 2.4 0v.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="11.2" y="12.2" width="4" height="3" rx="0.7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

/** Coffre documentaire : pile de fichiers + anneau de confiance */
export function AuthHeroIllustration() {
  return (
    <svg
      className="auth-hero-illustration"
      viewBox="0 0 420 280"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="authRing" x1="60" y1="30" x2="360" y2="250" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38bdf8" stopOpacity="0.55" />
          <stop offset="1" stopColor="#06b6d4" stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id="authDocA" x1="150" y1="50" x2="270" y2="230" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#e0f2fe" />
        </linearGradient>
      </defs>

      <ellipse cx="210" cy="248" rx="118" ry="14" fill="#020617" fillOpacity="0.28" />
      <circle cx="210" cy="138" r="108" stroke="url(#authRing)" strokeWidth="1.5" fill="none" />
      <circle cx="210" cy="138" r="88" stroke="#38bdf8" strokeOpacity="0.18" strokeWidth="1" fill="none" />

      <g className="auth-hero-float auth-hero-float-b">
        <rect x="168" y="72" width="118" height="148" rx="12" fill="#fff" fillOpacity="0.14" transform="rotate(-11 227 146)" />
      </g>
      <g className="auth-hero-float auth-hero-float-a">
        <rect x="178" y="68" width="118" height="148" rx="12" fill="#fff" fillOpacity="0.22" transform="rotate(8 237 142)" />
      </g>

      <g className="auth-hero-float auth-hero-float-c">
        <rect x="152" y="62" width="128" height="164" rx="14" fill="url(#authDocA)" />
        <path d="M248 62v32a12 12 0 0 0 12 12h32" fill="#7dd3fc" fillOpacity="0.45" />
        <path d="M248 62 280 106h-20a12 12 0 0 1-12-12V62Z" fill="#0ea5e9" fillOpacity="0.28" />
        <rect x="172" y="112" width="68" height="7" rx="3.5" fill="#0ea5e9" fillOpacity="0.45" />
        <rect x="172" y="130" width="88" height="5" rx="2.5" fill="#0369a1" fillOpacity="0.18" />
        <rect x="172" y="144" width="80" height="5" rx="2.5" fill="#0369a1" fillOpacity="0.18" />
        <rect x="172" y="158" width="56" height="5" rx="2.5" fill="#0369a1" fillOpacity="0.18" />
        <rect x="172" y="182" width="44" height="28" rx="8" fill="#0ea5e9" fillOpacity="0.12" />
        <rect x="184" y="194" width="20" height="12" rx="3" stroke="#0284c7" strokeWidth="1.6" />
        <path d="M188 194v-4a6 6 0 0 1 12 0v4" stroke="#0284c7" strokeWidth="1.6" strokeLinecap="round" />
      </g>

      <g className="auth-hero-float auth-hero-float-d">
        <circle cx="96" cy="168" r="32" fill="#f8fafc" />
        <path d="M96 152l13 5.5v9c0 7.4-5 13.4-13 15-8-1.6-13-7.6-13-15v-9L96 152Z" fill="#0ea5e9" />
        <path d="m90.5 168.5 4 4 8-8" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      <g className="auth-hero-float auth-hero-float-e">
        <rect x="292" y="154" width="50" height="50" rx="14" fill="#f8fafc" />
        <circle cx="317" cy="179" r="11" stroke="#06b6d4" strokeWidth="1.8" />
        <path d="M317 173v6l4 2.5" stroke="#06b6d4" strokeWidth="1.8" strokeLinecap="round" />
      </g>
    </svg>
  )
}
