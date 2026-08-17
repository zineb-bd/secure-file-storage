import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getPublicShareUrl } from '@/api/baseUrl'
import { useI18n } from '@/i18n/I18nContext'

/**
 * Redirige vers la page publique hébergée par l'API (share.html).
 * Ainsi le lien fonctionne sans compte et hors environnement local.
 */
export function ShareLinkPage() {
  const { t } = useI18n()
  const [params] = useSearchParams()
  const token = params.get('token')?.trim() || ''

  useEffect(() => {
    if (!token) return
    window.location.replace(getPublicShareUrl(token))
  }, [token])

  if (!token) {
    return (
      <div className="share-public-page">
        <main className="share-public-main">
          <div className="share-public-card center">
            <h1>{t('shareLink.errorTitle')}</h1>
            <p>{t('shareLink.missingToken')}</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="share-public-page">
      <main className="share-public-main">
        <div className="share-public-card center">
          <div className="spinner" />
          <p>{t('shareLink.redirecting')}</p>
        </div>
      </main>
    </div>
  )
}
