import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import type { DailyStat } from '../api/client'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

interface Props {
  trend: DailyStat[]
}

export default function AHITrendChart({ trend }: Props) {
  const navigate = useNavigate()

  const data = trend.map(d => ({
    date: d.folder_date,
    ahi: d.ahi,
    sessionId: d.session_id,
    hours: d.duration_hours,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>AHI Trend (last 90 nights)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} onClick={(e) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const payload = e as any
            if (payload?.activePayload?.[0]?.payload?.sessionId) {
              navigate(`/sessions/${payload.activePayload[0].payload.sessionId}`)
            }
          }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d8dcdd" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#7d695d', fontSize: 11 }}
              tickFormatter={(v) => v.slice(5)}
              interval={13}
            />
            <YAxis
              tick={{ fill: '#7d695d', fontSize: 11 }}
              domain={[0, 'auto']}
              label={{ value: 'AHI', angle: -90, position: 'insideLeft', fill: '#7d695d', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{ background: 'rgba(255,251,245,0.96)', border: '1px solid rgba(125,105,93,0.2)', borderRadius: 18, color: '#3c2b22' }}
              labelStyle={{ color: '#3c2b22' }}
              formatter={(val: number | undefined) => [(val ?? 0).toFixed(1), 'AHI']}
            />
            <ReferenceLine y={5} stroke="#6AA136" strokeDasharray="4 4" label={{ value: 'Normal', fill: '#6AA136', fontSize: 10 }} />
            <ReferenceLine y={15} stroke="#E9784B" strokeDasharray="4 4" label={{ value: 'Moderate', fill: '#E9784B', fontSize: 10 }} />
            <Line
              type="monotone"
              dataKey="ahi"
              stroke="#5251A7"
              dot={false}
              strokeWidth={1.75}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
