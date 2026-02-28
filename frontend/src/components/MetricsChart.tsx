import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts'
import type { MetricsResponse } from '../api/client'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

interface Props {
  metrics: MetricsResponse
}

export default function MetricsChart({ metrics }: Props) {
  const data = metrics.timestamps.map((ts, i) => ({
    ts: new Date(ts).getTime(),
    pressure: metrics.pressure[i],
    leak: metrics.leak[i],
    resp_rate: metrics.resp_rate[i],
    flow_lim: metrics.flow_lim[i],
  }))

  function fmtTs(ts: number) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
              domain={[4, 20]}
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
              formatter={(val: number | undefined, name: string | undefined) => {
                const labels: Record<string, string> = {
                  pressure: 'Pressure (cmH₂O)',
                  leak: 'Leak (L/s)',
                  resp_rate: 'Resp Rate (bpm)',
                  flow_lim: 'Flow Lim',
                }
                const key = name ?? ''
                return [(val ?? 0).toFixed(2), labels[key] ?? key]
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
