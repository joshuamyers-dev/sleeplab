import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { api } from '../api/client'
import type { SummaryStats, SessionSummary } from '../api/client'
import noDataIllustration from '../assets/no-data.png'
import AISummaryCard from '../components/AISummaryCard'
import CalendarHeatmap from '../components/CalendarHeatmap'
import AHITrendChart from '../components/AHITrendChart'
import { ChevronRightIcon } from '../components/icons/ChevronIcons'
import InfoPopover from '../components/InfoPopover'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { IMPORT_COMPLETED_EVENT } from '../lib/aiSummaryCache'

function ahiTone(ahi: number | null) {
  if (ahi == null) return 'text-[var(--muted-foreground)]'
  if (ahi < 5) return 'text-[var(--green-700)]'
  if (ahi < 15) return 'text-[var(--yellow-700)]'
  return 'text-[var(--orange-700)]'
}

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

export default function Dashboard() {
  const [summary, setSummary] = useState<SummaryStats | null>(null)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [nextSummary, nextSessions] = await Promise.all([
          api.getSummary(),
          api.getSessions({ per_page: 600 }),
        ])
        setSummary(nextSummary)
        setSessions(nextSessions)
        setError(null)
      } catch (err) {
        setError(String(err))
      } finally {
        setLoading(false)
      }
    }

    void loadDashboard()

    function handleImportCompleted() {
      setLoading(true)
      void loadDashboard()
    }

    window.addEventListener(IMPORT_COMPLETED_EVENT, handleImportCompleted)
    return () => window.removeEventListener(IMPORT_COMPLETED_EVENT, handleImportCompleted)
  }, [])

  if (loading) return <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface-strong)] p-10 text-center text-[var(--muted-foreground)]">Loading dashboard...</div>
  if (error) return <div className="rounded-[28px] border border-[var(--accent-border)] bg-[var(--danger-soft)] p-10 text-center text-[var(--danger-text)]">Error connecting to API: {error}</div>
  if (!summary) return null

  if (summary.nights_with_data === 0 || sessions.length === 0) {
    return (
      <Card className="bg-[radial-gradient(circle_at_top_left,_rgba(82,81,167,0.08),_transparent_30%),var(--surface-strong)]">
        <CardContent className="px-8 pb-8 pt-8">
          <div className="mx-auto max-w-2xl text-center">
            <img
              src={noDataIllustration}
              alt=""
              className="mx-auto mb-6 max-h-72 w-auto object-contain"
            />
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--accent)]">No sleep data yet</p>
            <h2 className="mt-3 text-3xl font-extrabold text-[var(--foreground)]">Import your CPAP data to unlock the dashboard</h2>
            <p className="mt-3 text-base leading-7 text-[var(--muted-foreground)]">
              Once you import your DATALOG folder, you&apos;ll see your calendar, trends, nightly details, and AI insights here.
            </p>
            <div className="mt-6 flex justify-center">
              <Link to="/import">
                <Button>Import data</Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const { event_breakdown: eb } = summary
  const totalEvents = Object.values(eb).reduce((a, b) => a + b, 0)
  const streakCount = currentStreak(sessions)
  const respiratoryEventsPerNight = summary.nights_with_data > 0
    ? totalEvents / summary.nights_with_data
    : 0

  const statHelp = {
    streaks: 'How many nights in a row you have recent imported CPAP data for. Longer streaks usually mean more consistent therapy use.',
    compliance: 'The share of nights in your recorded date range where the machine has usable therapy data. Higher percentages generally mean more consistent therapy use.',
    avgAhi: 'AHI means apnea-hypopnea index: the average number of breathing events per hour. Under 5 is commonly treated as a good control target.',
    avgPressure: 'The average treatment pressure your machine delivered during recorded nights. This can help show whether your pressure settings are in the right range.',
    respiratoryEvents: 'The average number of breathing events seen on each recorded night. Lower numbers usually suggest steadier breathing during treatment.',
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="bg-[radial-gradient(circle_at_top_left,_rgba(106,161,54,0.10),_transparent_30%),var(--surface-strong)]">
          <CardContent className="flex h-full flex-col items-start px-6 pb-6 pt-7">
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--foreground)]">
              <span>Streaks</span>
              <InfoPopover title="Streaks">{statHelp.streaks}</InfoPopover>
            </div>
            <div className="mt-2 text-4xl font-semibold text-[var(--foreground)]">{streakCount}</div>
            <div className="mt-1 text-sm text-[var(--muted-foreground)]">Consecutive nights tracked</div>
            <Link className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[var(--accent)] transition hover:text-[var(--accent-hover)]" to="/calendar#calendar-grid">
              <span>View calendar</span>
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex h-full flex-col items-start px-6 pb-6 pt-7">
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--foreground)]">
              <span>Compliance</span>
              <InfoPopover title="Compliance">{statHelp.compliance}</InfoPopover>
            </div>
            <div className="mt-2 text-4xl font-semibold text-[var(--foreground)]">{summary.compliance_pct}%</div>
            <div className="mt-1 text-sm text-[var(--muted-foreground)]">Used the machine consistently</div>
            <Link className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[var(--accent)] transition hover:text-[var(--accent-hover)]" to="/trends#usage-trend">
              <span>View usage trend</span>
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex h-full flex-col items-start px-6 pb-6 pt-7">
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--foreground)]">
              <span>Average AHI</span>
              <InfoPopover title="Average AHI">{statHelp.avgAhi}</InfoPopover>
            </div>
            <div className={`mt-2 text-4xl font-semibold ${ahiTone(summary.avg_ahi)}`}>{summary.avg_ahi?.toFixed(1) ?? '—'}</div>
            <div className="mt-1 text-sm text-[var(--muted-foreground)]">Breathing events each hour</div>
            <Link className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[var(--accent)] transition hover:text-[var(--accent-hover)]" to="/trends#ahi-trend">
              <span>View AHI trend</span>
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex h-full flex-col items-start px-6 pb-6 pt-7">
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--foreground)]">
              <span>Average Pressure</span>
              <InfoPopover title="Average pressure">{statHelp.avgPressure}</InfoPopover>
            </div>
            <div className="mt-2 text-4xl font-semibold text-[var(--foreground)]">{summary.avg_pressure?.toFixed(1) ?? '—'}</div>
            <div className="mt-1 text-sm text-[var(--muted-foreground)]">Typical treatment pressure used</div>
            <Link className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[var(--accent)] transition hover:text-[var(--accent-hover)]" to="/calendar#calendar-grid">
              <span>View session details</span>
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex h-full flex-col items-start px-6 pb-6 pt-7">
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--foreground)]">
              <span>Respiratory Events</span>
              <InfoPopover title="Respiratory events">{statHelp.respiratoryEvents}</InfoPopover>
            </div>
            <div className="mt-2 text-4xl font-semibold text-[var(--foreground)]">{respiratoryEventsPerNight.toFixed(1)}</div>
            <div className="mt-1 text-sm text-[var(--muted-foreground)]">Average breathing events per night</div>
            <Link className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[var(--accent)] transition hover:text-[var(--accent-hover)]" to="/trends#event-breakdown">
              <span>View event timeline</span>
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <AISummaryCard enabled={summary.nights_with_data > 0} />

      <Card>
        <CardHeader>
          <CardTitle>Sleep Calendar</CardTitle>
          <CardDescription>Click any recorded night to open the session view.</CardDescription>
        </CardHeader>
        <CardContent>
          <CalendarHeatmap sessions={sessions} />
        </CardContent>
      </Card>

      <AHITrendChart trend={summary.ahi_trend} />
    </div>
  )
}
