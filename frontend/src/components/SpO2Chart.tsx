import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { SpO2Response } from '../api/client'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

interface Props {
  data: SpO2Response
}

export default function SpO2Chart({ data }: Props) {
  const chartData = data.timestamps.map((ts, i) => ({
    ts: new Date(ts).getTime(),
    spo2: data.spo2[i],
    pulse: data.pulse[i],
  }))

  function fmtTs(ts: number) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const TICK_INTERVAL_MS = 30 * 60 * 1000
  const tsValues = chartData.map(d => d.ts)
  const minTs = tsValues.length > 0 ? Math.min(...tsValues) : 0
  const maxTs = tsValues.length > 0 ? Math.max(...tsValues) : 0
  const xTicks: number[] = []
  const firstTick = Math.ceil(minTs / TICK_INTERVAL_MS) * TICK_INTERVAL_MS
  for (let t = firstTick; t <= maxTs; t += TICK_INTERVAL_MS) xTicks.push(t)

  const commonXAxis = (
    <XAxis dataKey="ts" type="number" domain={['dataMin', 'dataMax']} scale="time"
      tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={fmtTs} ticks={xTicks} />
  )

  const commonProps = { data: chartData, margin: { top: 4, right: 16, left: 0, bottom: 0 } }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Oximetry</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)] mb-1">
            SpO₂ (%)
          </p>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              {commonXAxis}
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                domain={[80, 100]}
                ticks={[80, 85, 90, 95, 100]}
                width={36}
              />
              <ReferenceLine y={90} stroke="#f87171" strokeDasharray="4 3" strokeWidth={1} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12 }}
                labelStyle={{ color: '#f8fafc' }}
                labelFormatter={(v) => fmtTs(Number(v))}
                formatter={(val: number | undefined) => [
                  val != null ? `${val}%` : 'N/A',
                  'SpO₂',
                ]}
              />
              <Line type="monotone" dataKey="spo2" stroke="#818cf8" dot={false} strokeWidth={1.5} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">Dashed line at 90% — clinical desaturation threshold.</p>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)] mb-1">
            Pulse (bpm)
          </p>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              {commonXAxis}
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                domain={['auto', 'auto']}
                width={36}
              />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12 }}
                labelStyle={{ color: '#f8fafc' }}
                labelFormatter={(v) => fmtTs(Number(v))}
                formatter={(val: number | undefined) => [
                  val != null ? `${val} bpm` : 'N/A',
                  'Pulse',
                ]}
              />
              <Line type="monotone" dataKey="pulse" stroke="#f472b6" dot={false} strokeWidth={1.5} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
