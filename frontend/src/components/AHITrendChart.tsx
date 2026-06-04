import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

import type { DailyStat } from '../api/client'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

type ChartMetric = 'ahi' | 'leak' | 'pressure'

interface PerDayExtra {
  pressure: number | null
  leak: number | null
}

interface FlaggedNight {
  date: string
  severity: 'high' | 'warn'
}

interface Props {
  trend: DailyStat[]
  perDayData?: Record<string, PerDayExtra>
  flaggedNights?: FlaggedNight[]
}

const METRICS: { key: ChartMetric; label: string; yLabel: string; unit: string }[] = [
  { key: 'ahi', label: 'AHI', yLabel: 'AHI', unit: '' },
  { key: 'leak', label: 'Leak', yLabel: 'L/min', unit: ' L/min' },
  { key: 'pressure', label: 'Pressure', yLabel: 'cmH2O', unit: ' cmH2O' },
]

function flaggedDotColor(severity: FlaggedNight['severity']): string {
  return severity === 'high' ? 'var(--danger-text)' : 'var(--orange-500)'
}

export default function AHITrendChart({ trend, perDayData, flaggedNights = [] }: Props) {
  const navigate = useNavigate()
  const [metric, setMetric] = useState<ChartMetric>('ahi')

  const metricMeta = METRICS.find((m) => m.key === metric) ?? METRICS[0]
  const flaggedByDate = new Map(flaggedNights.map((night) => [night.date, night.severity]))

  const data = trend.map((d) => ({
    date: d.folder_date,
    ahi: d.ahi,
    pressure: perDayData?.[d.folder_date]?.pressure ?? null,
    leak: perDayData?.[d.folder_date]?.leak ?? null,
    hours: d.duration_hours,
    flaggedSeverity: flaggedByDate.get(d.folder_date) ?? null,
  }))

  type ChartPoint = typeof data[number]

  const renderDot = (props: unknown) => {
    const { cx, cy, payload } = props as { cx?: number; cy?: number; payload?: ChartPoint }
    if (typeof cx !== 'number' || typeof cy !== 'number' || !payload?.flaggedSeverity) {
      return null
    }

    return (
      <circle
        key={`dot-${payload.date}`}
        cx={cx}
        cy={cy}
        r={4}
        fill={flaggedDotColor(payload.flaggedSeverity)}
        stroke="var(--surface-strong)"
        strokeWidth={1.5}
      />
    )
  }

  function handleChartClick(event: unknown) {
    const payload = (event as { activePayload?: Array<{ payload?: ChartPoint }> })?.activePayload?.[0]?.payload
    if (payload?.date) {
      navigate(`/sessions/${payload.date}`)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Trend (last 90 nights)</CardTitle>
          <div className="flex self-start rounded-full border border-[var(--border)] bg-[var(--surface-soft)] p-1 sm:self-auto">
            {METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-bold transition sm:px-3 sm:py-1.5 sm:text-xs ${
                  metric === m.key
                    ? 'bg-[var(--surface-strong)] text-[var(--accent)]'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
                onClick={() => setMetric(m.key)}
                aria-pressed={metric === m.key}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} onClick={handleChartClick}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              tickFormatter={(value: string) => value.slice(5)}
              interval={13}
            />
            <YAxis
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              domain={[0, 'auto']}
              label={{ value: metricMeta.yLabel, angle: -90, position: 'insideLeft', fill: 'var(--muted-foreground)', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--popover-surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                color: 'var(--foreground)',
              }}
              labelStyle={{ color: 'var(--foreground)' }}
              formatter={(value) => [
                typeof value === 'number' ? `${value.toFixed(1)}${metricMeta.unit}` : '-',
                metricMeta.label,
              ]}
            />
            {metric === 'ahi' ? (
              <ReferenceLine
                y={5}
                stroke="var(--green-500)"
                strokeDasharray="4 4"
                label={{ value: 'therapy target', fill: 'var(--green-700)', fontSize: 10 }}
              />
            ) : null}
            <Line
              type="monotone"
              dataKey={metric}
              stroke="var(--accent)"
              dot={renderDot}
              activeDot={{ r: 5 }}
              strokeWidth={1.75}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
