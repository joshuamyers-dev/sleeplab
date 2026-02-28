import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../api/client'
import type { SessionDetail as SessionDetailType, EventRecord, MetricsResponse } from '../api/client'
import { ChevronLeftIcon, ChevronRightIcon } from '../components/icons/ChevronIcons'
import EventTimeline from '../components/EventTimeline'
import InfoPopover from '../components/InfoPopover'
import MetricsChart from '../components/MetricsChart'
import SessionAICard from '../components/SessionAICard'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}


function ahiBadge(ahi: number | null): { label: string; className: string } {
  if (ahi === null) return { label: 'No data', className: 'bg-[var(--surface-soft)] text-[var(--muted-foreground)]' }
  if (ahi < 5)  return { label: 'Good night', className: 'bg-[rgba(106,161,54,0.14)] text-[var(--green-700)]' }
  if (ahi < 15) return { label: 'Mild night', className: 'bg-[rgba(201,183,21,0.14)] text-[var(--yellow-700)]' }
  if (ahi < 30) return { label: 'Rough night', className: 'bg-[rgba(233,120,75,0.14)] text-[var(--orange-700)]' }
  return { label: 'Difficult night', className: 'bg-[var(--danger-soft)] text-[var(--danger-text)]' }
}

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const sessionId = id ?? ''

  const [session, setSession] = useState<SessionDetailType | null>(null)
  const [events, setEvents] = useState<EventRecord[]>([])
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [prevNext, setPrevNext] = useState<{ prev: string | null; next: string | null }>({ prev: null, next: null })

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.getSession(sessionId),
      api.getEvents(sessionId),
      api.getMetrics(sessionId, 15),
    ]).then(([s, e, m]) => {
      setSession(s)
      setEvents(e)
      setMetrics(m)
      setLoading(false)
    }).catch(() => navigate('/dashboard'))
  }, [navigate, sessionId])

  useEffect(() => {
    if (!session) return
    api.getSessions({ per_page: 600 }).then(all => {
      const sorted = all
        .filter(s => s.block_index === 0)
        .sort((a, b) => a.folder_date.localeCompare(b.folder_date))
      const idx = sorted.findIndex(s => s.id === sessionId)
      setPrevNext({
        prev: idx > 0 ? sorted[idx - 1].id : null,
        next: idx < sorted.length - 1 ? sorted[idx + 1].id : null,
      })
    })
  }, [session, sessionId])

  if (loading) return <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface-strong)] p-10 text-center text-[var(--muted-foreground)]">Loading session...</div>
  if (!session || !metrics) return null

  const hours = Math.floor(session.duration_seconds / 3600)
  const mins  = Math.floor((session.duration_seconds % 3600) / 60)
  const endTime = new Date(new Date(session.start_datetime).getTime() + session.duration_seconds * 1000).toISOString()
  const badge = ahiBadge(session.ahi)

  const statHelp = {
    ahi: 'AHI means apnea-hypopnea index: the average number of breathing events per hour during this session.',
    usage: 'How long the machine was running and delivering therapy during this session.',
    pressure: 'Average pressure is the typical treatment pressure delivered during the night. The 95th percentile shows the pressure level stayed at or below for most of the session.',
    events: 'This is the total count of breathing disturbances during this night. CA means central apnea, OA means obstructive apnea, and H means hypopnea.',
    leak: 'Leak shows how much air escaped from the mask or mouth. Lower leaks usually mean the machine can treat events more effectively.',
    respRate: 'Respiratory rate is the average number of breaths per minute recorded by the machine during the session.',
    tidalVolume: 'Tidal volume is the estimated amount of air moved in a normal breath. It is one more signal of breathing pattern, not usually something patients tune directly.',
  }

  return (
    <div className="space-y-6">
      {/* Nav row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm font-bold text-[var(--accent)] transition hover:text-[var(--accent-hover)]">
          <ChevronLeftIcon className="h-4 w-4" />
          <span>All nights</span>
        </Link>
        <div className="flex gap-2">
          {prevNext.prev && (
            <Link to={`/sessions/${prevNext.prev}`}>
              <Button variant="outline" size="sm">
                <ChevronLeftIcon className="h-4 w-4" />
                <span>Previous night</span>
              </Button>
            </Link>
          )}
          {prevNext.next && (
            <Link to={`/sessions/${prevNext.next}`}>
              <Button variant="outline" size="sm">
                <span>Next night</span>
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Session header card */}
      <Card className="overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(106,161,54,0.10),_transparent_30%),radial-gradient(circle_at_top_left,_rgba(82,81,167,0.08),_transparent_24%),var(--surface-strong)]">
        <CardContent className="px-6 pb-6 pt-6">
          {/* Top row: label + badge */}
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">Session detail</p>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${badge.className}`}>
              {badge.label}
            </span>
          </div>

          {/* Date + time */}
          <h1 className="mt-3 text-2xl font-extrabold text-[var(--foreground)] sm:text-3xl">
            {fmtDate(session.folder_date + 'T00:00:00')}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {fmtTime(session.start_datetime)} – {fmtTime(endTime)}
          </p>

          {/* Three primary stat pills */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-[18px] bg-[rgba(82,81,167,0.08)] px-4 py-4 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">AHI</p>
              <p className="mt-1.5 text-3xl font-semibold text-[var(--accent)]">
                {session.ahi?.toFixed(1) ?? '—'}
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">events/hr</p>
            </div>
            <div className="rounded-[18px] bg-[var(--surface-soft)] px-4 py-4 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Pressure</p>
              <p className="mt-1.5 text-3xl font-semibold text-[var(--foreground)]">
                {session.avg_pressure?.toFixed(1) ?? '—'}
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">cmH₂O</p>
            </div>
            <div className="rounded-[18px] bg-[rgba(106,161,54,0.08)] px-4 py-4 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Usage</p>
              <p className="mt-1.5 text-3xl font-semibold text-[var(--green-700)]">
                {hours}h {mins}m
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">of sleep</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Secondary stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="px-5 pb-5 pt-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Events</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-3xl font-semibold text-[var(--foreground)]">{session.total_ahi_events}</span>
              <InfoPopover title="Events">{statHelp.events}</InfoPopover>
            </div>
            <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
              CA {session.central_apnea_count} · OA {session.obstructive_apnea_count} · H {session.hypopnea_count}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-5 pb-5 pt-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Avg leak</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-3xl font-semibold text-[var(--foreground)]">
                {session.avg_leak != null ? (session.avg_leak * 1000).toFixed(1) : '—'}
              </span>
              <InfoPopover title="Average leak">{statHelp.leak}</InfoPopover>
            </div>
            <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">mL/s · P95 {session.p95_pressure?.toFixed(1) ?? '—'} cmH₂O</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-5 pb-5 pt-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Resp rate</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-3xl font-semibold text-[var(--foreground)]">{session.avg_resp_rate?.toFixed(1) ?? '—'}</span>
              <InfoPopover title="Respiratory rate">{statHelp.respRate}</InfoPopover>
            </div>
            <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">breaths per minute</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-5 pb-5 pt-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Tidal volume</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-3xl font-semibold text-[var(--foreground)]">
                {session.avg_tidal_vol != null ? (session.avg_tidal_vol * 1000).toFixed(0) : '—'}
              </span>
              <InfoPopover title="Tidal volume">{statHelp.tidalVolume}</InfoPopover>
            </div>
            <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">mL</p>
          </CardContent>
        </Card>
      </div>

      <SessionAICard sessionId={sessionId} />

      <Card>
        <CardHeader>
          <CardTitle>Event Timeline</CardTitle>
          <CardDescription>Respiratory events across the session duration.</CardDescription>
        </CardHeader>
        <CardContent>
          <EventTimeline
            events={events}
            durationSeconds={session.duration_seconds}
            startDatetime={session.start_datetime}
          />
        </CardContent>
      </Card>

      <MetricsChart metrics={metrics} />
    </div>
  )
}
