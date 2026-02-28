import { useEffect, useState } from 'react'

import { api } from '../api/client'
import type { SessionAISummaryResponse } from '../api/client'
import GlossaryText from './GlossaryText'
import { Card, CardContent } from './ui/card'

const FLAG_COLORS = {
  good: {
    dot: 'bg-[var(--green-500)]',
    label: 'text-[var(--green-700)]',
    badge: 'bg-[rgba(106,161,54,0.12)] text-[var(--green-700)]',
  },
  watch: {
    dot: 'bg-[var(--orange-500)]',
    label: 'text-[var(--orange-700)]',
    badge: 'bg-[rgba(233,120,75,0.12)] text-[var(--orange-700)]',
  },
  alert: {
    dot: 'bg-[var(--danger-text)]',
    label: 'text-[var(--danger-text)]',
    badge: 'bg-[var(--danger-soft)] text-[var(--danger-text)]',
  },
} as const

const FLAG_LABELS = {
  good: 'Looking good',
  watch: 'Worth noting',
  alert: 'Worth reviewing',
} as const

export default function SessionAICard({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<SessionAISummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setData(null)
    api
      .getSessionAISummary(sessionId)
      .then((res) => {
        setData(res)
      })
      .finally(() => setLoading(false))
  }, [sessionId])

  const flag = (data?.flag ?? 'watch') as keyof typeof FLAG_COLORS
  const colors = FLAG_COLORS[flag] ?? FLAG_COLORS.watch

  return (
    <Card className="overflow-hidden border-[var(--border)] bg-[radial-gradient(circle_at_top_left,_rgba(82,81,167,0.10),_transparent_28%),radial-gradient(circle_at_90%_18%,_rgba(106,161,54,0.10),_transparent_20%),var(--surface-strong)]">
      <CardContent className="p-6 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${loading ? 'bg-[var(--accent)] animate-pulse' : colors.dot}`} />
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">AI Insights</p>
          </div>
          {!loading && data && !data.error && (
            <div className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${colors.badge}`}>
              {FLAG_LABELS[flag]}
            </div>
          )}
        </div>

        {/* Body */}
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
            {data.observations && data.observations.length > 0 && (
              <ul className="mt-4 space-y-2 border-l-2 border-[var(--accent-border)] pl-3">
                {data.observations.map((obs) => (
                  <li key={obs} className="text-sm leading-6 text-[var(--muted-foreground)]">
                    <GlossaryText text={obs} />
                  </li>
                ))}
              </ul>
            )}
            {data.recommendations && data.recommendations.length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Recommendations</p>
                <ul className="mt-2 space-y-2">
                  {data.recommendations.map((rec) => (
                    <li key={rec} className="flex items-start gap-2 text-sm leading-6 text-[var(--foreground)]">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                      <GlossaryText text={rec} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-5 text-xs text-[var(--muted-foreground)]">
              AI-generated. Not medical advice. Discuss any concerns with your doctor or sleep specialist.
            </p>
          </>
        ) : (
          <p className="mt-4 text-sm text-[var(--muted-foreground)]">AI summary unavailable.</p>
        )}
      </CardContent>
    </Card>
  )
}
