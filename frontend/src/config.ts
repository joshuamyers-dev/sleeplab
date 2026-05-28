declare global {
  interface Window {
    __APP_CONFIG__?: {
      API_URL?: string
      DISABLE_USER_REGISTRATION?: boolean | string
    }
  }
}

function normalizeApiUrl(value: string | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized.replace(/\/+$/, '') : null
}

export function getApiBaseUrl() {
  return (
    normalizeApiUrl(window.__APP_CONFIG__?.API_URL) ??
    normalizeApiUrl(import.meta.env.VITE_API_URL) ??
    'http://127.0.0.1:8000'
  )
}

function parseBooleanFlag(value: unknown) {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value !== 'string') {
    return false
  }
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

export function getIsUserRegistrationDisabled() {
  return (
    parseBooleanFlag(window.__APP_CONFIG__?.DISABLE_USER_REGISTRATION) ||
    parseBooleanFlag(import.meta.env.VITE_DISABLE_USER_REGISTRATION)
  )
}

export {}
