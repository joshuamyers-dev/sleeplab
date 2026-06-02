import { useEffect, useState } from 'react'

import { api, type AISummaryResponse } from '../api/client'
import { IMPORT_COMPLETED_EVENT } from '../lib/aiSummaryCache'

/**
 * Custom hook for managing use a i summary.
 *
 * @returns Object containing hook state and controls.
 */
export function useAISummary(enabled: boolean) {
  const [data, setData] = useState<AISummaryResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [requestState, setRequestState] = useState({ token: 0, force: false })

  useEffect(() => {
    function handleImportCompleted() {
      setRequestState((current) => ({ token: current.token + 1, force: false }))
    }

    window.addEventListener(IMPORT_COMPLETED_EVENT, handleImportCompleted)
    return () => window.removeEventListener(IMPORT_COMPLETED_EVENT, handleImportCompleted)
  }, [])

  useEffect(() => {
    if (!enabled) {
      setData(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    api.getAISummary(30, requestState.force)
      .then((response) => {
        setData(response)
      })
      .catch((error: unknown) =>
        setData({ error: error instanceof Error ? error.message : 'AI summary unavailable' }),
      )
      .finally(() => setIsLoading(false))
  }, [enabled, requestState])

  return {
    data,
    isLoading,
    refresh: () => setRequestState((current) => ({ token: current.token + 1, force: true })),
  }
}
