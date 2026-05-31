import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../api/client'
import { getDisplayTz } from '../lib/displayTz'
import type { SessionDetail as SessionDetailType, EventRecord, MetricsResponse, SpO2Response, InferredEquipment, WearableData, EventWindowResponse } from '../api/client'
import WearableSleepStageChart from '../components/WearableSleepStageChart'
import { ChevronLeftIcon, ChevronRightIcon } from '../components/icons/ChevronIcons'
import EventInspector from '../components/EventInspector'
import EventTimeline from '../components/EventTimeline'
import InfoPopover from '../components/InfoPopover'
import MetricsChart from '../components/MetricsChartSplit'
import SpO2Chart from '../components/SpO2Chart'
import SessionAICard from '../components/SessionAICard'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: getDisplayTz() })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: getDisplayTz() })
}


function ahiBadge(ahi: number | null): { label: string; className: string } {
  if (ahi === null) return { label: 'No data', className: 'bg-[var(--surface-soft)] text-[var(--muted-foreground)]' }
  if (ahi < 5)  return { label: 'Good night', className: 'bg-[rgba(106,161,54,0.14)] text-[var(--green-700)]' }
  if (ahi < 15) return { label: 'Mild night', className: 'bg-[rgba(201,183,21,0.14)] text-[var(--yellow-700)]' }
  if (ahi < 30) return { label: 'Rough night', className: 'bg-[rgba(233,120,75,0.14)] text-[var(--orange-700)]' }
  return { label: 'Difficult night', className: 'bg-[var(--danger-soft)] text-[var(--danger-text)]' }
}

const EVENT_WINDOW_PRESETS: Record<number, { before: number; after: number }> = {
  1: { before: 30, after: 30 },
  3: { before: 60, after: 120 },
  5: { before: 120, after: 180 },
}

const EVENT_WINDOW_DOWNSAMPLE: Record<number, number> = {
  1: 1,
  3: 2,
  5: 3,
}

const EVENT_CODES: Record<string, string> = {
  'Central Apnea': 'CA',
  'Obstructive Apnea': 'OA',
  'Hypopnea': 'H',
  'Apnea': 'A',
  'Arousal': 'RE',
}

const EVENT_COLORS: Record<string, string> = {
  'Central Apnea': '#5251A7',
  'Obstructive Apnea': '#8E3D40',
  'Hypopnea': '#E9784B',
  'Apnea': '#C9B715',
  'Arousal': '#6AA136',
}

export default function SessionDetail() {
  const { date } = useParams<{ date: string }>()
  const navigate = useNavigate()
  const sessionDate = date ?? ''

  const [session, setSession] = useState<SessionDetailType | null>(null)
  const [events, setEvents] = useState<EventRecord[]>([])
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null)
  const [spo2, setSpo2] = useState<SpO2Response | null>(null)
  const [equipment, setEquipment] = useState<InferredEquipment | null>(null)
  const [loading, setLoading] = useState(true)
  const [prevNext, setPrevNext] = useState<{ prev: string | null; next: string | null }>({ prev: null, next: null })
  const [wearableData, setWearableData] = useState<WearableData | null>(null)
  const [timezoneDraft, setTimezoneDraft] = useState('')
  const [timezoneMessage, setTimezoneMessage] = useState<string | null>(null)
  const [timezoneError, setTimezoneError] = useState<string | null>(null)
  const [isTimezoneSubmitting, setIsTimezoneSubmitting] = useState(false)
  const [isTimezoneEditorOpen, setIsTimezoneEditorOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [noteMessage, setNoteMessage] = useState<string | null>(null)
  const [noteError, setNoteError] = useState<string | null>(null)
  const [isNoteSubmitting, setIsNoteSubmitting] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const [eventWindow, setEventWindow] = useState<EventWindowResponse | null>(null)
  const [eventWindowLoading, setEventWindowLoading] = useState(false)
  const [eventWindowMinutes, setEventWindowMinutes] = useState(3)
  const eventWindowCacheRef = useRef<Map<string, EventWindowResponse>>(new Map())

  useEffect(() => {
    setLoading(true)
    setSpo2(null)
    setEquipment(null)
    setWearableData(null)
    setTimezoneMessage(null)
    setTimezoneError(null)
    setIsTimezoneEditorOpen(false)
    setNoteMessage(null)
    setNoteError(null)
    setSelectedEventId(null)
    setEventWindow(null)
    setEventWindowLoading(false)
    eventWindowCacheRef.current.clear()
    Promise.all([
      api.getSessionByDate(sessionDate),
    ]).then(([s]) => {
      setSession(s)
      setTimezoneDraft(s.machine_tz ?? '')
      setNoteDraft(s.note ?? '')
      return Promise.all([
        api.getEvents(s.id),
        api.getMetrics(s.id, 15),
      ]).then(([e, m]) => {
        setEvents(e)
        setMetrics(m)
        setLoading(false)
        if (s.has_spo2) {
          api.getSessionSpo2(s.id).then(setSpo2).catch(() => setSpo2(null))
        }
        api.getInferredEquipment(s.folder_date.toString()).then(setEquipment).catch(() => setEquipment(null))
        api.getWearableData(s.folder_date).then((data) => {
          if (!data.hr.length && !data.spo2.length && !data.stages.length) {
            setWearableData(null)
            return
          }
          setWearableData(data)
        }).catch(() => setWearableData(null))
      })
    }).catch(() => navigate('/dashboard'))
  }, [navigate, sessionDate])

  useEffect(() => {
    if (!session) return
    api.getSessions({ per_page: 600 }).then(all => {
      const sorted = all
        
        .sort((a, b) => a.folder_date.localeCompare(b.folder_date))
      const idx = sorted.findIndex(s => s.folder_date === sessionDate)
      setPrevNext({
        prev: idx > 0 ? sorted[idx - 1].folder_date : null,
        next: idx < sorted.length - 1 ? sorted[idx + 1].folder_date : null,
      })
    })
  }, [session, sessionDate])

  useEffect(() => {
    if (!session || !selectedEventId) return
    const preset = EVENT_WINDOW_PRESETS[eventWindowMinutes] ?? EVENT_WINDOW_PRESETS[3]
    const waveformDownsample = EVENT_WINDOW_DOWNSAMPLE[eventWindowMinutes] ?? 2
    const cacheKey = `${selectedEventId}:${eventWindowMinutes}`
    const cached = eventWindowCacheRef.current.get(cacheKey)
    if (cached) {
      setEventWindow(cached)
      setEventWindowLoading(false)
      return
    }

    let cancelled = false
    setEventWindowLoading(true)
    api.getEventWindow(session.id, selectedEventId, {
      before_seconds: preset.before,
      after_seconds: preset.after,
      waveform_downsample: waveformDownsample,
    }).then((data) => {
      eventWindowCacheRef.current.set(cacheKey, data)
      if (!cancelled) setEventWindow(data)
    }).catch(() => {
      if (!cancelled) setEventWindow(null)
    }).finally(() => {
      if (!cancelled) setEventWindowLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [eventWindowMinutes, selectedEventId, session])

  function inspectEvent(event: EventRecord) {
    setSelectedEventId(event.id)
  }

  const selectedEventIndex = selectedEventId == null
    ? -1
    : events.findIndex((event) => event.id === selectedEventId)

  function inspectRelativeEvent(delta: -1 | 1) {
    if (selectedEventIndex < 0) return
    const nextEvent = events[selectedEventIndex + delta]
    if (nextEvent) {
      inspectEvent(nextEvent)
    }
  }

  useEffect(() => {
    if (!session || selectedEventIndex < 0) return
    const preset = EVENT_WINDOW_PRESETS[eventWindowMinutes] ?? EVENT_WINDOW_PRESETS[3]
    const waveformDownsample = EVENT_WINDOW_DOWNSAMPLE[eventWindowMinutes] ?? 2
    for (const neighborIndex of [selectedEventIndex - 1, selectedEventIndex + 1]) {
      const neighbor = events[neighborIndex]
      if (!neighbor) continue
      const cacheKey = `${neighbor.id}:${eventWindowMinutes}`
      if (eventWindowCacheRef.current.has(cacheKey)) continue
      api.getEventWindow(session.id, neighbor.id, {
        before_seconds: preset.before,
        after_seconds: preset.after,
        waveform_downsample: waveformDownsample,
      }).then((data) => {
        eventWindowCacheRef.current.set(cacheKey, data)
      }).catch(() => {
        // Prefetch is opportunistic; normal selection will retry if needed.
      })
    }
  }, [eventWindowMinutes, events, selectedEventIndex, session])

  async function handleTimezoneSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session) return
    setTimezoneError(null)
    setTimezoneMessage(null)
    setIsTimezoneSubmitting(true)
    try {
      const updated = await api.updateSessionTimezone(session.id, timezoneDraft)
      const [nextEvents, nextMetrics] = await Promise.all([
        api.getEvents(updated.id),
        api.getMetrics(updated.id, 15),
      ])
      setSession(updated)
      setTimezoneDraft(updated.machine_tz ?? '')
      setEvents(nextEvents)
      setMetrics(nextMetrics)
      setSelectedEventId(null)
      setEventWindow(null)
      eventWindowCacheRef.current.clear()
      if (updated.has_spo2) {
        api.getSessionSpo2(updated.id).then(setSpo2).catch(() => setSpo2(null))
      } else {
        setSpo2(null)
      }
      setTimezoneMessage('Session timezone updated.')
      setIsTimezoneEditorOpen(false)
    } catch (err) {
      setTimezoneError(err instanceof Error ? err.message : 'Could not update session timezone')
    } finally {
      setIsTimezoneSubmitting(false)
    }
  }

  async function handleNoteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session) return
    setNoteError(null)
    setNoteMessage(null)
    setIsNoteSubmitting(true)
    try {
      const updated = await api.updateSessionNote(session.id, noteDraft)
      setSession(updated)
      setNoteDraft(updated.note ?? '')
      setNoteMessage(updated.note ? 'Note saved.' : 'Note cleared.')
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : 'Could not save note')
    } finally {
      setIsNoteSubmitting(false)
    }
  }

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
  const secondaryStatContentClass = 'px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5'
  const secondaryStatLabelClass = 'text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)] sm:text-xs sm:tracking-[0.14em]'
  const secondaryStatValueClass = 'text-2xl font-semibold text-[var(--foreground)] sm:text-3xl'
  const secondaryStatNoteClass = 'mt-1.5 text-[11px] leading-4 text-[var(--muted-foreground)] sm:text-xs'

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
        <CardContent className="px-4 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
          {/* Top row: label + badge */}
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">Session detail</p>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${badge.className}`}>
              {badge.label}
            </span>
          </div>

          {/* Date + time */}
          <h1 className="mt-2 text-2xl font-extrabold text-[var(--foreground)] sm:text-3xl">
            {fmtDate(session.folder_date + 'T00:00:00')}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--muted-foreground)]">
            <span>{fmtTime(session.start_datetime)} – {fmtTime(endTime)}</span>
            {session.machine_tz ? (
              <span title="CPAP machine timezone used for import">· {session.machine_tz}</span>
            ) : (
              <span title="CPAP machine timezone was not recorded for this import">· timezone not recorded</span>
            )}
            <button
              type="button"
              className="ml-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-xs font-bold text-[var(--accent)] transition hover:border-[var(--accent-border)] hover:text-[var(--accent-hover)]"
              onClick={() => {
                setTimezoneDraft(session.machine_tz ?? '')
                setTimezoneError(null)
                setTimezoneMessage(null)
                setIsTimezoneEditorOpen((current) => !current)
              }}
            >
              {isTimezoneEditorOpen ? 'Cancel edit' : 'Edit'}
            </button>
          </div>

          {isTimezoneEditorOpen ? (
            <form className="mt-3 flex flex-col gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--surface-soft)] p-3 sm:flex-row sm:items-end" onSubmit={handleTimezoneSubmit}>
              <div className="space-y-2 sm:min-w-72">
                <Label htmlFor="sessionMachineTz">Correct machine timezone</Label>
                <Input
                  id="sessionMachineTz"
                  value={timezoneDraft}
                  onChange={(event) => setTimezoneDraft(event.target.value)}
                  autoComplete="off"
                  placeholder="America/New_York"
                />
              </div>
              <Button type="submit" disabled={isTimezoneSubmitting || !timezoneDraft}>
                {isTimezoneSubmitting ? 'Updating...' : 'Update timezone'}
              </Button>
            </form>
          ) : null}
          {timezoneMessage ? <p className="mt-2 text-sm font-medium text-[var(--olive-deep)]">{timezoneMessage}</p> : null}
          {timezoneError ? <p className="mt-2 text-sm text-[var(--danger-text)]">{timezoneError}</p> : null}

          {/* Three primary stat pills */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-[18px] bg-[rgba(82,81,167,0.08)] px-3 py-4 text-center sm:px-4">
              <p className={secondaryStatLabelClass}>AHI</p>
              <p className="mt-1.5 text-3xl font-semibold text-[var(--accent)]">
                {session.ahi?.toFixed(1) ?? '—'}
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">events/hr</p>
            </div>
            <div className="rounded-[18px] bg-[var(--surface-soft)] px-3 py-4 text-center sm:px-4">
              <p className={secondaryStatLabelClass}>Pressure</p>
              <p className="mt-1.5 text-3xl font-semibold text-[var(--foreground)]">
                {session.avg_pressure?.toFixed(1) ?? '—'}
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">cmH₂O</p>
            </div>
            <div className="rounded-[18px] bg-[rgba(106,161,54,0.08)] px-3 py-4 text-center sm:px-4">
              <p className={secondaryStatLabelClass}>Usage</p>
              <p className="mt-1.5 text-3xl font-semibold text-[var(--green-700)]">
                {hours}h {mins}m
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">of sleep</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card>
          <CardContent className={secondaryStatContentClass}>
            <p className={secondaryStatLabelClass}>Events</p>
            <div className="mt-2 flex items-end gap-2">
              <span className={secondaryStatValueClass}>{session.total_ahi_events}</span>
              <InfoPopover title="Events">{statHelp.events}</InfoPopover>
            </div>
            <p className={secondaryStatNoteClass}>
              CA {session.central_apnea_count} · OA {session.obstructive_apnea_count} · H {session.hypopnea_count}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className={secondaryStatContentClass}>
            <p className={secondaryStatLabelClass}>Avg leak</p>
            <div className="mt-2 flex items-end gap-2">
              <span className={secondaryStatValueClass}>
                {session.avg_leak != null ? (session.avg_leak * 1000).toFixed(1) : '—'}
              </span>
              <InfoPopover title="Average leak">{statHelp.leak}</InfoPopover>
            </div>
            <p className={secondaryStatNoteClass}>mL/s · P95 {session.p95_pressure?.toFixed(1) ?? '—'} cmH₂O</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className={secondaryStatContentClass}>
            <p className={secondaryStatLabelClass}>Resp rate</p>
            <div className="mt-2 flex items-end gap-2">
              <span className={secondaryStatValueClass}>{session.avg_resp_rate?.toFixed(1) ?? '—'}</span>
              <InfoPopover title="Respiratory rate">{statHelp.respRate}</InfoPopover>
            </div>
            <p className={secondaryStatNoteClass}>breaths per minute</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className={secondaryStatContentClass}>
            <p className={secondaryStatLabelClass}>Tidal volume</p>
            <div className="mt-2 flex items-end gap-2">
              <span className={secondaryStatValueClass}>
                {session.avg_tidal_vol != null ? (session.avg_tidal_vol * 1000).toFixed(0) : '—'}
              </span>
              <InfoPopover title="Tidal volume">{statHelp.tidalVolume}</InfoPopover>
            </div>
            <p className={secondaryStatNoteClass}>mL</p>
          </CardContent>
        </Card>
      </div>

      {/* Machine settings — only if any field is present */}
      {(session.therapy_mode || session.mask_type || session.humidity_level != null || session.temperature_c != null) && (
        <Card>
          <CardContent className={secondaryStatContentClass}>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)] mb-3">Device settings</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
              {session.therapy_mode && (
                <span><span className="text-[var(--muted-foreground)]">Mode </span>{session.therapy_mode.toUpperCase()}</span>
              )}
              {session.mask_type && (
                <span><span className="text-[var(--muted-foreground)]">Mask </span>{session.mask_type}</span>
              )}
              {session.humidity_level != null && (
                <span><span className="text-[var(--muted-foreground)]">Humidity </span>{session.humidity_level}</span>
              )}
              {session.temperature_c != null && (
                <span><span className="text-[var(--muted-foreground)]">Temp </span>{session.temperature_c}°C</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inferred equipment */}
      {equipment && (equipment.cushion || equipment.headgear || equipment.tubing || equipment.humidifier_chamber || equipment.filter) && (
        <Card>
          <CardContent className={secondaryStatContentClass}>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)] mb-3">Equipment this night</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                { key: 'cushion', label: 'Cushion' },
                { key: 'headgear', label: 'Headgear' },
                { key: 'tubing', label: 'Tubing' },
                { key: 'humidifier_chamber', label: 'Humidifier' },
                { key: 'filter', label: 'Filter' },
              ] as { key: keyof InferredEquipment; label: string }[]).map(({ key, label }) => {
                const item = equipment[key]
                if (!item) return null
                const name = [item.brand, item.model].filter(Boolean).join(' ') || label
                const category = item.mask_category ? ` · ${item.mask_category}` : ''
                const age = item.days_in_use != null ? `${item.days_in_use}d` : null
                const overdue = item.replacement_days != null && item.days_in_use != null
                  && item.days_in_use > item.replacement_days
                return (
                  <div key={key} className="rounded-[12px] bg-[var(--surface-soft)] px-3 py-2.5">
                    <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
                    <p className="text-sm font-medium">{name}{category}</p>
                    {age && (
                      <p className={`text-xs mt-0.5 ${overdue ? 'text-[var(--danger-text)]' : 'text-[var(--muted-foreground)]'}`}>
                        {age} old{overdue ? ' · overdue for replacement' : ''}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>{session.note ? 'Saved note for this night.' : 'No notes yet.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={handleNoteSubmit}>
            <Label htmlFor="sessionNote">Session note</Label>
            <textarea
              id="sessionNote"
              value={noteDraft}
              onChange={(event) => {
                setNoteDraft(event.target.value)
                setNoteError(null)
                setNoteMessage(null)
              }}
              className="min-h-28 w-full resize-y rounded-[14px] border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted-foreground)] focus:border-[var(--accent-border)] focus:ring-2 focus:ring-[rgba(82,81,167,0.16)]"
              placeholder="Tried mouth tape, had a late drink, felt congested..."
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {noteMessage ? <p className="text-sm font-medium text-[var(--olive-deep)]">{noteMessage}</p> : null}
                {noteError ? <p className="text-sm text-[var(--danger-text)]">{noteError}</p> : null}
              </div>
              <Button type="submit" disabled={isNoteSubmitting}>
                {isNoteSubmitting ? 'Saving...' : 'Save note'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <SessionAICard sessionId={session.id} />

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
            selectedEventId={selectedEventId}
            onSelectEvent={inspectEvent}
          />
          <EventTable
            events={events}
            selectedEventId={selectedEventId}
            onSelectEvent={inspectEvent}
          />
        </CardContent>
      </Card>

      {(selectedEventId || eventWindowLoading) && (
        <EventInspector
          data={eventWindow}
          loading={eventWindowLoading}
          windowMinutes={eventWindowMinutes}
          hasPreviousEvent={selectedEventIndex > 0}
          hasNextEvent={selectedEventIndex >= 0 && selectedEventIndex < events.length - 1}
          onWindowMinutesChange={setEventWindowMinutes}
          onPreviousEvent={() => inspectRelativeEvent(-1)}
          onNextEvent={() => inspectRelativeEvent(1)}
        />
      )}

      <MetricsChart metrics={metrics} />

      {spo2 && (
        <SpO2Chart spo2={spo2} wearable={wearableData} />
      )}

      {wearableData && wearableData.stages.length > 0 && (
        <WearableSleepStageChart stages={wearableData.stages} />
      )}
    </div>
  )
}

function EventTable({
  events,
  selectedEventId,
  onSelectEvent,
}: {
  events: EventRecord[]
  selectedEventId: number | null
  onSelectEvent: (event: EventRecord) => void
}) {
  if (!events.length) return null

  return (
    <div className="mt-5 overflow-hidden rounded-[14px] border border-[var(--border)]">
      <div className="max-h-52 overflow-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-[var(--surface-strong)] text-[var(--muted-foreground)]">
            <tr>
              <th className="px-3 py-2 font-bold uppercase tracking-[0.12em]">Code</th>
              <th className="px-3 py-2 font-bold uppercase tracking-[0.12em]">Time</th>
              <th className="px-3 py-2 font-bold uppercase tracking-[0.12em]">Duration</th>
              <th className="px-3 py-2 font-bold uppercase tracking-[0.12em]">Type</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              const selected = event.id === selectedEventId
              const color = EVENT_COLORS[event.event_type] ?? '#8E3D40'
              return (
                <tr
                  key={event.id}
                  title={`${EVENT_CODES[event.event_type] ?? event.event_type} at ${fmtTime(event.event_datetime)}`}
                  className={`cursor-pointer border-t border-[var(--border)] transition ${
                    selected ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--surface-soft)]'
                  }`}
                  onClick={() => onSelectEvent(event)}
                >
                  <td className="px-3 py-2">
                    <span
                      className="inline-flex min-w-8 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                      style={{ background: color }}
                    >
                      {EVENT_CODES[event.event_type] ?? event.event_type}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium text-[var(--foreground)]">
                    {fmtTime(event.event_datetime)}
                  </td>
                  <td className="px-3 py-2 text-[var(--muted-foreground)]">
                    {event.duration_seconds ? `${event.duration_seconds}s` : '-'}
                  </td>
                  <td className="px-3 py-2 text-[var(--muted-foreground)]">
                    {event.event_type}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
