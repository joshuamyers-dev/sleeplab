import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts'
import type { MetricsResponse } from '../api/client'
import { getDisplayTz } from '../lib/displayTz'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

/**
 * Properties and structure for the props.
 */
interface Props {
  metrics: MetricsResponse
}

/**
 * React component or element to render the metrics chart.
 *
 * @returns The rendered React element.
 */
export default function MetricsChart({ metrics }: Props) {
  const GAP_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes
  const rawData = metrics.timestamps.map((ts, i) => ({
    ts: new Date(ts).getTime(),
    pressure: metrics.pressure[i],
    leak: metrics.leak[i],
    resp_rate: metrics.resp_rate[i],
    flow_lim: metrics.flow_lim[i],
  }))
  const pressureVals = rawData.map(d => d.pressure).filter((p): p is number => p !== null && p > 0)
  const MIN_PRESSURE = pressureVals.length > 0 ? Math.min(...pressureVals) : 4.0
  const data: typeof rawData = []
  let inGap = false
  for (let i = 0; i < rawData.length; i++) {
    const isGap = i > 0 && rawData[i].ts - rawData[i - 1].ts > GAP_THRESHOLD_MS
    if (isGap) {
      data.push({ ts: rawData[i - 1].ts + 1, pressure: null as any, leak: null as any, resp_rate: null as any, flow_lim: null as any })
      inGap = true
    }
    // Skip leading ramp-up points at minimum pressure after a gap
    if (inGap && rawData[i].pressure !== null && (rawData[i].pressure ?? 0) <= MIN_PRESSURE) {
      continue
    }
    if (inGap && rawData[i].pressure !== null && (rawData[i].pressure ?? 0) > MIN_PRESSURE) {
      data.push({ ts: rawData[i].ts - 1, pressure: null as any, leak: null as any, resp_rate: null as any, flow_lim: null as any })
      inGap = false
    }
    data.push(rawData[i])
  }

  function fmtTs(ts: number) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: getDisplayTz() })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Night Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="ts"
              type="number"
              domain={['dataMin', 'dataMax']}
              scale="time"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickFormatter={fmtTs}
              tickCount={8}
            />
            <YAxis
              yAxisId="pressure"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              domain={(() => {
                const vals = data.filter(d => d.pressure !== null).map(d => d.pressure as number)
                const lo = vals.length > 0 ? Math.floor(Math.min(...vals)) - 2 : 2
                const hi = vals.length > 0 ? Math.ceil(Math.max(...vals)) + 2 : 20
                return [Math.max(0, lo), hi]
              })()}
              ticks={(() => {
                const vals = data.filter(d => d.pressure !== null).map(d => d.pressure as number)
                const lo = vals.length > 0 ? Math.floor(Math.min(...vals)) - 2 : 2
                const hi = vals.length > 0 ? Math.ceil(Math.max(...vals)) + 2 : 20
                const result = []
                for (let i = Math.max(0, lo); i <= hi; i += 2) result.push(i)
                return result
              })()}
              label={{ value: 'cmH₂O', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
            />
            <YAxis
              yAxisId="rate"
              orientation="right"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              domain={[0, 40]}
              label={{ value: 'bpm / L/s×10', angle: 90, position: 'insideRight', fill: '#94a3b8', fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12 }}
              labelStyle={{ color: '#f8fafc' }}
              labelFormatter={(v) => fmtTs(Number(v))}
              formatter={(val, name) => {
                const labels: Record<string, string> = {
                  pressure: 'Pressure (cmH₂O)',
                  leak: 'Leak (L/s)',
                  resp_rate: 'Resp Rate (bpm)',
                  flow_lim: 'Flow Lim',
                }
                const key = (name as string) ?? ''
                return [((val as number) ?? 0).toFixed(2), labels[key] ?? key]
              }}
            />
            <Legend
              formatter={(val) => {
                const m: Record<string, string> = {
                  pressure: 'Pressure',
                  leak: 'Leak',
                  resp_rate: 'Resp Rate',
                  flow_lim: 'Flow Lim',
                }
                return m[val] ?? val
              }}
            />
            <Line yAxisId="pressure" type="monotone" dataKey="pressure" stroke="#38bdf8" dot={false} strokeWidth={1.5} />
            <Line yAxisId="rate" type="monotone" dataKey="resp_rate" stroke="#4ade80" dot={false} strokeWidth={1} />
            <Line yAxisId="rate" type="monotone" dataKey="leak" stroke="#fb923c" dot={false} strokeWidth={1} />
            <Line yAxisId="rate" type="monotone" dataKey="flow_lim" stroke="#f472b6" dot={false} strokeWidth={1} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
