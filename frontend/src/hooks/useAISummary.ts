import { useEffect, useState } from 'react'

import { api, type AISummaryResponse } from '../api/client'
import { useAuth } from '../context/AuthContext'
import {
  IMPORT_COMPLETED_EVENT,
  clearCachedAISummary,
  getAISummaryCacheKey,
  readCachedAISummary,
  writeCachedAISummary,
} from '../lib/aiSummaryCache'

export function useAISummary(enabled: boolean) {
  const { user } = useAuth()
  const [data, setData] = useState<AISummaryResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    function handleImportCompleted() {
      if (user) {
        clearCachedAISummary(user.user_id)
      }
      setRefreshToken((current) => current + 1)
    }

    window.addEventListener(IMPORT_COMPLETED_EVENT, handleImportCompleted)
    return () => window.removeEventListener(IMPORT_COMPLETED_EVENT, handleImportCompleted)
  }, [user])

  useEffect(() => {
    if (!enabled) {
      setData(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const cacheKey = user ? getAISummaryCacheKey(user.user_id) : null
    if (cacheKey) {
      const cached = readCachedAISummary(cacheKey)
      if (cached) {
        setData(cached)
        setIsLoading(false)
        return
      }
    }

    api.getAISummary()
      .then((response) => {
        setData(response)
        if (cacheKey) {
          writeCachedAISummary(cacheKey, response)
        }
      })
      .catch((error: unknown) =>
        setData({ error: error instanceof Error ? error.message : 'AI summary unavailable' }),
      )
      .finally(() => setIsLoading(false))
  }, [enabled, user, refreshToken])

  return { data, isLoading }
}
