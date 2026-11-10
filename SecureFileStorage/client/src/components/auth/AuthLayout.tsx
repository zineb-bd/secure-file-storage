import type { ReactNode } from 'react'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { AppBrand } from '@/components/brand/AppBrand'
import {
  AuthHeroIllustration,
  IconCloudLock,
  IconFolderSecure,
  IconShieldCheck,
} from '@/components/auth/AuthIcons'
import { useI18n } from '@/i18n/I18nContext'

interface AuthLayoutProps {
  children: ReactNode
  formKey?: string
}

export function AuthLayout({ children, formKey = 'form' }: AuthLayoutProps) {
  const { t, lang, setLang } = useI18n()

  return (
    <div className="auth-page">
      <aside className="auth-brand-panel">
        <div className="auth-brand-grid" aria-hidden="true" />
        <div className="auth-brand-orb auth-brand-orb-a" aria-hidden="true" />
        <div className="auth-brand-orb auth-brand-orb-b" aria-hidden="true" />

        <div className="auth-brand-panel-inner">
          <div className="auth-brand-top">
            <BrandLogo size={40} />
            <span className="auth-brand-mark">{t('app.name')}</span>
          </div>

          <div className="auth-brand-copy">
            <p className="auth-brand-kicker">{t('app.tagline')}</p>
            <h1 className="auth-brand-title">{t('auth.headline')}</h1>
            <p className="auth-brand-desc">{t('auth.brandDescription')}</p>
          </div>

          <div className="auth-brand-visual">
            <AuthHeroIllustration />
          </div>

          <ul className="auth-brand-features">
            <li>
              <span className="auth-feature-icon" aria-hidden="true">
                <IconShieldCheck size={18} />
              </span>
              <span>{t('auth.featureSecure')}</span>
            </li>
            <li>
              <span className="auth-feature-icon" aria-hidden="true">
                <IconCloudLock size={18} />
              </span>
              <span>{t('auth.featureCloud')}</span>
            </li>
            <li>
              <span className="auth-feature-icon" aria-hidden="true">
                <IconFolderSecure size={18} />
              </span>
              <span>{t('auth.featureAccess')}</span>
            </li>
          </ul>
        </div>
      </aside>

      <main className="auth-form-panel">
        <div className="auth-form-toolbar">
          <div className="auth-form-mobile-brand">
            <AppBrand logoSize={32} compact />
          </div>
          <div className="auth-lang" role="group" aria-label={t('login.language')}>
            <button
              type="button"
              className={lang === 'fr' ? 'is-active' : ''}
              onClick={() => setLang('fr')}
            >
              FR
            </button>
            <button
              type="button"
              className={lang === 'en' ? 'is-active' : ''}
              onClick={() => setLang('en')}
            >
              EN
            </button>
          </div>
        </div>

        <div className="auth-form-shell" key={formKey}>
          {children}
        </div>

        <p className="auth-trust">{t('auth.trustLine')}</p>
      </main>
    </div>
  )
}
