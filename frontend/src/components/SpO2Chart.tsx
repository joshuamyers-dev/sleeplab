import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import type { SpO2Response, WearableData } from '../api/client'

/**
 * Properties and structure for the props.
 */
interface Props {
  spo2: SpO2Response
  wearable?: WearableData | null
}

/**
 * Helper function for format tick.
 */
function formatTick(iso: unknown): string {
  const d = new Date(String(iso ?? ''))
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/**
 * React component or element to render the sp o2 chart.
 *
 * @returns The rendered React element.
 */
export default function SpO2Chart({ spo2, wearable }: Props) {
  const hasWearable =
    wearable && (wearable.hr.length > 0 || wearable.spo2.length > 0)

  const byTs: Record<string, {
    ts: string
    cpapSpo2?: number | null
    cpapPulse?: number | null
    wearableSpo2?: number
    wearableHr?: number
  }> = {}

  spo2.timestamps.forEach((ts, i) => {
    byTs[ts] = { ts, cpapSpo2: spo2.spo2[i], cpapPulse: spo2.pulse[i] }
  })

  if (wearable) {
    wearable.spo2.forEach(({ timestamp, value }) => {
      byTs[timestamp] = { ...byTs[timestamp], ts: timestamp, wearableSpo2: value }
    })
    wearable.hr.forEach(({ timestamp, value }) => {
      byTs[timestamp] = { ...byTs[timestamp], ts: timestamp, wearableHr: value }
    })
  }

  const data = Object.values(byTs).sort((a, b) => (a.ts < b.ts ? -1 : 1))

  const tickInterval = Math.max(1, Math.floor(data.length / 8))

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle>Oximetry</CardTitle>
          {hasWearable && (
            <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-4 rounded-sm bg-[#6366f1]" />
                CPAP
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-4 rounded-sm bg-[#f59e0b]" />
                Wearable
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1 pb-4">
        <p className="text-xs font-semibold text-[var(--muted-foreground)]">SpO₂ (%)</p>
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.3} />
            <XAxis
              dataKey="ts"
              tickFormatter={formatTick}
              interval={tickInterval}
              tick={{ fill: '#7d695d', fontSize: 10 }}
            />
            <YAxis domain={[80, 100]} tick={{ fill: '#7d695d', fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                background: 'rgba(255,251,245,0.96)',
                border: '1px solid rgba(125,105,93,0.2)',
                borderRadius: 12,
                color: '#3c2b22',
                fontSize: 12,
              }}
              labelFormatter={formatTick}
            />
            <ReferenceLine y={90} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.7} />
            <Line
              type="monotone"
              dataKey="cpapSpo2"
              stroke="#6366f1"
              dot={false}
              strokeWidth={1.5}
              connectNulls
              name="CPAP SpO₂"
            />
            {hasWearable && (
              <Line
                type="monotone"
                dataKey="wearableSpo2"
                stroke="#f59e0b"
                dot={false}
                strokeWidth={1.5}
                connectNulls
                name="Wearable SpO₂"
              />
            )}
          </LineChart>
        </ResponsiveContainer>

        <p className="text-xs font-semibold text-[var(--muted-foreground)] pt-2">
          {hasWearable ? 'Pulse / HR (bpm)' : 'Pulse (bpm)'}
        </p>
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.3} />
            <XAxis
              dataKey="ts"
              tickFormatter={formatTick}
              interval={tickInterval}
              tick={{ fill: '#7d695d', fontSize: 10 }}
            />
            <YAxis domain={['auto', 'auto']} tick={{ fill: '#7d695d', fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                background: 'rgba(255,251,245,0.96)',
                border: '1px solid rgba(125,105,93,0.2)',
                borderRadius: 12,
                color: '#3c2b22',
                fontSize: 12,
              }}
              labelFormatter={formatTick}
            />
            <Line
              type="monotone"
              dataKey="cpapPulse"
              stroke="#818cf8"
              dot={false}
              strokeWidth={1.5}
              connectNulls
              name="CPAP Pulse"
            />
            {hasWearable && (
              <Line
                type="monotone"
                dataKey="wearableHr"
                stroke="#10b981"
                dot={false}
                strokeWidth={1.5}
                connectNulls
                name="Wearable HR"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
