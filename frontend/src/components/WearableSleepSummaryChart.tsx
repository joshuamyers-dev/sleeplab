import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import type { WearableDailySummary } from '../api/client'

interface Props {
  data: WearableDailySummary[]
}

const STAGE_COLORS = {
  awake_h: '#f87171',
  light_h: '#60a5fa',
  deep_h: '#34d399',
  rem_h: '#a78bfa',
}

const STAGE_LABELS = {
  awake_h: 'Awake',
  light_h: 'Light',
  deep_h: 'Deep',
  rem_h: 'REM',
}

export default function WearableSleepSummaryChart({ data }: Props) {
  if (data.length === 0) return null

  const chartData = data.map((d) => ({
    date: d.date.slice(5),
    awake_h: d.awake_h,
    light_h: d.light_h,
    deep_h: d.deep_h,
    rem_h: d.rem_h,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sleep Stage Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d8dcdd" />
            <XAxis dataKey="date" tick={{ fill: '#7d695d', fontSize: 11 }} interval={6} />
            <YAxis
              tick={{ fill: '#7d695d', fontSize: 11 }}
              label={{ value: 'hours', angle: -90, position: 'insideLeft', fill: '#7d695d', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(255,251,245,0.96)',
                border: '1px solid rgba(125,105,93,0.2)',
                borderRadius: 18,
                color: '#3c2b22',
              }}
              formatter={(val, name: string) => [
                typeof val === 'number' ? `${val.toFixed(1)}h` : '',
                STAGE_LABELS[name as keyof typeof STAGE_LABELS] ?? name,
              ]}
            />
            <Legend
              formatter={(value) => STAGE_LABELS[value as keyof typeof STAGE_LABELS] ?? value}
              wrapperStyle={{ fontSize: 12, color: '#7d695d' }}
            />
            {(Object.keys(STAGE_COLORS) as Array<keyof typeof STAGE_COLORS>).map((key) => (
              <Bar key={key} dataKey={key} stackId="stages" fill={STAGE_COLORS[key]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
