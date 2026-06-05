import { useEffect, useState } from 'react'

import type { SummaryStats, TagInsight } from '../api/client'
import { api } from '../api/client'
import AISummaryCard from '../components/AISummaryCard'
import { IMPORT_COMPLETED_EVENT } from '../lib/aiSummaryCache'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

function formatAhi(value: number | null) {
  return value == null ? 'N/A' : value.toFixed(1)
}

/**
 * React component or element to render the insights page.
 *
 * @returns The rendered React element.
 */
export default function InsightsPage() {
  const [summary, setSummary] = useState<SummaryStats | null>(null)
  const [tagInsights, setTagInsights] = useState<TagInsight[]>([])
  const [aiConfigured, setAiConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadSummary() {
      try {
        const [data, settings, tags] = await Promise.all([
          api.getSummary(),
          api.getImportSettings(),
          api.getTagInsights(),
        ])
        setSummary(data)
        setTagInsights(tags)
        setAiConfigured(settings.llm_configured)
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
        {aiConfigured ? <Card className="bg-[radial-gradient(circle_at_top_left,_rgba(106,161,54,0.08),_transparent_32%),var(--surface-strong)]">
          <CardContent className="px-6 pb-6 pt-7">
            <p className="text-sm font-bold text-[var(--foreground)]">AI summary status</p>
            <p className="mt-2 text-4xl font-semibold text-[var(--foreground)]">{summary.nights_with_data > 0 ? 'Ready' : 'Waiting'}</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">Insights run once imported therapy data is available.</p>
          </CardContent>
        </Card> : null}
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Tag Insights</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Average AHI by tags used on at least two recent nights.</p>
        </div>
        {tagInsights.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tagInsights.map((insight) => {
              const lowerOrEqual = insight.delta_ahi == null || insight.delta_ahi <= 0
              return (
                <Card key={insight.tag}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between gap-3 text-base">
                      <span>{insight.tag}</span>
                      <span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs font-bold text-[var(--muted-foreground)]">
                        {insight.night_count} nights
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Tagged AHI</p>
                        <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">{formatAhi(insight.avg_ahi)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Baseline</p>
                        <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">{formatAhi(insight.baseline_avg_ahi)}</p>
                      </div>
                    </div>
                    <div className={`rounded-[12px] px-3 py-2 text-sm font-bold ${
                      lowerOrEqual
                        ? 'bg-[rgba(106,161,54,0.12)] text-[var(--green-700)]'
                        : 'bg-[var(--danger-soft)] text-[var(--danger-text)]'
                    }`}>
                      {lowerOrEqual ? '↓' : '↑'} {formatAhi(insight.delta_ahi == null ? null : Math.abs(insight.delta_ahi))} vs baseline
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="px-6 py-5 text-sm text-[var(--muted-foreground)]">
              Tag at least two nights from a session detail page to see tag insights.
            </CardContent>
          </Card>
        )}
      </section>

      <AISummaryCard enabled={summary.nights_with_data > 0} />
    </div>
  )
}
