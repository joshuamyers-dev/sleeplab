import type { Meta, StoryObj } from '@storybook/react'
import type { SessionSummary } from '../api/client'
import CalendarHeatmap from './CalendarHeatmap'

function makeSession(date: string, ahi: number | null): SessionSummary {
  return {
    id: `sess-${date}`,
    session_id: `sess-${date}`,
    folder_date: date,
    block_index: 0,
    start_datetime: `${date}T23:00:00Z`,
    duration_seconds: 28800,
    duration_hours: 8,
    ahi,
    central_apnea_count: 2,
    obstructive_apnea_count: 5,
    hypopnea_count: 5,
    apnea_count: 7,
    arousal_count: 0,
    total_ahi_events: 12,
    avg_pressure: 10.2,
    p95_pressure: 12.0,
    avg_leak: 0.05,
    has_spo2: true,
    machine_tz: 'America/New_York',
  }
}

const sessions: SessionSummary[] = Array.from({ length: 60 }, (_, i) => {
  const d = new Date('2023-09-01')
  d.setDate(d.getDate() + i)
  const date = d.toISOString().split('T')[0]
  const ahi = i % 7 === 0 ? null : 1 + (i % 5) * 4
  return makeSession(date, ahi)
})

const meta: Meta<typeof CalendarHeatmap> = {
  title: 'Components/CalendarHeatmap',
  component: CalendarHeatmap,
  tags: ['autodocs'],
  args: { sessions },
}

export default meta
type Story = StoryObj<typeof CalendarHeatmap>

export const Default: Story = {}

export const Empty: Story = {
  args: { sessions: [] },
}

export const AllGood: Story = {
  args: {
    sessions: sessions.map((s) => ({ ...s, ahi: 1.5 })),
  },
}

export const MixedSeverity: Story = {
  args: {
    sessions: [
      makeSession('2023-10-01', 1.5),
      makeSession('2023-10-02', 12.0),
      makeSession('2023-10-03', 25.0),
      makeSession('2023-10-04', 45.0),
      makeSession('2023-10-05', null),
    ],
  },
}
