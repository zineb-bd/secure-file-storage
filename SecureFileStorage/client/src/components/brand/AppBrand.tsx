import { useI18n } from '@/i18n/I18nContext'
import { BrandLogo } from '@/components/brand/BrandLogo'

interface AppBrandProps {
  /** Sidebar réduit : logo seul + tooltip */
  collapsed?: boolean
  /** Topbar mobile : logo + nom sans sous-titre */
  compact?: boolean
  logoSize?: number
  className?: string
}

export function AppBrand({ collapsed = false, compact = false, logoSize, className = '' }: AppBrandProps) {
  const { t } = useI18n()
  const size = logoSize ?? (collapsed ? 32 : compact ? 28 : 36)
  const showText = !collapsed
  const showSubtitle = showText && !compact

  return (
    <div
      className={`app-brand${collapsed ? ' app-brand-collapsed' : ''}${compact ? ' app-brand-compact' : ''}${className ? ` ${className}` : ''}`}
      title={collapsed ? t('app.name') : undefined}
    >
      <BrandLogo size={size} />
      {showText && (
        <div className="app-brand-text">
          <span className="app-brand-name">{t('app.name')}</span>
          {showSubtitle && <span className="app-brand-tagline">{t('app.tagline')}</span>}
        </div>
      )}
      {collapsed && <span className="app-brand-tooltip" role="tooltip">{t('app.name')}</span>}
    </div>
  )
}
