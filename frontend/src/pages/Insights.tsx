import { useEffect, useState } from 'react'

import type { SummaryStats } from '../api/client'
import { api } from '../api/client'
import AISummaryCard from '../components/AISummaryCard'
import { IMPORT_COMPLETED_EVENT } from '../lib/aiSummaryCache'
import { Card, CardContent } from '../components/ui/card'

export default function InsightsPage() {
  const [summary, setSummary] = useState<SummaryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadSummary() {
      try {
        const data = await api.getSummary()
        setSummary(data)
        setError(null)
      } catch (err) {
        setError(String(err))
      } finally {
        setLoading(false)
      }
    }

    void loadSummary()

    function handleImportCompleted() {
      setLoading(true)
      void loadSummary()
    }

    window.addEventListener(IMPORT_COMPLETED_EVENT, handleImportCompleted)
    return () => window.removeEventListener(IMPORT_COMPLETED_EVENT, handleImportCompleted)
  }, [])

  if (loading) {
    return <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface-strong)] p-10 text-center text-[var(--muted-foreground)]">Loading insights...</div>
  }

  if (error || !summary) {
    return <div className="rounded-[22px] border border-[var(--accent-border)] bg-[var(--danger-soft)] p-10 text-center text-[var(--danger-text)]">Error loading insights: {error ?? 'Unknown error'}</div>
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-[radial-gradient(circle_at_top_left,_rgba(82,81,167,0.08),_transparent_32%),var(--surface-strong)]">
          <CardContent className="px-6 pb-6 pt-7">
            <p className="text-sm font-bold text-[var(--foreground)]">Nights analysed</p>
            <p className="mt-2 text-4xl font-semibold text-[var(--foreground)]">{summary.nights_with_data}</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">Imported nights available for AI review.</p>
          </CardContent>
        </Card>
        <Card className="bg-[radial-gradient(circle_at_top_left,_rgba(106,161,54,0.08),_transparent_32%),var(--surface-strong)]">
          <CardContent className="px-6 pb-6 pt-7">
            <p className="text-sm font-bold text-[var(--foreground)]">AI summary status</p>
            <p className="mt-2 text-4xl font-semibold text-[var(--foreground)]">{summary.nights_with_data > 0 ? 'Ready' : 'Waiting'}</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">Insights run once imported therapy data is available.</p>
          </CardContent>
        </Card>
      </div>

      <AISummaryCard enabled={summary.nights_with_data > 0} />
    </div>
  )
}
