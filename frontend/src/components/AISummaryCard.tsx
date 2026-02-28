import { useState } from 'react'

import type { AISummaryResponse } from '../api/client'
import { useAISummary } from '../hooks/useAISummary'
import GlossaryText from './GlossaryText'
import { Card, CardContent } from './ui/card'

export default function AISummaryCard({ enabled }: { enabled: boolean }) {
  const { data, isLoading } = useAISummary(enabled)
  return <AIInsightsCard enabled={enabled} data={data} isLoading={isLoading} />
}

export function AIInsightsCard({
  enabled,
  data,
  isLoading,
}: {
  enabled: boolean
  data: AISummaryResponse | null
  isLoading: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="overflow-hidden border-[var(--border)] bg-[radial-gradient(circle_at_top_left,_rgba(82,81,167,0.10),_transparent_28%),radial-gradient(circle_at_90%_18%,_rgba(106,161,54,0.10),_transparent_20%),var(--surface-strong)]">
      <CardContent className="p-6 pt-6">
        {/* Header row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--accent)]" />
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">AI Insights</p>
          </div>
          <div className="shrink-0 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[var(--accent)]">
            Last 30 days
          </div>
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="mt-4 space-y-2.5">
            <div className="h-5 w-3/4 animate-pulse rounded bg-[var(--accent-soft)]" />
            <div className="h-4 w-full animate-pulse rounded bg-[var(--accent-soft)]" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-[var(--accent-soft)]" />
          </div>
        ) : !enabled ? (
          <p className="mt-4 text-sm text-[var(--muted-foreground)]">
            AI summary will be available after you import session data.
          </p>
        ) : data?.insights ? (
          <>
            {/* Main insight headline */}
            <p className="mt-3 text-lg font-extrabold leading-7 text-[var(--foreground)]">
              <GlossaryText text={data.insights} />
            </p>

            {/* Three-column breakdown — always shown */}
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <InsightColumn
                title="Going well"
                items={data.going_well ?? []}
                accentClass="border-[var(--accent-border)]"
                labelClass="text-[var(--accent)]"
              />
              <InsightColumn
                title="Watch"
                items={data.whats_not ?? []}
                accentClass="border-[rgba(233,120,75,0.35)]"
                labelClass="text-[var(--orange-700)]"
              />
              <InsightColumn
                title="To discuss"
                items={data.recommended_changes ?? []}
                accentClass="border-[rgba(106,161,54,0.35)]"
                labelClass="text-[var(--green-700)]"
              />
            </div>

            {/* Disclaimer — collapsed by default */}
            <div className="mt-5 border-t border-[var(--border)] pt-4">
              <button
                type="button"
                className="text-xs font-semibold text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? 'Hide disclaimer ↑' : 'Important: AI-generated, not medical advice ↓'}
              </button>
              {expanded && (
                <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
                  This summary is AI-generated and is not medical advice. Do not use it on its own to diagnose, treat, or change therapy settings. Review any important changes with your doctor, sleep specialist, or GP.
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-[var(--muted-foreground)]">
            {data?.error ?? 'AI summary unavailable.'}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function InsightColumn({
  title,
  items,
  accentClass,
  labelClass,
}: {
  title: string
  items: string[]
  accentClass: string
  labelClass: string
}) {
  return (
    <div className={`border-l-2 pl-3 ${accentClass}`}>
      <p className={`text-xs font-bold uppercase tracking-[0.14em] ${labelClass}`}>{title}</p>
      <ul className="mt-2 space-y-1.5 text-sm leading-6 text-[var(--muted-foreground)]">
        {items.length > 0
          ? items.map((item) => (
              <li key={item}>
                <GlossaryText text={item} />
              </li>
            ))
          : <li>No specific points available.</li>}
      </ul>
    </div>
  )
}
