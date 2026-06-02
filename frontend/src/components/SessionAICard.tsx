import { useEffect, useState } from 'react'

import { api } from '../api/client'
import type { SessionAISummaryResponse } from '../api/client'
import GlossaryText from './GlossaryText'
import { Button } from './ui/button'
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

/**
 * React component or element to render the session a i card.
 *
 * @returns The rendered React element.
 */
export default function SessionAICard({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<SessionAISummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null)
  const [refreshState, setRefreshState] = useState({ token: 0, force: false })
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    api.getImportSettings()
      .then((settings) => setAiConfigured(settings.llm_configured))
      .catch(() => setAiConfigured(false))
  }, [])

  useEffect(() => {
    if (aiConfigured !== true) {
      return
    }
    setLoading(true)
    setData(null)
    setExpanded(false)
    api
      .getSessionAISummary(sessionId, refreshState.force)
      .then((res) => {
        setData(res)
      })
      .finally(() => setLoading(false))
  }, [sessionId, aiConfigured, refreshState])

  if (aiConfigured !== true) {
    return null
  }

  const flag = (data?.flag ?? 'watch') as keyof typeof FLAG_COLORS
  const colors = FLAG_COLORS[flag] ?? FLAG_COLORS.watch
  const observations = data?.high_confidence_observations ?? data?.observations ?? []
  const reviewItems = data?.things_to_review ?? data?.recommendations ?? []
  const possibleCount = data?.possible_patterns?.length ?? 0
  const uncertainCount = data?.missing_or_uncertain?.length ?? 0

  return (
    <Card className="overflow-hidden border-[var(--border)] bg-[radial-gradient(circle_at_top_left,_rgba(82,81,167,0.10),_transparent_28%),radial-gradient(circle_at_90%_18%,_rgba(106,161,54,0.10),_transparent_20%),var(--surface-strong)]">
      <CardContent className="p-6 pt-6">
        <div className="flex min-h-10 flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${loading ? 'bg-[var(--accent)] animate-pulse' : colors.dot}`} />
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">AI Insights</p>
          </div>
          {!loading && data && !data.error && (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <div className={`rounded-full px-3 py-1 text-xs font-bold ${colors.badge}`}>
                {data.cached ? 'Cached' : FLAG_LABELS[flag]}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => setExpanded((current) => !current)}
              >
                {expanded ? 'Hide details' : 'Show details'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => setRefreshState((current) => ({ token: current.token + 1, force: true }))}
              >
                Regenerate
              </Button>
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
            {data.therapy_quality && (
              <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
                <GlossaryText text={data.therapy_quality} />
              </p>
            )}

            {!expanded && observations.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[var(--muted-foreground)]">
                  {observations.length} observations
                </span>
                {possibleCount > 0 && (
                  <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[var(--muted-foreground)]">
                    {possibleCount} possible patterns
                  </span>
                )}
                {reviewItems.length > 0 && (
                  <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[var(--muted-foreground)]">
                    {reviewItems.length} review items
                  </span>
                )}
                {uncertainCount > 0 && (
                  <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[var(--muted-foreground)]">
                    {uncertainCount} uncertainties
                  </span>
                )}
              </div>
            )}

            {expanded && (
              <>
                {observations.length > 0 && (
                  <ul className="mt-4 space-y-2 border-l-2 border-[var(--accent-border)] pl-3">
                    {observations.map((obs) => (
                      <li key={obs} className="text-sm leading-6 text-[var(--muted-foreground)]">
                        {obs}
                      </li>
                    ))}
                  </ul>
                )}
                {data.possible_patterns && data.possible_patterns.length > 0 && (
                  <div className="mt-5">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Possible patterns</p>
                    <ul className="mt-2 space-y-2">
                      {data.possible_patterns.map((pattern) => (
                        <li key={pattern} className="flex items-start gap-2 text-sm leading-6 text-[var(--foreground)]">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--orange-500)]" />
                          <span>{pattern}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {reviewItems.length > 0 && (
                  <div className="mt-5">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Review</p>
                    <ul className="mt-2 space-y-2">
                      {reviewItems.map((rec) => (
                        <li key={rec} className="flex items-start gap-2 text-sm leading-6 text-[var(--foreground)]">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {data.missing_or_uncertain && data.missing_or_uncertain.length > 0 && (
                  <div className="mt-5 border-l-2 border-[var(--border)] pl-3">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Uncertain</p>
                    <ul className="mt-2 space-y-1.5 text-sm leading-6 text-[var(--muted-foreground)]">
                      {data.missing_or_uncertain.map((item) => (
                        <li key={item}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            <p className={`${expanded ? 'mt-5' : 'mt-4'} text-xs text-[var(--muted-foreground)]`}>
              AI-generated. Not medical advice.
              {!expanded && (
                <>
                  {' '}
                  <button
                    type="button"
                    className="font-bold text-[var(--accent)] transition hover:text-[var(--accent-hover)]"
                    onClick={() => setExpanded(true)}
                  >
                    Show full analysis
                  </button>
                </>
              )}
              {expanded && ' Discuss any concerns with your doctor or sleep specialist.'}
            </p>
          </>
        ) : (
          <p className="mt-4 text-sm text-[var(--muted-foreground)]">AI summary unavailable.</p>
        )}
      </CardContent>
    </Card>
  )
}
