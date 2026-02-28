import { useEffect, useState } from 'react'

import type { SessionSummary } from '../api/client'
import { api } from '../api/client'
import CalendarHeatmap from '../components/CalendarHeatmap'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { IMPORT_COMPLETED_EVENT } from '../lib/aiSummaryCache'

function currentStreak(sessions: SessionSummary[]) {
  const uniqueDates = [...new Set(sessions.map((session) => session.folder_date))].sort().reverse()
  if (uniqueDates.length === 0) return 0

  let streak = 1
  let previous = new Date(`${uniqueDates[0]}T00:00:00`)

  for (let index = 1; index < uniqueDates.length; index += 1) {
    const next = new Date(`${uniqueDates[index]}T00:00:00`)
    const diffDays = Math.round((previous.getTime() - next.getTime()) / 86_400_000)
    if (diffDays !== 1) {
      break
    }
    streak += 1
    previous = next
  }

  return streak
}

export default function CalendarPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadCalendar() {
      try {
        const data = await api.getSessions({ per_page: 600 })
        setSessions(data)
        setError(null)
      } catch (err) {
        setError(String(err))
      } finally {
        setLoading(false)
      }
    }

    void loadCalendar()

    function handleImportCompleted() {
      setLoading(true)
      void loadCalendar()
    }

    window.addEventListener(IMPORT_COMPLETED_EVENT, handleImportCompleted)
    return () => window.removeEventListener(IMPORT_COMPLETED_EVENT, handleImportCompleted)
  }, [])

  if (loading) {
    return <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface-strong)] p-10 text-center text-[var(--muted-foreground)]">Loading calendar...</div>
  }

  if (error) {
    return <div className="rounded-[22px] border border-[var(--accent-border)] bg-[var(--danger-soft)] p-10 text-center text-[var(--danger-text)]">Error loading calendar: {error}</div>
  }

  const uniqueNights = new Set(sessions.map((session) => session.folder_date)).size
  const streak = currentStreak(sessions)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-[radial-gradient(circle_at_top_left,_rgba(82,81,167,0.08),_transparent_32%),var(--surface-strong)]">
          <CardContent className="px-6 pb-6 pt-7">
            <p className="text-sm font-bold text-[var(--foreground)]">Nights with data</p>
            <p className="mt-2 text-4xl font-semibold text-[var(--foreground)]">{uniqueNights}</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">Recorded sleep sessions available in your calendar.</p>
          </CardContent>
        </Card>
        <Card className="bg-[radial-gradient(circle_at_top_left,_rgba(106,161,54,0.08),_transparent_32%),var(--surface-strong)]">
          <CardContent className="px-6 pb-6 pt-7">
            <p className="text-sm font-bold text-[var(--foreground)]">Current streak</p>
            <p className="mt-2 text-4xl font-semibold text-[var(--foreground)]">{streak}</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">Consecutive nights with imported therapy data.</p>
          </CardContent>
        </Card>
      </div>

      <Card id="calendar-grid">
        <CardHeader>
          <CardTitle>Calendar</CardTitle>
          <CardDescription>Browse your recorded nights and open a session directly from any day tile.</CardDescription>
        </CardHeader>
        <CardContent>
          <CalendarHeatmap sessions={sessions} />
        </CardContent>
      </Card>
    </div>
  )
}
