import { useNavigate } from 'react-router-dom'
import type { SessionSummary } from '../api/client'

interface Props {
  sessions: SessionSummary[]
}

function getAhiColor(ahi: number | null): string {
  if (ahi === null) return 'var(--calendar-empty)'
  if (ahi < 5)      return '#6AA136'
  if (ahi < 15)     return '#C9B715'
  if (ahi < 30)     return '#E9784B'
  return '#8E3D40'
}

function getAhiLabel(ahi: number | null): string {
  if (ahi === null) return 'No data'
  if (ahi < 5)      return 'Normal'
  if (ahi < 15)     return 'Mild'
  if (ahi < 30)     return 'Moderate'
  return 'Severe'
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export default function CalendarHeatmap({ sessions }: Props) {
  const navigate = useNavigate()

  // Build date → {ahi, session_id} lookup from the longest block per night
  const byDate: Record<string, { ahi: number | null; sessionId: string }> = {}
  for (const s of sessions) {
    const d = s.folder_date
    if (!byDate[d] || s.duration_seconds > (sessions.find(x => x.folder_date === d && x.id === byDate[d].sessionId)?.duration_seconds ?? 0)) {
      byDate[d] = { ahi: s.ahi, sessionId: s.id }
    }
  }

  if (sessions.length === 0) return <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">No sessions imported yet.</div>

  // Determine date range from data
  const dates = sessions.map(s => s.folder_date).sort()
  const startDate = new Date(dates[0])
  const endDate = new Date(dates[dates.length - 1])

  // Group by year-month
  const months: { year: number; month: number; days: (Date | null)[] }[] = []
  let cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1)

  while (cur <= end) {
    const year = cur.getFullYear()
    const month = cur.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDow = new Date(year, month, 1).getDay()
    const days: (Date | null)[] = Array(firstDow).fill(null)
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(year, month, d))
    }
    months.push({ year, month, days })
    cur = new Date(year, month + 1, 1)
  }

  function toIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted-foreground)]">
        <span className="uppercase tracking-[0.2em] text-[var(--muted-foreground)]">AHI</span>
        {[['#6AA136','<5 Normal'],['#C9B715','5–15 Mild'],['#E9784B','15–30 Moderate'],['#8E3D40','30+ Severe'],['var(--calendar-empty)','No data']].map(([color,label]) => (
          <span key={label} className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-5">
        {months.map(({ year, month, days }) => (
          <div key={`${year}-${month}`} className="rounded-[24px] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
            <div className="mb-3 text-sm font-bold text-[var(--foreground)]">{MONTHS[month]} {year}</div>
            <div className="mb-1 grid grid-cols-7 gap-1">
              {DAYS.map(d => <span key={d} className="text-center text-[10px] text-[var(--muted-foreground)]">{d[0]}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((date, i) => {
                if (!date) return <span key={i} className="h-4 w-4" />
                const iso = toIso(date)
                const entry = byDate[iso]
                const color = getAhiColor(entry?.ahi ?? null)
                const label = entry
                  ? `${iso}\nAHI: ${entry.ahi?.toFixed(1) ?? '—'} (${getAhiLabel(entry.ahi ?? null)})`
                  : `${iso}\nNo session`
                return (
                  <span
                    key={i}
                    className="h-4 w-4 rounded-sm transition hover:scale-110"
                    style={{ background: color, cursor: entry ? 'pointer' : 'default' }}
                    title={label}
                    onClick={() => entry && navigate(`/sessions/${entry.sessionId}`)}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
