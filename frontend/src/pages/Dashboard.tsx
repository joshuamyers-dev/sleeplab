import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { api } from '../api/client'
import type { SummaryStats, SessionSummary, WearableDailySummary } from '../api/client'
import noDataIllustration from '../assets/no-data.webp'
import AISummaryCard from '../components/AISummaryCard'
import CalendarHeatmap, { type CalendarMetric } from '../components/CalendarHeatmap'
import AHITrendChart from '../components/AHITrendChart'
import WearableSleepSummaryChart from '../components/WearableSleepSummaryChart'
import { ChevronRightIcon } from '../components/icons/ChevronIcons'
import InfoPopover from '../components/InfoPopover'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
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
    if (diffDays !== 1) break
    streak += 1
    previous = next
  }

  return streak
}

interface FlaggedNight {
  date: string
  label: string
  detail: string
  severity: 'high' | 'warn'
}

function buildPrimaryByDate(sessions: SessionSummary[]): Map<string, SessionSummary> {
  const map = new Map<string, SessionSummary>()
  for (const s of sessions) {
    const existing = map.get(s.folder_date)
    if (!existing || s.duration_seconds > existing.duration_seconds) {
      map.set(s.folder_date, s)
    }
  }
  return map
}

  const [reportFrom, setReportFrom] = useState(initialReportRange.from)
  const [reportTo, setReportTo] = useState(initialReportRange.to)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)

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
        // Fetch wearable summary using the same date range as the AHI trend.
        if (nextSummary.ahi_trend.length > 0) {
          const dateFrom = nextSummary.ahi_trend[0].folder_date
          const dateTo = nextSummary.ahi_trend[nextSummary.ahi_trend.length - 1].folder_date
          api.getWearableSummary(dateFrom, dateTo)
            .then(setWearableSummary)
            .catch(() => {})
        }
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

  const primaryByDate = buildPrimaryByDate(sessions)
  const primarySessions = [...primaryByDate.values()]

  const avgUsage = primarySessions.length > 0
    ? primarySessions.reduce((sum, s) => sum + s.duration_hours, 0) / primarySessions.length
    : null

  const leakSessions = primarySessions.filter(s => s.avg_leak !== null)
  const avgLeak = leakSessions.length > 0
    ? leakSessions.reduce((sum, s) => sum + (s.avg_leak ?? 0), 0) / leakSessions.length
    : null

  const bestNight = primarySessions
    .filter(s => s.ahi !== null)
    .sort((a, b) => (a.ahi ?? 999) - (b.ahi ?? 999))[0] ?? null

  const perDayData: Record<string, { pressure: number | null; leak: number | null }> = {}
  for (const [date, s] of primaryByDate) {
    perDayData[date] = { pressure: s.avg_pressure, leak: s.avg_leak }
  }

  const flaggedNights: FlaggedNight[] = []
  const flaggedDatesSet = new Set<string>()

  const ahiSorted = primarySessions
    .filter(s => s.ahi !== null)
    .sort((a, b) => (b.ahi ?? 0) - (a.ahi ?? 0))
  if (ahiSorted[0]) {
    const s = ahiSorted[0]
    flaggedNights.push({
      date: s.folder_date,
      label: 'Highest AHI',
      detail: `AHI ${s.ahi?.toFixed(1)}`,
      severity: (s.ahi ?? 0) >= 15 ? 'high' : 'warn',
    })
    flaggedDatesSet.add(s.folder_date)
  }

  const leakSorted = primarySessions
    .filter(s => s.avg_leak !== null)
    .sort((a, b) => (b.avg_leak ?? 0) - (a.avg_leak ?? 0))
  if (leakSorted[0] && !flaggedDatesSet.has(leakSorted[0].folder_date)) {
    const s = leakSorted[0]
    flaggedNights.push({
      date: s.folder_date,
      label: 'Highest leak',
      detail: `${s.avg_leak?.toFixed(0)} L/min`,
      severity: (s.avg_leak ?? 0) >= 40 ? 'high' : 'warn',
    })
    flaggedDatesSet.add(s.folder_date)
  }

  for (const s of primarySessions.filter(s => s.duration_hours < 4)) {
    if (!flaggedDatesSet.has(s.folder_date) && flaggedNights.length < 5) {
      flaggedNights.push({
        date: s.folder_date,
        label: 'Short session',
        detail: `${s.duration_hours.toFixed(1)}h usage`,
        severity: 'warn',
      })
      flaggedDatesSet.add(s.folder_date)
    }
  }

  const hasSpo2 = sessions.some(s => s.has_spo2)
  const caveat = [
    `Based on ${summary.nights_with_data} of ${summary.total_nights} nights`,
    !hasSpo2 ? 'no SpO₂ data' : null,
  ].filter(Boolean).join(' · ')

  const statHelp = {
    streaks: 'How many nights in a row you have recent imported CPAP data for. Longer streaks usually mean more consistent therapy use.',
    compliance: 'The share of nights in your recorded date range where the machine has usable therapy data. Higher percentages generally mean more consistent therapy use.',
    avgAhi: 'AHI means apnea-hypopnea index: the average number of breathing events per hour. Under 5 is commonly treated as a good control target.',
    avgPressure: 'The average treatment pressure your machine delivered during recorded nights. This can help show whether your pressure settings are in the right range.',
    respiratoryEvents: 'The average number of breathing events seen on each recorded night. Lower numbers usually suggest steadier breathing during treatment.',
    avgUsage: 'Average nightly therapy duration across recorded sessions.',
    avgLeak: 'Average mask leak across recorded nights. Values below 24 L/min are typically within a normal range.',
    bestNight: 'The night with the lowest AHI in your recorded data — your best therapy result.',
  }

  const primaryCardContent = 'flex h-full flex-col items-start px-4 pb-4 pt-5 sm:px-6 sm:pb-6 sm:pt-7'
  const mobilePrimaryChipContent = 'flex h-full flex-col items-start px-4 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-5 lg:min-h-[108px]'
  const statLabelClass = 'flex items-center gap-1.5 text-xs font-bold text-[var(--foreground)] sm:gap-2 sm:text-sm'
  const statValueClass = 'mt-2 text-3xl font-semibold sm:text-4xl'
  const statDescriptionClass = 'mt-1 text-xs leading-5 text-[var(--muted-foreground)] sm:text-sm'
  const statLinkClass = 'mt-3 hidden items-center gap-1 text-xs font-bold text-[var(--accent)] transition hover:text-[var(--accent-hover)] sm:inline-flex sm:text-sm'

  const chipContent = 'flex h-full min-h-[104px] flex-col items-start px-4 pb-4 pt-4 sm:min-h-[108px] sm:px-6 sm:pb-5 sm:pt-5'
  const chipLabel = 'flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted-foreground)] [&_button]:h-4 [&_button]:w-4 [&_button]:translate-y-[-1px] [&_button]:text-[10px]'
  const chipValue = 'mt-2 text-2xl font-semibold leading-none text-[var(--foreground)] sm:text-[1.7rem]'
  const chipDesc = 'mt-1.5 text-xs leading-4 text-[var(--muted-foreground)]'
  const reviewDotClass = {
    high: 'bg-[var(--danger-text)]',
    warn: 'bg-[var(--orange-500)]',
  } as const

  const calMetrics: { key: CalendarMetric; label: string }[] = [
    { key: 'ahi',   label: 'AHI' },
    { key: 'usage', label: 'Usage' },
    { key: 'leak',  label: 'Leak' },
  ]

  async function handleDownloadReport() {
    setReportError(null)
    if (!reportFrom || !reportTo) {
      setReportError('Choose a start and end date.')
      return
    }
    if (reportTo < reportFrom) {
      setReportError('End date must be on or after start date.')
      return
    }

    const fromCompact = compactDate(reportFrom)
    const toCompact = compactDate(reportTo)
    setReportLoading(true)
    try {
      const blob = await api.downloadSessionReportPdf(fromCompact, toCompact)
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `sleeplab-report-${fromCompact}-${toCompact}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Could not download report.')
    } finally {
      setReportLoading(false)
    }
  }

  async function handleDownloadReport() {
    setReportError(null)
    if (!reportFrom || !reportTo) {
      setReportError('Choose a start and end date.')
      return
    }
    if (reportTo < reportFrom) {
      setReportError('End date must be on or after start date.')
      return
    }

    const fromCompact = compactDate(reportFrom)
    const toCompact = compactDate(reportTo)
    setReportLoading(true)
    try {
      const blob = await api.downloadSessionReportPdf(fromCompact, toCompact)
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `sleeplab-report-${fromCompact}-${toCompact}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Could not download report.')
    } finally {
      setReportLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-8">
      <section className="order-1 space-y-3 sm:space-y-4" aria-label="Overview metrics">
        {streakCount > 0 && (
          <div className="flex items-center justify-end">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[var(--muted-foreground)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
              {streakCount}-night streak
            </div>
          </div>
        )}

        <div className="grid grid-cols-6 gap-3 lg:grid-cols-12 lg:gap-4">
          <Card className="order-1 col-span-3 lg:col-span-4">
            <CardContent className={primaryCardContent}>
            <div className={statLabelClass}>
              <span>Average AHI</span>
              <InfoPopover title="Average AHI">{statHelp.avgAhi}</InfoPopover>
            </div>
            <div className={`${statValueClass} ${ahiTone(summary.avg_ahi)}`}>{summary.avg_ahi?.toFixed(1) ?? '—'}</div>
            <div className={statDescriptionClass}>Breathing events each hour</div>
            <Link className={statLinkClass} to="/trends#ahi-trend">
              <span>View AHI trend</span>
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
            </CardContent>
          </Card>

          <Card className="order-2 col-span-3 lg:col-span-4">
            <CardContent className={primaryCardContent}>
            <div className={statLabelClass}>
              <span>Compliance</span>
              <InfoPopover title="Compliance">{statHelp.compliance}</InfoPopover>
            </div>
            <div className={`${statValueClass} text-[var(--foreground)]`}>{summary.compliance_pct}%</div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--border)]">
              <div
                className="h-1.5 rounded-full bg-[var(--accent)] transition-all"
                style={{ width: `${Math.min(summary.compliance_pct, 100)}%` }}
              />
            </div>
            <div className={statDescriptionClass}>Nights with usable data</div>
            <Link className={statLinkClass} to="/trends#usage-trend">
              <span>View usage trend</span>
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
            </CardContent>
          </Card>

          <Card className="order-3 col-span-3 lg:col-span-4">
            <CardContent className={primaryCardContent}>
            <div className={statLabelClass}>
              <span>Average Pressure</span>
              <InfoPopover title="Average pressure">{statHelp.avgPressure}</InfoPopover>
            </div>
            <div className={`${statValueClass} text-[var(--foreground)]`}>{summary.avg_pressure?.toFixed(1) ?? '—'}</div>
            <div className={statDescriptionClass}>Typical treatment pressure (cmH₂O)</div>
            <Link className={statLinkClass} to="/calendar#calendar-grid">
              <span>View session details</span>
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
            </CardContent>
          </Card>

          <Card className="order-5 col-span-2 lg:order-4 lg:col-span-3">
            <CardContent className={chipContent}>
            <div className={chipLabel}>
              <span>Resp. Events</span>
              <InfoPopover title="Respiratory events">{statHelp.respiratoryEvents}</InfoPopover>
            </div>
            <div className={chipValue}>{respiratoryEventsPerNight.toFixed(1)}</div>
            <div className={chipDesc}>avg per night</div>
            </CardContent>
          </Card>

          <Card className="order-6 col-span-2 lg:order-5 lg:col-span-3">
            <CardContent className={chipContent}>
            <div className={chipLabel}>
              <span>Avg Usage</span>
              <InfoPopover title="Average usage">{statHelp.avgUsage}</InfoPopover>
            </div>
            <div className={chipValue}>{avgUsage != null ? `${avgUsage.toFixed(1)}h` : '—'}</div>
            <div className={chipDesc}>per night</div>
            </CardContent>
          </Card>

          <Card className="order-7 col-span-2 lg:order-6 lg:col-span-3">
            <CardContent className={chipContent}>
            <div className={chipLabel}>
              <span>Avg Leak</span>
              <InfoPopover title="Average leak">{statHelp.avgLeak}</InfoPopover>
            </div>
            <div className={chipValue}>{avgLeak != null ? `${avgLeak.toFixed(0)}` : '—'}</div>
            <div className={chipDesc}>L/min avg</div>
            </CardContent>
          </Card>

          <Card className="order-4 col-span-3 lg:order-7 lg:col-span-3">
            <CardContent className={mobilePrimaryChipContent}>
            <div className={chipLabel}>
              <span>Best Night</span>
              <InfoPopover title="Best night">{statHelp.bestNight}</InfoPopover>
            </div>
            <div className={`mt-2 text-3xl font-semibold leading-none lg:text-[1.7rem] ${ahiTone(bestNight?.ahi ?? null)}`}>
              {bestNight ? `AHI ${bestNight.ahi?.toFixed(1)}` : '—'}
            </div>
            {bestNight && (
              <Link
                className="mt-1 text-[11px] font-bold text-[var(--accent)] transition hover:text-[var(--accent-hover)]"
                to={`/sessions/${bestNight.folder_date}`}
              >
                {bestNight.folder_date}
              </Link>
            )}
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="order-2 md:order-2">
        <AISummaryCard enabled={summary.nights_with_data > 0} caveat={caveat} />
      </div>

      <div className="order-3 grid grid-cols-1 gap-5 md:order-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Nights to Review</CardTitle>
            <CardDescription>Sessions worth a closer look.</CardDescription>
          </CardHeader>
          <CardContent>
            {flaggedNights.length === 0 ? (
              <p className="py-4 text-center text-sm text-[var(--muted-foreground)]">
                No flagged nights in your recent data.
              </p>
            ) : (
              <ul className="space-y-2">
                {flaggedNights.map((n) => (
                  <li key={`${n.label}-${n.date}`} className="flex items-center justify-between gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${reviewDotClass[n.severity]}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--foreground)]">{n.label}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">{n.detail}</p>
                      </div>
                    </div>
                    <Link
                      to={`/sessions/${n.date}`}
                      className="shrink-0 text-xs font-bold text-[var(--accent)] transition hover:text-[var(--accent-hover)]"
                    >
                      {n.date} →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="hidden md:block">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Sleep Calendar</CardTitle>
                <CardDescription>Click any recorded night to open the session view.</CardDescription>
              </div>
              <div className="flex rounded-full border border-[var(--border)] bg-[var(--surface-soft)] p-1 self-start sm:self-auto">
                {calMetrics.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                      calendarMetric === m.key
                        ? 'bg-[var(--surface-strong)] text-[var(--accent)]'
                        : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                    }`}
                    onClick={() => setCalendarMetric(m.key)}
                    aria-pressed={calendarMetric === m.key}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CalendarHeatmap sessions={sessions} metric={calendarMetric} mode="single" />
          </CardContent>
        </Card>
      </div>

      <div className="order-4 md:order-4">
        <AHITrendChart
          trend={summary.ahi_trend}
          perDayData={perDayData}
          flaggedNights={flaggedNights}
        />
      </div>

      <Card className="order-5">
        <CardHeader>
          <CardTitle>Doctor Report</CardTitle>
          <CardDescription>Export a PDF therapy summary for a selected date range.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="report-from">From</Label>
              <Input
                id="report-from"
                type="date"
                value={reportFrom}
                onChange={(event) => setReportFrom(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-to">To</Label>
              <Input
                id="report-to"
                type="date"
                value={reportTo}
                onChange={(event) => setReportTo(event.target.value)}
              />
            </div>
            <Button className="w-full sm:w-auto" onClick={() => void handleDownloadReport()} disabled={reportLoading}>
              {reportLoading ? 'Downloading...' : 'Download Report'}
            </Button>
          </div>
          {reportError && (
            <p className="mt-3 text-sm font-semibold text-[var(--danger-text)]">{reportError}</p>
          )}
        </CardContent>
      </Card>

      <Card className="order-6 md:hidden">
        <CardHeader>
          <div className="flex flex-col gap-3">
            <div>
              <CardTitle>Sleep Calendar</CardTitle>
              <CardDescription>Click any recorded night to open the session view.</CardDescription>
            </div>
            <div className="flex self-start rounded-full border border-[var(--border)] bg-[var(--surface-soft)] p-1">
              {calMetrics.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className={`rounded-full px-3 py-2 text-xs font-bold transition ${
                    calendarMetric === m.key
                      ? 'bg-[var(--surface-strong)] text-[var(--accent)]'
                      : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                  }`}
                  onClick={() => setCalendarMetric(m.key)}
                  aria-pressed={calendarMetric === m.key}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <CalendarHeatmap sessions={sessions} metric={calendarMetric} mode="single" collapseOnMobile />
        </CardContent>
      </Card>

      <div className="order-7 md:order-5">
        <WearableSleepSummaryChart data={wearableSummary} />
      </div>
    </div>
  )
}
