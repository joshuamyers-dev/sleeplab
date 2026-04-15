import { useState } from 'react'

import type { EventRecord } from '../api/client'
import { getDisplayTz } from '../lib/displayTz'

interface Props {
  events: EventRecord[]
  durationSeconds: number
  startDatetime: string
}

const EVENT_COLORS: Record<string, string> = {
  'Central Apnea':     '#5251A7',
  'Obstructive Apnea': '#8E3D40',
  'Hypopnea':          '#E9784B',
  'Apnea':             '#C9B715',
  'Arousal':           '#6AA136',
}

function fmtTime(startIso: string, offsetSeconds: number): string {
  const d = new Date(new Date(startIso).getTime() + offsetSeconds * 1000)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: getDisplayTz() })
}

export default function EventTimeline({ events, durationSeconds, startDatetime }: Props) {
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
              {fmtTime(startDatetime, durationSeconds * pct)}
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

        <div className="relative h-6 overflow-hidden rounded-full bg-[rgba(125,105,93,0.14)]">
          {events.map((evt, i) => {
            const xPct = (evt.onset_seconds / durationSeconds) * 100
            const widthPct = evt.duration_seconds
              ? Math.max((evt.duration_seconds / durationSeconds) * 100, 0.3)
              : 0.3
            const color = EVENT_COLORS[evt.event_type] ?? '#888'
            const timeLabel = fmtTime(startDatetime, evt.onset_seconds)
            const durationLabel = evt.duration_seconds ? `${evt.duration_seconds}s` : 'Duration not available'
            return (
              <span
                key={i}
                className="absolute top-0 h-full min-w-1 rounded-sm opacity-85"
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
                tabIndex={0}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
