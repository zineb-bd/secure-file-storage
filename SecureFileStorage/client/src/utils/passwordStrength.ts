export type PasswordStrength = 'empty' | 'weak' | 'fair' | 'good' | 'strong'

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return 'empty'
  if (password.length < 8) return 'weak'

  let score = 0
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1

  if (score >= 4) return 'strong'
  if (score >= 3) return 'good'
  return 'fair'
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}
