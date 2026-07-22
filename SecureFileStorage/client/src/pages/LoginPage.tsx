import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/i18n/I18nContext'
import { BrandLogo } from '@/components/brand/BrandLogo'

export function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const { t } = useI18n()
  const [email, setEmail] = useState('admin@entreprise.local')
  const [password, setPassword] = useState('Admin123!')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) return <Navigate to="/" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page" id="login-page">
      <div className="login-card">
        <div className="login-logo">
          <BrandLogo size={48} />
          <div className="login-logo-text">
            SecureDocs Entreprise
            <span>{t('app.tagline')}</span>
          </div>
        </div>
        <h2>{t('login.title')}</h2>
        <p className="subtitle">{t('login.subtitle')}</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="login-email">{t('login.email')}</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            placeholder="nom@entreprise.local"
          />
          <label htmlFor="login-password">{t('login.password')}</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••"
          />
          {error && <div className="msg error">{error}</div>}
          <button type="submit" className="btn btn-block" id="btn-login" disabled={loading}>
            {loading ? '…' : t('login.submit')}
          </button>
        </form>
        <a className="forgot-link" href="#" onClick={(e) => e.preventDefault()}>
          Mot de passe oublié ?
        </a>
        <div className="login-note">{t('login.note')}</div>
      </div>
    </div>
  )
}
