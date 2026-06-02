declare global {
  interface Window {
    __APP_CONFIG__?: {
      API_URL?: string
      DISABLE_USER_REGISTRATION?: boolean | string
    }
  }
}

/**
 * Helper function for normalize api url.
 */
function normalizeApiUrl(value: string | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized.replace(/\/+$/, '') : null
}

/**
 * Helper function for get api base url.
 */
export function getApiBaseUrl() {
  return (
    normalizeApiUrl(window.__APP_CONFIG__?.API_URL) ??
    normalizeApiUrl(import.meta.env.VITE_API_URL) ??
    'http://127.0.0.1:8000'
  )
}

/**
 * Helper function for parse boolean flag.
 */
function parseBooleanFlag(value: unknown) {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value !== 'string') {
    return false
  }
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

/**
 * Helper function for get is user registration disabled.
 */
export function getIsUserRegistrationDisabled() {
  return (
    parseBooleanFlag(window.__APP_CONFIG__?.DISABLE_USER_REGISTRATION) ||
    parseBooleanFlag(import.meta.env.VITE_DISABLE_USER_REGISTRATION)
  )
}

export {}
