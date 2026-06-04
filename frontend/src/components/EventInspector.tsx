import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { EventRecord, EventWindowResponse } from '../api/client'
import { getDisplayTz } from '../lib/displayTz'
import { ChevronLeftIcon, ChevronRightIcon } from './icons/ChevronIcons'
import { Card, CardContent, CardTitle } from './ui/card'
import { Button } from './ui/button'

/**
 * Properties and structure for the props.
 */
interface Props {
  data: EventWindowResponse | null
  loading: boolean
  windowMinutes: number
  hasPreviousEvent: boolean
  hasNextEvent: boolean
  onClose?: () => void
  onWindowMinutesChange: (minutes: number) => void
  onPreviousEvent: () => void
  onNextEvent: () => void
}

/**
 * Helper function for fmt ts.
 */
function fmtTs(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: getDisplayTz(),
  })
}

/**
 * Helper function for fmt event time.
 */
function fmtEventTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: getDisplayTz(),
  })
}

/**
 * Helper function for stat.
 */
function stat(values: (number | null)[], mode: 'min' | 'max' | 'avg') {
  const nums = values.filter((v): v is number => v !== null && Number.isFinite(v))
  if (!nums.length) return null
  if (mode === 'min') return Math.min(...nums)
  if (mode === 'max') return Math.max(...nums)
  return nums.reduce((sum, v) => sum + v, 0) / nums.length
}

/**
 * Helper function for flow domain.
 */
function flowDomain(values: (number | null)[]): [number, number] {
  const absVals = values
    .filter((v): v is number => v !== null && Number.isFinite(v))
    .map((v) => Math.abs(v))
    .sort((a, b) => a - b)
  if (!absVals.length) return [-1, 1]
  const p99 = absVals[Math.min(absVals.length - 1, Math.floor(absVals.length * 0.99))]
  const bound = Math.max(0.5, Math.ceil(p99 * 12) / 10)
  return [-bound, bound]
}

/**
 * React component or element to render the e v e n t_ c o d e s.
 *
 * @returns The rendered React element.
 */
const EVENT_CODES: Record<string, string> = {
  'Central Apnea': 'CA',
  'Obstructive Apnea': 'OA',
  'Hypopnea': 'H',
  'Apnea': 'A',
  'Arousal': 'RE',
}

/**
 * React component or element to render the e v e n t_ c o l o r s.
 *
 * @returns The rendered React element.
 */
const EVENT_COLORS: Record<string, string> = {
  'Central Apnea': '#5251A7',
  'Obstructive Apnea': '#8E3D40',
  'Hypopnea': '#E9784B',
  'Apnea': '#C9B715',
  'Arousal': '#6AA136',
}

/**
 * Helper function for event bounds.
 */
function eventBounds(event: EventRecord): { startTs: number; endTs: number } {
  const endTs = new Date(event.event_datetime).getTime()
  const durationMs = Math.max((event.duration_seconds ?? 2) * 1000, 2000)
  return { startTs: endTs - durationMs, endTs }
}

/**
 * React component or element to render the event band.
 *
 * @returns The rendered React element.
 */
function EventBand({
  startTs,
  endTs,
  eventType,
  selected,
}: {
  startTs: number
  endTs: number
  eventType: string
  selected: boolean
}) {
  const midTs = startTs + (endTs - startTs) / 2
  const label = EVENT_CODES[eventType] ?? eventType
  const color = EVENT_COLORS[eventType] ?? '#8E3D40'
  return (
    <>
      <ReferenceArea
        x1={startTs}
        x2={endTs}
        fill="#64748b"
        fillOpacity={selected ? 0.16 : 0.07}
        stroke="#94a3b8"
        strokeOpacity={selected ? 0.65 : 0.3}
      />
      <ReferenceLine x={startTs} stroke="#94a3b8" strokeDasharray="4 4" strokeOpacity={selected ? 0.7 : 0.3} />
      <ReferenceLine x={endTs} stroke="#94a3b8" strokeDasharray="4 4" strokeOpacity={selected ? 0.7 : 0.3} />
      <ReferenceLine
        x={midTs}
        stroke="transparent"
        label={{
          value: label,
          position: 'insideTop',
          fill: color,
          fontSize: selected ? 11 : 10,
          fontWeight: 700,
        }}
      />
    </>
  )
}

/**
 * React component or element to render the event bands.
 *
 * @returns The rendered React element.
 */
function EventBands({ data }: { data: EventWindowResponse }) {
  const events = data.neighboring_events.length ? data.neighboring_events : [data.event]
  const selected = events.find((event) => event.id === data.event.id)
  const neighbors = events.filter((event) => event.id !== data.event.id)
  return (
    <>
      {neighbors.map((event) => {
        const { startTs, endTs } = eventBounds(event)
        return <EventBand key={event.id} startTs={startTs} endTs={endTs} eventType={event.event_type} selected={false} />
      })}
      {selected ? (
        <EventBand
          startTs={eventBounds(selected).startTs}
          endTs={eventBounds(selected).endTs}
          eventType={selected.event_type}
          selected
        />
      ) : null}
    </>
  )
}

/**
 * React component or element to render the event inspector.
 *
 * @returns The rendered React element.
 */
export default function EventInspector({
  data,
  loading,
  windowMinutes,
  hasPreviousEvent,
  hasNextEvent,
  onClose,
  onWindowMinutesChange,
  onPreviousEvent,
  onNextEvent,
}: Props) {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-3 px-5 py-5 text-sm text-[var(--muted-foreground)]">
          <span>Loading event window...</span>
          <div className="flex flex-wrap justify-end gap-2">
            {onClose ? (
              <Button variant="outline" size="sm" onClick={onClose}>
                Hide inspector
              </Button>
            ) : null}
            <WindowControls value={windowMinutes} onChange={onWindowMinutesChange} />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 px-5 py-5 text-sm text-[var(--muted-foreground)] sm:flex-row sm:items-center sm:justify-between">
          <span>Event window data is not available for this event.</span>
          {onClose ? (
            <Button variant="outline" size="sm" onClick={onClose}>
              Hide inspector
            </Button>
          ) : null}
        </CardContent>
      </Card>
    )
  }

  const waveform = data.waveform.timestamps.map((ts, i) => ({
    ts: new Date(ts).getTime(),
    flow: data.waveform.flow[i],
    pressure: data.waveform.pressure[i],
  }))
  const metrics = data.metrics.timestamps.map((ts, i) => ({
    ts: new Date(ts).getTime(),
    leak: data.metrics.leak[i] != null ? data.metrics.leak[i]! * 1000 : null,
    flowLim: data.metrics.flow_lim[i],
    respRate: data.metrics.resp_rate[i],
  }))

  const flowMin = stat(data.waveform.flow, 'min')
  const flowMax = stat(data.waveform.flow, 'max')
  const pressureAvg = stat(data.waveform.pressure, 'avg')
  const leakMax = stat(metrics.map((m) => m.leak), 'max')
  const flowYDomain = flowDomain(data.waveform.flow)

  const chartProps = {
    margin: { top: 8, right: 18, left: 0, bottom: 0 },
  }

  const axis = (
    <XAxis
      dataKey="ts"
      type="number"
      domain={['dataMin', 'dataMax']}
      scale="time"
      tick={{ fill: '#64748b', fontSize: 11 }}
      tickFormatter={fmtTs}
    />
  )

  return (
    <Card>
      <div className="p-5 pb-0 sm:p-6 sm:pb-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Event Inspector</CardTitle>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {data.event.event_type} at {fmtEventTime(data.event.event_datetime)}
              {data.event.duration_seconds ? ` for ${data.event.duration_seconds}s` : ''}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex flex-wrap justify-end gap-2">
              {onClose ? (
                <Button variant="outline" size="sm" onClick={onClose}>
                  Hide inspector
                </Button>
              ) : null}
              <div className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-soft)] p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-full px-2"
                  disabled={!hasPreviousEvent}
                  aria-label="Previous event"
                  title="Previous event"
                  onClick={onPreviousEvent}
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-full px-2"
                  disabled={!hasNextEvent}
                  aria-label="Next event"
                  title="Next event"
                  onClick={onNextEvent}
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
              </div>
              <WindowControls value={windowMinutes} onChange={onWindowMinutesChange} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div className="rounded-[12px] bg-[var(--surface-soft)] px-3 py-2">
                <p className="text-[var(--muted-foreground)]">Flow min/max</p>
                <p className="font-semibold">{flowMin?.toFixed(2) ?? '-'} / {flowMax?.toFixed(2) ?? '-'}</p>
              </div>
              <div className="rounded-[12px] bg-[var(--surface-soft)] px-3 py-2">
                <p className="text-[var(--muted-foreground)]">Avg pressure</p>
                <p className="font-semibold">{pressureAvg?.toFixed(1) ?? '-'} cmH2O</p>
              </div>
              <div className="rounded-[12px] bg-[var(--surface-soft)] px-3 py-2">
                <p className="text-[var(--muted-foreground)]">Max leak</p>
                <p className="font-semibold">{leakMax?.toFixed(0) ?? '-'} mL/s</p>
              </div>
              <div className="rounded-[12px] bg-[var(--surface-soft)] px-3 py-2">
                <p className="text-[var(--muted-foreground)]">Samples</p>
                <p className="font-semibold">{waveform.length.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <CardContent className="space-y-5">
        {waveform.length ? (
          <>
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                Flow rate (L/s)
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={waveform} {...chartProps}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d8d6cc" />
                  {axis}
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    width={42}
                    domain={flowYDomain}
                    allowDataOverflow
                  />
                  <Tooltip
                    labelFormatter={(v) => fmtTs(Number(v))}
                    formatter={(val) => [val != null ? `${Number(val).toFixed(3)} L/s` : 'N/A', 'Flow']}
                  />
                  <EventBands data={data} />
                  <Line type="monotone" dataKey="flow" stroke="#5251A7" dot={false} strokeWidth={1.15} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                Mask pressure (cmH2O)
              </p>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={waveform} {...chartProps}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d8d6cc" />
                  {axis}
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} width={42} domain={['auto', 'auto']} />
                  <Tooltip
                    labelFormatter={(v) => fmtTs(Number(v))}
                    formatter={(val) => [val != null ? `${Number(val).toFixed(2)} cmH2O` : 'N/A', 'Pressure']}
                  />
                  <EventBands data={data} />
                  <Line type="monotone" dataKey="pressure" stroke="#0f766e" dot={false} strokeWidth={1.2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="rounded-[18px] border border-dashed border-[var(--border)] bg-[var(--surface-soft)] p-5 text-sm text-[var(--muted-foreground)]">
            No BRP waveform samples were found in this event window. The event may fall between BRP segments, the
            source archive may not include BRP data for this time, or the night may need to be re-imported after
            migrations.
          </div>
        )}

        {metrics.length ? (
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              Nearby leak and flow limitation
            </p>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={metrics} {...chartProps}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d8d6cc" />
                {axis}
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} width={42} />
                <Tooltip labelFormatter={(v) => fmtTs(Number(v))} />
                <EventBands data={data} />
                <Line type="monotone" dataKey="leak" name="Leak mL/s" stroke="#E9784B" dot={false} strokeWidth={1.4} />
                <Line type="monotone" dataKey="flowLim" name="Flow limitation" stroke="#6AA136" dot={false} strokeWidth={1.4} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

/**
 * React component or element to render the window controls.
 *
 * @returns The rendered React element.
 */
function WindowControls({ value, onChange }: { value: number; onChange: (minutes: number) => void }) {
  return (
    <div className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-soft)] p-1 text-xs">
      {[1, 3, 5].map((minutes) => (
        <button
          key={minutes}
          type="button"
          className={`rounded-full px-3 py-1 font-semibold transition ${
            value === minutes
              ? 'bg-[var(--accent)] text-white'
              : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
          onClick={() => onChange(minutes)}
        >
          {minutes}m
        </button>
      ))}
    </div>
  )
}
