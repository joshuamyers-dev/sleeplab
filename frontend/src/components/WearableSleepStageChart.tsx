import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import type { WearableData } from '../api/client'

/**
 * Properties and structure for the props.
 */
interface Props {
  stages: WearableData['stages']
}

/**
 * React component or element to render the s t a g e_ l a b e l s.
 *
 * @returns The rendered React element.
 */
const STAGE_LABELS: Record<number, string> = {
  1: 'Awake',
  2: 'Light',
  3: 'Deep',
  4: 'REM',
}

/**
 * Helper function for invert stage.
 */
function invertStage(stage: number): number {
  return 5 - stage
}

/**
 * Helper function for format tick.
 */
function formatTick(iso: unknown): string {
  return new Date(String(iso ?? '')).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/**
 * React component or element to render the wearable sleep stage chart.
 *
 * @returns The rendered React element.
 */
export default function WearableSleepStageChart({ stages }: Props) {
  if (stages.length === 0) return null

  const data = stages.map(({ timestamp, stage }) => ({
    ts: timestamp,
    stage: invertStage(stage),
    stageLabel: STAGE_LABELS[stage] ?? 'Unknown',
  }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Sleep Stages</CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.3} />
            <XAxis
              dataKey="ts"
              tickFormatter={formatTick}
              interval={Math.max(1, Math.floor(data.length / 8))}
              tick={{ fill: '#7d695d', fontSize: 10 }}
            />
            <YAxis
              domain={[1, 4]}
              ticks={[1, 2, 3, 4]}
              tickFormatter={(v) => STAGE_LABELS[5 - v] ?? ''}
              tick={{ fill: '#7d695d', fontSize: 10 }}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(255,251,245,0.96)',
                border: '1px solid rgba(125,105,93,0.2)',
                borderRadius: 12,
                color: '#3c2b22',
                fontSize: 12,
              }}
              labelFormatter={formatTick}
              formatter={(_, __, props) => [
                props.payload.stageLabel, 'Stage',
              ]}
            />
            <Line
              type="stepAfter"
              dataKey="stage"
              stroke="#8b5cf6"
              dot={false}
              strokeWidth={2}
              name="Stage"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
