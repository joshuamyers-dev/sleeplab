/**
 * Sleep stage hypnogram.
 *
 * Renders a step chart where the Y-axis has four discrete levels:
 *   4 = Awake   (top)
 *   3 = REM
 *   2 = Light
 *   1 = Deep    (bottom)
 *
 * This mirrors the conventional hypnogram orientation: deeper sleep is
 * visually lower on the chart.
 */

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import type { WearableSample } from '../api/client'
import { getDisplayTz } from '../lib/displayTz'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

interface Props {
  samples: WearableSample[]
}

const STAGE_LABELS: Record<number, string> = {
  1: 'Deep',
  2: 'Light',
  3: 'REM',
  4: 'Awake',
}

const STAGE_COLORS: Record<number, string> = {
  1: '#5251a7',  // deep — indigo
  2: '#38bdf8',  // light — sky
  3: '#4ade80',  // rem   — green
  4: '#94a3b8',  // awake — slate
}

function fmtTs(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: getDisplayTz() })
}

// Custom dot that colours each point by its stage value
function StageDot(props: { cx?: number; cy?: number; payload?: { stage: number | null } }) {
  const { cx, cy, payload } = props
  if (!payload?.stage || cx == null || cy == null) return null
  return <circle cx={cx} cy={cy} r={2} fill={STAGE_COLORS[payload.stage] ?? '#94a3b8'} />
}

export default function SleepStageChart({ samples }: Props) {
  const data = samples
    .filter(s => s.sleep_stage !== null)
    .map(s => ({
      ts:    new Date(s.ts).getTime(),
      stage: s.sleep_stage,
    }))

  if (data.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sleep Stages</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="mb-3 flex flex-wrap gap-3 text-xs text-[var(--muted-foreground)]">
          {([4, 3, 2, 1] as const).map(stage => (
            <span key={stage} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: STAGE_COLORS[stage] }} />
              {STAGE_LABELS[stage]}
            </span>
          ))}
        </div>

        <ResponsiveContainer width="100%" height={160}>
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
              domain={[0.5, 4.5]}
              ticks={[1, 2, 3, 4]}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickFormatter={v => STAGE_LABELS[v as number] ?? ''}
              width={40}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12 }}
              labelStyle={{ color: '#f8fafc' }}
              labelFormatter={v => fmtTs(Number(v))}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(val: any) => [STAGE_LABELS[val as number] ?? val, 'Stage']}
            />
            <Line
              type="stepAfter"
              dataKey="stage"
              stroke="#94a3b8"
              strokeWidth={1.5}
              dot={<StageDot />}
              activeDot={{ r: 4 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
