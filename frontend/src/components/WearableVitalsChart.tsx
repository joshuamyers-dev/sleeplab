/**
 * Heart rate + SpO2 chart.
 *
 * Both signals share the same time axis.  Heart rate uses the left Y-axis
 * (bpm) and SpO2 uses the right Y-axis (%).  Either signal is omitted from
 * the legend if no data for it exists in the sample set.
 */

import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { WearableSample } from '../api/client'
import { getDisplayTz } from '../lib/displayTz'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

interface Props {
  samples: WearableSample[]
}

function fmtTs(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: getDisplayTz() })
}

export default function WearableVitalsChart({ samples }: Props) {
  const data = samples
    .filter(s => s.heart_rate !== null || s.spo2 !== null)
    .map(s => ({
      ts:         new Date(s.ts).getTime(),
      heart_rate: s.heart_rate,
      spo2:       s.spo2,
    }))

  if (data.length === 0) return null

  const hasHR   = data.some(d => d.heart_rate !== null)
  const hasSpo2 = data.some(d => d.spo2 !== null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Heart Rate &amp; SpO₂</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={data}>
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
            {hasHR && (
              <YAxis
                yAxisId="hr"
                domain={[30, 130]}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                label={{ value: 'bpm', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
              />
            )}
            {hasSpo2 && (
              <YAxis
                yAxisId="spo2"
                orientation="right"
                domain={[85, 100]}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                label={{ value: 'SpO₂ %', angle: 90, position: 'insideRight', fill: '#94a3b8', fontSize: 11 }}
              />
            )}
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12 }}
              labelStyle={{ color: '#f8fafc' }}
              labelFormatter={v => fmtTs(Number(v))}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(val: any, name: any) => {
                if (name === 'heart_rate') return [`${val} bpm`, 'Heart Rate']
                if (name === 'spo2') return [`${val}%`, 'SpO₂']
                return [String(val), String(name)]
              }}
            />
            <Legend formatter={v => v === 'heart_rate' ? 'Heart Rate' : 'SpO₂'} />
            {hasHR && (
              <Line
                yAxisId="hr"
                type="monotone"
                dataKey="heart_rate"
                stroke="#f87171"
                dot={false}
                strokeWidth={1.5}
                connectNulls={false}
              />
            )}
            {hasSpo2 && (
              <Line
                yAxisId="spo2"
                type="monotone"
                dataKey="spo2"
                stroke="#38bdf8"
                dot={false}
                strokeWidth={1.5}
                connectNulls={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
