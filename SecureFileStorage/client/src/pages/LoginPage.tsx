import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/i18n/I18nContext'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { IconEye, IconEyeOff, IconLock, IconMail, IconSpinner } from '@/components/auth/AuthIcons'

const REMEMBER_EMAIL_KEY = 'sfs_remember_email'

export function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const { t } = useI18n()
  const location = useLocation()
  const successMessage = (location.state as { success?: string } | null)?.success ?? ''

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(successMessage)
  const [loading, setLoading] = useState(false)
  const [touched, setTouched] = useState({ email: false, password: false })

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_EMAIL_KEY)
    if (saved) {
      setEmail(saved)
      setRememberMe(true)
    }
  }, [])

  if (isAuthenticated) return <Navigate to="/" replace />

  const emailInvalid = touched.email && email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const passwordInvalid = touched.password && password.length > 0 && password.length < 8

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setTouched({ email: true, password: true })

    if (!email.trim() || !password) {
      setError(t('login.errorRequired'))
      return
    }

    setLoading(true)
    try {
      await login(email.trim(), password)
      if (rememberMe) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim())
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.errorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout formKey="login">
      <header className="auth-form-header">
        <h2>{t('login.welcome')}</h2>
        <p className="auth-form-subtitle">{t('login.subtitle')}</p>
      </header>

      {success && <div className="msg success auth-alert" role="status">{success}</div>}
      {error && <div className="msg error auth-alert" role="alert">{error}</div>}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className={`auth-field${emailInvalid ? ' is-error' : ''}${touched.email && email && !emailInvalid ? ' is-success' : ''}`}>
          <label htmlFor="login-email">{t('login.email')}</label>
          <div className="auth-input-wrap">
            <span className="auth-input-icon" aria-hidden="true">
              <IconMail size={16} />
            </span>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((s) => ({ ...s, email: true }))}
              required
              autoComplete="username"
              placeholder={t('login.emailPlaceholder')}
              disabled={loading}
            />
          </div>
          {emailInvalid && <span className="auth-field-hint">{t('login.invalidEmail')}</span>}
        </div>

        <div className={`auth-field${passwordInvalid ? ' is-error' : ''}`}>
          <label htmlFor="login-password">{t('login.password')}</label>
          <div className="auth-input-wrap">
            <span className="auth-input-icon" aria-hidden="true">
              <IconLock size={16} />
            </span>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((s) => ({ ...s, password: true }))}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              disabled={loading}
            />
            <button
              type="button"
              className="auth-toggle-password"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
              tabIndex={-1}
            >
              {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
            </button>
          </div>
          {passwordInvalid && <span className="auth-field-hint">{t('login.passwordMin')}</span>}
        </div>

        <div className="auth-form-meta">
          <label className="auth-checkbox">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={loading}
            />
            <span>{t('login.remember')}</span>
          </label>
          <a className="auth-forgot-link" href="#" onClick={(e) => e.preventDefault()}>
            {t('login.forgot')}
          </a>
        </div>

        <button type="submit" className="btn btn-primary btn-block auth-submit" id="btn-login" disabled={loading}>
          {loading ? (
            <>
              <IconSpinner size={18} />
              <span>{t('login.submitting')}</span>
            </>
          ) : (
            t('login.submit')
          )}
        </button>
      </form>
    </AuthLayout>
  )
}
