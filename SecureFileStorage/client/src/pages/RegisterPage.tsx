import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/i18n/I18nContext'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { IconEye, IconEyeOff, IconLock, IconMail, IconSpinner, IconUser } from '@/components/auth/AuthIcons'
import { getPasswordStrength, isValidEmail } from '@/utils/passwordStrength'

export function RegisterPage() {
  const { isAuthenticated } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [touched, setTouched] = useState({
    firstName: false,
    lastName: false,
    email: false,
    password: false,
    confirmPassword: false,
  })

  const strength = useMemo(() => getPasswordStrength(password), [password])

  if (isAuthenticated) return <Navigate to="/" replace />

  const emailInvalid = touched.email && email.trim() !== '' && !isValidEmail(email)
  const passwordTooShort = touched.password && password.length > 0 && password.length < 8
  const passwordsMismatch =
    touched.confirmPassword && confirmPassword.length > 0 && password !== confirmPassword
  const firstNameInvalid = touched.firstName && firstName.trim() === ''
  const lastNameInvalid = touched.lastName && lastName.trim() === ''

  const strengthLabel =
    strength === 'empty'
      ? ''
      : strength === 'weak'
        ? t('register.strengthWeak')
        : strength === 'fair'
          ? t('register.strengthFair')
          : strength === 'good'
            ? t('register.strengthGood')
            : t('register.strengthStrong')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setTouched({
      firstName: true,
      lastName: true,
      email: true,
      password: true,
      confirmPassword: true,
    })

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password || !confirmPassword) {
      setError(t('register.errorRequired'))
      return
    }
    if (!isValidEmail(email)) {
      setError(t('register.invalidEmail'))
      return
    }
    if (password.length < 8) {
      setError(t('register.passwordMin'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('register.passwordMismatch'))
      return
    }
    if (!acceptTerms) {
      setError(t('register.termsRequired'))
      return
    }

    setLoading(true)
    try {
      await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        }),
      })
      navigate('/login', {
        replace: true,
        state: { success: t('register.success') },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('register.errorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout formKey="register">
      <header className="auth-form-header">
        <h2>{t('register.title')}</h2>
        <p className="auth-form-subtitle">{t('register.subtitle')}</p>
      </header>

      {error && <div className="msg error auth-alert" role="alert">{error}</div>}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="auth-form-row">
          <div className={`auth-field${firstNameInvalid ? ' is-error' : ''}${touched.firstName && firstName.trim() ? ' is-success' : ''}`}>
            <label htmlFor="register-first-name">{t('register.firstName')}</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon" aria-hidden="true">
                <IconUser size={16} />
              </span>
              <input
                id="register-first-name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                onBlur={() => setTouched((s) => ({ ...s, firstName: true }))}
                required
                autoComplete="given-name"
                placeholder={t('register.firstNamePlaceholder')}
                disabled={loading}
              />
            </div>
          </div>

          <div className={`auth-field${lastNameInvalid ? ' is-error' : ''}${touched.lastName && lastName.trim() ? ' is-success' : ''}`}>
            <label htmlFor="register-last-name">{t('register.lastName')}</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon" aria-hidden="true">
                <IconUser size={16} />
              </span>
              <input
                id="register-last-name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                onBlur={() => setTouched((s) => ({ ...s, lastName: true }))}
                required
                autoComplete="family-name"
                placeholder={t('register.lastNamePlaceholder')}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <div className={`auth-field${emailInvalid ? ' is-error' : ''}${touched.email && email && !emailInvalid ? ' is-success' : ''}`}>
          <label htmlFor="register-email">{t('register.email')}</label>
          <div className="auth-input-wrap">
            <span className="auth-input-icon" aria-hidden="true">
              <IconMail size={16} />
            </span>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((s) => ({ ...s, email: true }))}
              required
              autoComplete="email"
              placeholder={t('register.emailPlaceholder')}
              disabled={loading}
            />
          </div>
          {emailInvalid && <span className="auth-field-hint">{t('register.invalidEmail')}</span>}
        </div>

        <div className={`auth-field${passwordTooShort ? ' is-error' : ''}${touched.password && password.length >= 8 ? ' is-success' : ''}`}>
          <label htmlFor="register-password">{t('register.password')}</label>
          <div className="auth-input-wrap">
            <span className="auth-input-icon" aria-hidden="true">
              <IconLock size={16} />
            </span>
            <input
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((s) => ({ ...s, password: true }))}
              required
              autoComplete="new-password"
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
          {password && (
            <div className={`auth-password-strength strength-${strength}`} aria-live="polite">
              <div className="auth-password-strength-bars" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </div>
              <span className="auth-password-strength-label">{strengthLabel}</span>
            </div>
          )}
          {passwordTooShort && <span className="auth-field-hint">{t('register.passwordMin')}</span>}
        </div>

        <div className={`auth-field${passwordsMismatch ? ' is-error' : ''}${touched.confirmPassword && confirmPassword && !passwordsMismatch ? ' is-success' : ''}`}>
          <label htmlFor="register-confirm-password">{t('register.confirmPassword')}</label>
          <div className="auth-input-wrap">
            <span className="auth-input-icon" aria-hidden="true">
              <IconLock size={16} />
            </span>
            <input
              id="register-confirm-password"
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={() => setTouched((s) => ({ ...s, confirmPassword: true }))}
              required
              autoComplete="new-password"
              placeholder="••••••••"
              disabled={loading}
            />
            <button
              type="button"
              className="auth-toggle-password"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? t('login.hidePassword') : t('login.showPassword')}
              tabIndex={-1}
            >
              {showConfirm ? <IconEyeOff size={16} /> : <IconEye size={16} />}
            </button>
          </div>
          {passwordsMismatch && <span className="auth-field-hint">{t('register.passwordMismatch')}</span>}
        </div>

        <label className="auth-checkbox auth-terms">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            disabled={loading}
          />
          <span>{t('register.terms')}</span>
        </label>

        <button
          type="submit"
          className="btn btn-primary btn-block auth-submit"
          id="btn-register"
          disabled={loading || !acceptTerms}
        >
          {loading ? (
            <>
              <IconSpinner size={18} />
              <span>{t('register.submitting')}</span>
            </>
          ) : (
            t('register.submit')
          )}
        </button>
      </form>

      <p className="auth-switch">
        {t('register.hasAccount')}{' '}
        <Link to="/login">{t('register.signIn')}</Link>
      </p>
    </AuthLayout>
  )
}
