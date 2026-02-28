import { useEffect, useState } from 'react'

import type { SummaryStats, TrendAISummaryResponse } from '../api/client'
import { api } from '../api/client'
import AHITrendChart from '../components/AHITrendChart'
import GlossaryText from '../components/GlossaryText'
import { Card, CardContent } from '../components/ui/card'
import { IMPORT_COMPLETED_EVENT } from '../lib/aiSummaryCache'

const TREND_FLAG_COLORS = {
  good: {
    dot: 'bg-[var(--green-500)]',
    badge: 'bg-[rgba(106,161,54,0.12)] text-[var(--green-700)]',
    border: 'border-[rgba(106,161,54,0.35)]',
  },
  watch: {
    dot: 'bg-[var(--orange-500)]',
    badge: 'bg-[rgba(233,120,75,0.12)] text-[var(--orange-700)]',
    border: 'border-[rgba(233,120,75,0.35)]',
  },
  alert: {
    dot: 'bg-[var(--danger-text)]',
    badge: 'bg-[var(--danger-soft)] text-[var(--danger-text)]',
    border: 'border-[var(--accent-border)]',
  },
} as const

const TREND_DIRECTION_LABEL: Record<string, string> = {
  improving: 'Improving',
  stable: 'Stable',
  worsening: 'Worsening',
  variable: 'Variable',
}

function TrendAICard() {
  const [data, setData] = useState<TrendAISummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .getTrendAISummary()
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  const flag = (data?.flag ?? 'watch') as keyof typeof TREND_FLAG_COLORS
  const colors = TREND_FLAG_COLORS[flag] ?? TREND_FLAG_COLORS.watch
  const directionLabel = data?.trend_direction ? TREND_DIRECTION_LABEL[data.trend_direction] ?? data.trend_direction : null

  return (
    <Card className="overflow-hidden border-[var(--border)] bg-[radial-gradient(circle_at_top_left,_rgba(82,81,167,0.10),_transparent_28%),radial-gradient(circle_at_90%_18%,_rgba(106,161,54,0.10),_transparent_20%),var(--surface-strong)]">
      <CardContent className="p-6 pt-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${loading ? 'bg-[var(--accent)] animate-pulse' : colors.dot}`} />
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">AI Trend Analysis</p>
          </div>
          {!loading && data && !data.error && directionLabel && (
            <div className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${colors.badge}`}>
              {directionLabel}
            </div>
          )}
        </div>

        {loading ? (
          <div className="mt-4 space-y-2.5">
            <div className="h-5 w-3/4 animate-pulse rounded bg-[var(--accent-soft)]" />
            <div className="h-4 w-full animate-pulse rounded bg-[var(--accent-soft)]" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-[var(--accent-soft)]" />
          </div>
        ) : data?.error ? (
          <p className="mt-4 text-sm text-[var(--muted-foreground)]">{data.error}</p>
        ) : data?.headline ? (
          <>
            <p className="mt-3 text-lg font-extrabold leading-7 text-[var(--foreground)]">
              <GlossaryText text={data.headline} />
            </p>
            {data.anomalies && data.anomalies.length > 0 && (
              <ul className={`mt-4 space-y-2 border-l-2 pl-3 ${colors.border}`}>
                {data.anomalies.map((item) => (
                  <li key={item} className="text-sm leading-6 text-[var(--muted-foreground)]">
                    <GlossaryText text={item} />
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-5 text-xs text-[var(--muted-foreground)]">
              AI-generated. Not medical advice. Discuss any concerns with your doctor or sleep specialist.
            </p>
          </>
        ) : (
          <p className="mt-4 text-sm text-[var(--muted-foreground)]">AI trend analysis unavailable.</p>
        )}
      </CardContent>
    </Card>
  )
}

function ahiTone(ahi: number | null) {
  if (ahi == null) return 'text-[var(--muted-foreground)]'
  if (ahi < 5) return 'text-[var(--green-700)]'
  if (ahi < 15) return 'text-[var(--yellow-700)]'
  return 'text-[var(--orange-700)]'
}

function humanizeEventType(eventType: string) {
  return eventType
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export default function TrendsPage() {
  const [summary, setSummary] = useState<SummaryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadTrends() {
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

    void loadTrends()

    function handleImportCompleted() {
      setLoading(true)
      void loadTrends()
    }

    window.addEventListener(IMPORT_COMPLETED_EVENT, handleImportCompleted)
    return () => window.removeEventListener(IMPORT_COMPLETED_EVENT, handleImportCompleted)
  }, [])

  if (loading) {
    return <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface-strong)] p-10 text-center text-[var(--muted-foreground)]">Loading trends...</div>
  }

  if (error || !summary) {
    return <div className="rounded-[22px] border border-[var(--accent-border)] bg-[var(--danger-soft)] p-10 text-center text-[var(--danger-text)]">Error loading trends: {error ?? 'Unknown error'}</div>
  }

  const sortedBreakdown = Object.entries(summary.event_breakdown)
    .sort((left, right) => right[1] - left[1])

  return (
    <div className="space-y-6">
      <TrendAICard />

      <div className="grid gap-4 md:grid-cols-3">
        <Card id="ahi-summary" className="bg-[radial-gradient(circle_at_top_left,_rgba(82,81,167,0.08),_transparent_32%),var(--surface-strong)]">
          <CardContent className="px-6 pb-6 pt-7">
            <p className="text-sm font-bold text-[var(--foreground)]">Average AHI</p>
            <p className={`mt-2 text-4xl font-semibold ${ahiTone(summary.avg_ahi)}`}>{summary.avg_ahi?.toFixed(1) ?? '—'}</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">Average breathing events per hour.</p>
          </CardContent>
        </Card>
        <Card id="usage-trend" className="bg-[radial-gradient(circle_at_top_left,_rgba(106,161,54,0.08),_transparent_32%),var(--surface-strong)]">
          <CardContent className="px-6 pb-6 pt-7">
            <p className="text-sm font-bold text-[var(--foreground)]">Compliance</p>
            <p className="mt-2 text-4xl font-semibold text-[var(--foreground)]">{summary.compliance_pct}%</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">How consistently therapy was used.</p>
          </CardContent>
        </Card>
        <Card id="pressure-trend" className="bg-[radial-gradient(circle_at_top_left,_rgba(233,120,75,0.08),_transparent_32%),var(--surface-strong)]">
          <CardContent className="px-6 pb-6 pt-7">
            <p className="text-sm font-bold text-[var(--foreground)]">Average Pressure</p>
            <p className="mt-2 text-4xl font-semibold text-[var(--foreground)]">{summary.avg_pressure?.toFixed(1) ?? '—'}</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">Typical treatment pressure across recent nights.</p>
          </CardContent>
        </Card>
      </div>

      <div id="ahi-trend">
        <AHITrendChart trend={summary.ahi_trend} />
      </div>

      <Card id="event-breakdown">
        <CardContent className="px-6 pb-6 pt-7">
          <p className="text-sm font-bold text-[var(--foreground)]">Respiratory event breakdown</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">A simple count of the breathing-event types found across your imported nights.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {sortedBreakdown.map(([eventType, count]) => (
              <div key={eventType} className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-4">
                <p className="text-sm font-bold text-[var(--foreground)]">{humanizeEventType(eventType)}</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--foreground)]">{count}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
