import { useState } from 'react'
import { SettingsView } from '@/components/settings/SettingsView'
import { useI18n } from '@/i18n/I18nContext'

export function AdminConfigPage() {
  const { t } = useI18n()
  const [error, setError] = useState('')

  return (
    <section className="page settings-page files-like-page" id="page-admin-config">
      {error && (
        <div className="msg error">
          {error}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setError('')}>
            {t('btn.close')}
          </button>
        </div>
      )}
      <SettingsView onError={setError} />
    </section>
  )
}
