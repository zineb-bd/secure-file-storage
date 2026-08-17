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

/** Composition visuelle documents + sécurité + cloud */
export function AuthHeroIllustration() {
  return (
    <svg
      className="auth-hero-illustration"
      viewBox="0 0 440 340"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="authHeroGlow" x1="80" y1="40" x2="360" y2="300" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.14" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="authDocFill" x1="140" y1="70" x2="280" y2="260" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.78" />
        </linearGradient>
      </defs>

      <ellipse cx="220" cy="300" rx="150" ry="18" fill="#000" fillOpacity="0.12" />
      <circle cx="220" cy="170" r="128" fill="url(#authHeroGlow)" />

      {/* Cloud */}
      <g className="auth-hero-float auth-hero-float-a" opacity="0.9">
        <path
          d="M318 92c0-18.778-15.222-34-34-34-12.55 0-23.58 6.79-29.55 17.02A28.98 28.98 0 0 0 232 68c-16.016 0-29 12.984-29 29 0 1.12.07 2.22.2 3.3A24.98 24.98 0 0 0 186 124c0 13.807 11.193 25 25 25h98c13.807 0 25-11.193 25-25 0-11.95-8.38-21.95-19.6-24.5.4-2.45.6-4.95.6-7.5z"
          fill="#ffffff"
          fillOpacity="0.22"
        />
      </g>

      {/* Document back */}
      <g className="auth-hero-float auth-hero-float-b">
        <rect x="168" y="88" width="132" height="168" rx="14" fill="#ffffff" fillOpacity="0.18" transform="rotate(-8 234 172)" />
      </g>

      {/* Main document */}
      <g className="auth-hero-float auth-hero-float-c">
        <rect x="156" y="78" width="140" height="184" rx="14" fill="url(#authDocFill)" />
        <path d="M268 78v36a12 12 0 0 0 12 12h36" fill="#ffffff" fillOpacity="0.55" />
        <path d="M268 78l48 48h-36a12 12 0 0 1-12-12V78z" fill="#0ea5e9" fillOpacity="0.2" />
        <rect x="178" y="120" width="72" height="8" rx="4" fill="#0ea5e9" fillOpacity="0.35" />
        <rect x="178" y="140" width="96" height="6" rx="3" fill="#0ea5e9" fillOpacity="0.18" />
        <rect x="178" y="156" width="88" height="6" rx="3" fill="#0ea5e9" fillOpacity="0.18" />
        <rect x="178" y="172" width="64" height="6" rx="3" fill="#0ea5e9" fillOpacity="0.18" />
        <rect x="178" y="198" width="40" height="40" rx="10" fill="#0ea5e9" fillOpacity="0.12" />
        <path
          d="M198 212v-4a8 8 0 0 1 16 0v4"
          stroke="#0ea5e9"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <rect x="192" y="212" width="28" height="18" rx="4" stroke="#0ea5e9" strokeWidth="2" />
      </g>

      {/* Shield badge */}
      <g className="auth-hero-float auth-hero-float-d">
        <circle cx="118" cy="210" r="36" fill="#ffffff" fillOpacity="0.95" />
        <path
          d="M118 192l14 6v10c0 8.5-5.7 15.3-14 17-8.3-1.7-14-8.5-14-17v-10l14-6z"
          fill="#0ea5e9"
          fillOpacity="0.9"
        />
        <path d="M112 210l4 4 8-8" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Floating lock chip */}
      <g className="auth-hero-float auth-hero-float-e">
        <rect x="300" y="196" width="56" height="56" rx="14" fill="#ffffff" fillOpacity="0.95" />
        <rect x="316" y="218" width="24" height="18" rx="4" stroke="#06b6d4" strokeWidth="2" />
        <path d="M322 218v-6a6 6 0 0 1 12 0v6" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  )
}
