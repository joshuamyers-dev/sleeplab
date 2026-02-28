import type { AISummaryResponse } from '../api/client'

const AI_SUMMARY_CACHE_TTL_MS = 1000 * 60 * 15

export const IMPORT_SYNC_STORAGE_KEY = 'cpap-import-sync-active'
export const IMPORT_COMPLETED_EVENT = 'cpap-import-complete'

export function getAISummaryCacheKey(userId: string) {
  return `cpap-ai-summary:${userId}`
}

export function readCachedAISummary(cacheKey: string): AISummaryResponse | null {
  const raw = window.sessionStorage.getItem(cacheKey)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as { timestamp: number; data: AISummaryResponse }
    if (Date.now() - parsed.timestamp > AI_SUMMARY_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(cacheKey)
      return null
    }
    return parsed.data
  } catch {
    window.sessionStorage.removeItem(cacheKey)
    return null
  }
}

export function writeCachedAISummary(cacheKey: string, data: AISummaryResponse) {
  window.sessionStorage.setItem(
    cacheKey,
    JSON.stringify({
      timestamp: Date.now(),
      data,
    }),
  )
}

export function clearCachedAISummary(userId: string) {
  window.sessionStorage.removeItem(getAISummaryCacheKey(userId))
}

export function notifyImportCompleted() {
  window.sessionStorage.setItem(IMPORT_COMPLETED_EVENT, String(Date.now()))
  window.dispatchEvent(new Event(IMPORT_COMPLETED_EVENT))
}
