import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts'
import type { MetricsResponse } from '../api/client'
import { getDisplayTz } from '../lib/displayTz'
import { computeMetricsDomain, emptyMetricPoint, metricsToPoints, type MetricKey } from './metricsChartDomain'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

interface Props {
  metrics: MetricsResponse
}

type PanelDefinition = {
  title: string
  dataKey: MetricKey
  stroke: string
  unit: string
  domain: [number, number]
  ticks: number[]
}

const GAP_THRESHOLD_MS = 5 * 60 * 1000

export default function MetricsChartSplit({ metrics }: Props) {
  const rawData = metricsToPoints(metrics)
  const xDomain = computeMetricsDomain(rawData)
  const domainStart = xDomain?.[0] ?? 0
  const domainEnd = xDomain?.[1] ?? 0

  const pressureVals = rawData.map(d => d.pressure).filter((p): p is number => p !== null && p > 0)
  const MIN_PRESSURE = pressureVals.length > 0 ? Math.min(...pressureVals) : 4.0

  const data: typeof rawData = []
  let inGap = false
  for (let i = 0; i < rawData.length; i++) {
    const isGap = i > 0 && rawData[i].ts - rawData[i - 1].ts > GAP_THRESHOLD_MS
    if (isGap) {
      data.push(emptyMetricPoint(rawData[i - 1].ts + 1))
      inGap = true
    }
    if (inGap && rawData[i].pressure !== null && (rawData[i].pressure ?? 0) <= MIN_PRESSURE) continue
    if (inGap && rawData[i].pressure !== null && (rawData[i].pressure ?? 0) > MIN_PRESSURE) {
      data.push(emptyMetricPoint(rawData[i].ts - 1))
      inGap = false
    }
    data.push(rawData[i])
  }
  const domainData = xDomain ? data.filter((point) => point.ts >= domainStart && point.ts <= domainEnd) : data

  function fmtTs(ts: number) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: getDisplayTz() })
  }

  const TICK_INTERVAL_MS = 60 * 60 * 1000
  const xTicks: number[] = []
  if (xDomain) {
    const firstTick = Math.ceil(domainStart / TICK_INTERVAL_MS) * TICK_INTERVAL_MS
    for (let t = firstTick; t <= domainEnd; t += TICK_INTERVAL_MS) xTicks.push(t)
  }

  function makeTicks(dataKey: MetricKey, padding: number): { domain: [number, number], ticks: number[] } {
    const vals = domainData
      .map(d => d[dataKey])
      .filter((v): v is number => v !== null && !isNaN(v))
    if (vals.length === 0) return { domain: [0, 10], ticks: [0, 2.5, 5, 7.5, 10] }
    const lo = Math.max(0, Math.floor(Math.min(...vals)) - padding)
    const hi = Math.ceil(Math.max(...vals)) + padding
    const step = (hi - lo) / 4
    const ticks = [0, 1, 2, 3, 4].map(i => Math.round((lo + i * step) * 100) / 100)
    return { domain: [ticks[0], ticks[4]], ticks }
  }

  const panels: PanelDefinition[] = [
    { title: 'Pressure', dataKey: 'pressure', stroke: '#38bdf8', unit: 'cmH₂O', ...makeTicks('pressure', 1) },
    { title: 'Resp Rate', dataKey: 'resp_rate', stroke: '#4ade80', unit: 'bpm', domain: [0, 40] as [number, number], ticks: [0, 10, 20, 30, 40] },
    { title: 'Leak', dataKey: 'leak', stroke: '#fb923c', unit: 'mL/s', ...makeTicks('leak', 0) },
    { title: 'Flow Limitation', dataKey: 'flow_lim', stroke: '#f472b6', unit: '', ...makeTicks('flow_lim', 0) },
    { title: 'Snore', dataKey: 'snore', stroke: '#a78bfa', unit: '', ...makeTicks('snore', 0) },
    { title: 'Min Ventilation', dataKey: 'min_vent', stroke: '#34d399', unit: 'L/min', ...makeTicks('min_vent', 1) },
  ]

  const commonXAxis = (
    <XAxis
      dataKey="ts"
      type="number"
      domain={xDomain ?? ['dataMin', 'dataMax']}
      scale="time"
      tick={{ fill: '#7d695d', fontSize: 10 }}
      tickFormatter={fmtTs}
      ticks={xTicks}
      minTickGap={32}
    />
  )

  const commonProps = { data: domainData, margin: { top: 4, right: 16, left: 0, bottom: 0 } }

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
            {domainData.some((point) => point[panel.dataKey] != null) ? (
              <ResponsiveContainer width="100%" height={150}>
                <LineChart {...commonProps}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(125,105,93,0.18)" vertical={false} />
                  {commonXAxis}
                  <YAxis
                    tick={{ fill: '#7d695d', fontSize: 10 }}
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
            ) : (
              <div className="flex h-[150px] items-center rounded-[12px] border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-4 text-sm text-[var(--muted-foreground)]">
                No {panel.title.toLowerCase()} samples in the main therapy window.
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
