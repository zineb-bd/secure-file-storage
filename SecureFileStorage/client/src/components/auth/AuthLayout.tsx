import type { ReactNode } from 'react'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { AppBrand } from '@/components/brand/AppBrand'
import { AuthHeroIllustration } from '@/components/auth/AuthIcons'
import { useI18n } from '@/i18n/I18nContext'

interface AuthLayoutProps {
  children: ReactNode
  formKey?: string
}

export function AuthLayout({ children, formKey = 'form' }: AuthLayoutProps) {
  const { t } = useI18n()

  return (
    <div className="auth-page">
      <aside className="auth-brand-panel">
        <div className="auth-brand-panel-inner">
          <div className="auth-brand-top">
            <BrandLogo size={48} />
          </div>

          <div className="auth-brand-copy">
            <h1 className="auth-brand-title">{t('app.name')}</h1>
            <p className="auth-brand-tagline">{t('app.tagline')}</p>
            <p className="auth-brand-desc">{t('auth.brandDescription')}</p>
          </div>

          <div className="auth-brand-visual">
            <AuthHeroIllustration />
          </div>

          <ul className="auth-brand-features">
            <li>{t('auth.featureSecure')}</li>
            <li>{t('auth.featureCloud')}</li>
            <li>{t('auth.featureAccess')}</li>
          </ul>
        </div>
      </aside>

      <main className="auth-form-panel">
        <div className="auth-form-mobile-brand">
          <AppBrand logoSize={36} compact />
        </div>
        <div className="auth-form-shell" key={formKey}>
          {children}
        </div>
      </main>
    </div>
  )
}
