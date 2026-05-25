import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts'
import type { MetricsResponse } from '../api/client'
import { getDisplayTz } from '../lib/displayTz'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

interface Props {
  metrics: MetricsResponse
}

export default function MetricsChartSplit({ metrics }: Props) {
  const GAP_THRESHOLD_MS = 5 * 60 * 1000

  const rawData = metrics.timestamps.map((ts, i) => ({
    ts: new Date(ts).getTime(),
    pressure: metrics.pressure[i],
    leak: metrics.leak[i] != null ? metrics.leak[i]! * 1000 : null,
    resp_rate: metrics.resp_rate[i],
    flow_lim: metrics.flow_lim[i],
    snore: metrics.snore[i],
    min_vent: metrics.min_vent[i],
  }))

  const pressureVals = rawData.map(d => d.pressure).filter((p): p is number => p !== null && p > 0)
  const MIN_PRESSURE = pressureVals.length > 0 ? Math.min(...pressureVals) : 4.0

  const data: typeof rawData = []
  let inGap = false
  for (let i = 0; i < rawData.length; i++) {
    const isGap = i > 0 && rawData[i].ts - rawData[i - 1].ts > GAP_THRESHOLD_MS
    if (isGap) {
      data.push({ ts: rawData[i - 1].ts + 1, pressure: null as any, leak: null as any, resp_rate: null as any, flow_lim: null as any, snore: null as any, min_vent: null as any })
      inGap = true
    }
    if (inGap && rawData[i].pressure !== null && (rawData[i].pressure ?? 0) <= MIN_PRESSURE) continue
    if (inGap && rawData[i].pressure !== null && (rawData[i].pressure ?? 0) > MIN_PRESSURE) {
      data.push({ ts: rawData[i].ts - 1, pressure: null as any, leak: null as any, resp_rate: null as any, flow_lim: null as any, snore: null as any, min_vent: null as any })
      inGap = false
    }
    data.push(rawData[i])
  }

  function fmtTs(ts: number) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: getDisplayTz() })
  }

  const TICK_INTERVAL_MS = 30 * 60 * 1000
  const tsValues = data.map(d => d.ts).filter(t => t != null)
  const minTs = tsValues.length > 0 ? Math.min(...tsValues) : 0
  const maxTs = tsValues.length > 0 ? Math.max(...tsValues) : 0
  const xTicks: number[] = []
  const firstTick = Math.ceil(minTs / TICK_INTERVAL_MS) * TICK_INTERVAL_MS
  for (let t = firstTick; t <= maxTs; t += TICK_INTERVAL_MS) xTicks.push(t)

  function makeTicks(dataKey: string, padding: number): { domain: [number, number], ticks: number[] } {
    const vals = data
      .map(d => (d as any)[dataKey] as number | null)
      .filter((v): v is number => v !== null && !isNaN(v))
    if (vals.length === 0) return { domain: [0, 10], ticks: [0, 2.5, 5, 7.5, 10] }
    const lo = Math.max(0, Math.floor(Math.min(...vals)) - padding)
    const hi = Math.ceil(Math.max(...vals)) + padding
    const step = (hi - lo) / 4
    const ticks = [0, 1, 2, 3, 4].map(i => Math.round((lo + i * step) * 100) / 100)
    return { domain: [ticks[0], ticks[4]], ticks }
  }

  const panels = [
    { title: 'Pressure', dataKey: 'pressure', stroke: '#38bdf8', unit: 'cmH₂O', ...makeTicks('pressure', 1) },
    { title: 'Resp Rate', dataKey: 'resp_rate', stroke: '#4ade80', unit: 'bpm', domain: [0, 40] as [number, number], ticks: [0, 10, 20, 30, 40] },
    { title: 'Leak', dataKey: 'leak', stroke: '#fb923c', unit: 'mL/s', ...makeTicks('leak', 0) },
    { title: 'Flow Limitation', dataKey: 'flow_lim', stroke: '#f472b6', unit: '', ...makeTicks('flow_lim', 0) },
    { title: 'Snore', dataKey: 'snore', stroke: '#a78bfa', unit: '', ...makeTicks('snore', 0) },
    { title: 'Min Ventilation', dataKey: 'min_vent', stroke: '#34d399', unit: 'L/min', ...makeTicks('min_vent', 1) },
  ]

  const commonXAxis = (
    <XAxis dataKey="ts" type="number" domain={['dataMin', 'dataMax']} scale="time"
      tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={fmtTs} ticks={xTicks} />
  )

  const commonProps = { data, margin: { top: 4, right: 16, left: 0, bottom: 0 } }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Night Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {panels.map((panel) => (
          <div key={panel.dataKey}>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)] mb-1">
              {panel.title}{panel.unit ? ` (${panel.unit})` : ''}
            </p>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart {...commonProps}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                {commonXAxis}
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  domain={panel.domain}
                  ticks={panel.ticks}
                  width={36}
                />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12 }}
                  labelStyle={{ color: '#f8fafc' }}
                  labelFormatter={(v) => fmtTs(Number(v))}
                  formatter={(val) => [
                    val != null ? `${(val as number).toFixed(2)} ${panel.unit}` : 'N/A',
                    panel.title
                  ]}
                />
                <Line type="monotone" dataKey={panel.dataKey} stroke={panel.stroke} dot={false} strokeWidth={1.5} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
