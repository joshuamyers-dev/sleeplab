import { useState } from 'react'

import type { EventRecord } from '../api/client'
import { getDisplayTz } from '../lib/displayTz'

/**
 * Properties and structure for the props.
 */
interface Props {
  events: EventRecord[]
  durationSeconds: number
  startDatetime: string
  timeDomain?: [number, number] | null
  selectedEventId?: number | null
  onSelectEvent?: (event: EventRecord) => void
}

/**
 * React component or element to render the e v e n t_ c o l o r s.
 *
 * @returns The rendered React element.
 */
const EVENT_COLORS: Record<string, string> = {
  'Central Apnea':     '#5251A7',
  'Obstructive Apnea': '#8E3D40',
  'Hypopnea':          '#E9784B',
  'Apnea':             '#C9B715',
  'Arousal':           '#6AA136',
}

/**
 * Formats a timestamp into the user's configured display timezone.
 */
function fmtTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: getDisplayTz() })
}

/**
 * Returns the best available timestamp for an event.
 */
function eventTimestamp(event: EventRecord, startTs: number): number {
  const ts = new Date(event.event_datetime).getTime()
  return Number.isFinite(ts) ? ts : startTs + event.onset_seconds * 1000
}

/**
 * Renders a proportional event timeline for the current session.
 */
export default function EventTimeline({ events, durationSeconds, startDatetime, timeDomain, selectedEventId, onSelectEvent }: Props) {
  const [activeTooltip, setActiveTooltip] = useState<{
    eventType: string
    timeLabel: string
    durationLabel: string
    leftPct: number
  } | null>(null)
  const eventTypes = [...new Set(events.map(e => e.event_type))]

  if (events.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-[var(--border)] bg-[var(--surface-soft)] p-6">
        <p className="text-sm text-[var(--muted-foreground)]">No respiratory events recorded this session.</p>
      </div>
    )
  }

  const startTs = new Date(startDatetime).getTime()
  const fallbackStartTs = Number.isFinite(startTs) ? startTs : 0
  const eventRanges = events.map((event) => {
    const ts = eventTimestamp(event, fallbackStartTs)
    return [ts, ts + (event.duration_seconds ?? 0) * 1000] as [number, number]
  })
  const requestedDomainStart = timeDomain?.[0]
  const requestedDomainEnd = timeDomain?.[1]
  const domainStart = Math.min(
    Number.isFinite(requestedDomainStart) ? requestedDomainStart! : fallbackStartTs,
    ...eventRanges.map(([start]) => start),
  )
  const domainEnd = Math.max(
    Number.isFinite(requestedDomainEnd) ? requestedDomainEnd! : fallbackStartTs + durationSeconds * 1000,
    ...eventRanges.map(([, end]) => end),
  )
  const timelineDurationMs = Math.max(domainEnd - domainStart, 1)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-xs text-[var(--muted-foreground)]">
        {eventTypes.map(t => (
          <span key={t} className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: EVENT_COLORS[t] ?? '#888' }} />
            {t}
          </span>
        ))}
      </div>

      <div className="relative">
        <div className="relative mb-2 h-4 text-[10px] text-[var(--muted-foreground)]">
          {[0, 0.25, 0.5, 0.75, 1].map(pct => (
            <span key={pct} className="absolute -translate-x-1/2" style={{ left: `${pct * 100}%` }}>
              {fmtTime(domainStart + timelineDurationMs * pct)}
            </span>
          ))}
        </div>

        {activeTooltip ? (
          <div
            className="pointer-events-none absolute -top-14 z-10 -translate-x-1/2 rounded-[16px] border border-[var(--border)] bg-[var(--popover-surface)] px-3 py-2 text-xs shadow-sm"
            style={{ left: `${activeTooltip.leftPct}%` }}
          >
            <p className="font-bold text-[var(--foreground)]">{activeTooltip.eventType}</p>
            <p className="mt-1 text-[var(--muted-foreground)]">
              {activeTooltip.timeLabel} · {activeTooltip.durationLabel}
            </p>
          </div>
        ) : null}

        <div className="relative h-6 rounded-full bg-[rgba(125,105,93,0.14)]">
          {events.map((evt) => {
            const isSelected = selectedEventId === evt.id
            const ts = eventTimestamp(evt, fallbackStartTs)
            const markerStartTs = isSelected && evt.duration_seconds
              ? Math.max(domainStart, ts - evt.duration_seconds * 1000)
              : ts
            const widthPct = evt.duration_seconds
              ? Math.max((evt.duration_seconds * 1000 / timelineDurationMs) * 100, isSelected ? 0.8 : 0.3)
              : 0.3
            const xPct = Math.min(Math.max(((markerStartTs - domainStart) / timelineDurationMs) * 100, 0), 100 - widthPct)
            const color = EVENT_COLORS[evt.event_type] ?? '#888'
            const timeLabel = fmtTime(ts)
            const durationLabel = evt.duration_seconds ? `${evt.duration_seconds}s` : 'Duration not available'
            return (
              <button
                key={evt.id}
                type="button"
                aria-label={`${evt.event_type} at ${timeLabel}`}
                className={`absolute rounded-sm opacity-85 transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${
                  isSelected
                    ? '-top-1 h-8 z-10 min-w-1.5 ring-2 ring-white shadow-[0_0_0_3px_rgba(148,139,255,0.35),0_0_18px_rgba(148,139,255,0.75)]'
                    : 'top-0 h-full min-w-1'
                }`}
                style={{
                  left: `${xPct}%`,
                  width: `${widthPct}%`,
                  background: color,
                }}
                onBlur={() => setActiveTooltip(null)}
                onFocus={() =>
                  setActiveTooltip({
                    eventType: evt.event_type,
                    timeLabel,
                    durationLabel,
                    leftPct: Math.min(Math.max(xPct + widthPct / 2, 6), 94),
                  })
                }
                onMouseEnter={() =>
                  setActiveTooltip({
                    eventType: evt.event_type,
                    timeLabel,
                    durationLabel,
                    leftPct: Math.min(Math.max(xPct + widthPct / 2, 6), 94),
                  })
                }
                onMouseLeave={() => setActiveTooltip(null)}
                onClick={() => onSelectEvent?.(evt)}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
