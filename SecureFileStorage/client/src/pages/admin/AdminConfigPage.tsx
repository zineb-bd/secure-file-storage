import { useState } from 'react'
import { SettingsView } from '@/components/settings/SettingsView'
import { PageHeader } from '@/components/layout/PageHeader'
import { useI18n } from '@/i18n/I18nContext'

export function AdminConfigPage() {
  const { t } = useI18n()
  const [error, setError] = useState('')

  return (
    <section className="page settings-page" id="page-admin-config">
      <PageHeader title={t('page.adminConfig.title')} subtitle={t('page.adminConfig.subtitle')} />
      {error && <div className="msg error">{error}</div>}
      <SettingsView onError={setError} />
    </section>
  )
}
