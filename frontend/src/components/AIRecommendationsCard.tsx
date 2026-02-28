import type { AISummaryResponse } from '../api/client'
import GlossaryText from './GlossaryText'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

export default function AIRecommendationsCard({
  enabled,
  data,
  isLoading,
}: {
  enabled: boolean
  data: AISummaryResponse | null
  isLoading: boolean
}) {
  const recommendations = data?.recommended_changes ?? []

  return (
    <Card className="overflow-hidden border-[var(--border)] bg-[radial-gradient(circle_at_top_left,_rgba(106,161,54,0.10),_transparent_28%),radial-gradient(circle_at_90%_18%,_rgba(233,120,75,0.10),_transparent_20%),var(--surface-strong)]">
      <CardHeader>
        <div>
          <CardTitle className="text-lg">AI Recommendations</CardTitle>
          <CardDescription>Specific machine settings and therapy adjustments to review.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-4 w-4/5 animate-pulse rounded bg-[var(--accent-soft)]" />
            <div className="h-4 w-full animate-pulse rounded bg-[var(--accent-soft)]" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--accent-soft)]" />
          </div>
        ) : !enabled ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            AI recommendations will be available after you import session data.
          </p>
        ) : data?.error ? (
          <p className="text-sm text-[var(--muted-foreground)]">{data.error}</p>
        ) : recommendations.length > 0 ? (
          <div className="space-y-3">
            {recommendations.map((item) => (
              <div
                key={item}
                className="border-l border-[var(--accent-border)] pl-4 text-sm leading-6 text-[var(--muted-foreground)]"
              >
                <GlossaryText text={item} />
              </div>
            ))}
            <p className="text-sm leading-6 text-[var(--muted-foreground)]">
              <span className="block font-bold text-[var(--accent)]">
                AI-generated information only, not medical advice. Do not use this on its own to diagnose, treat, or change therapy settings. Review important changes with your doctor, sleep specialist, or GP.
              </span>
            </p>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">
            No specific setting changes are suggested from the current data right now.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
