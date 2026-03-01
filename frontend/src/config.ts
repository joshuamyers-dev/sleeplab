declare global {
  interface Window {
    __APP_CONFIG__?: {
      API_URL?: string
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

export {}
