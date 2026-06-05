import type { Meta, StoryObj } from '@storybook/react'
import type { EventRecord } from '../api/client'
import EventTimeline from './EventTimeline'

const startDatetime = '2023-10-01T23:00:00Z'
const durationSeconds = 28800 // 8 hours

const events: EventRecord[] = [
  { id: 1, event_type: 'Obstructive Apnea', onset_seconds: 3600, duration_seconds: 15, event_datetime: '2023-10-02T00:00:00Z' },
  { id: 2, event_type: 'Hypopnea', onset_seconds: 7200, duration_seconds: 12, event_datetime: '2023-10-02T01:00:00Z' },
  { id: 3, event_type: 'Central Apnea', onset_seconds: 10800, duration_seconds: 18, event_datetime: '2023-10-02T02:00:00Z' },
  { id: 4, event_type: 'Obstructive Apnea', onset_seconds: 14400, duration_seconds: 20, event_datetime: '2023-10-02T03:00:00Z' },
  { id: 5, event_type: 'Hypopnea', onset_seconds: 18000, duration_seconds: 10, event_datetime: '2023-10-02T04:00:00Z' },
  { id: 6, event_type: 'Arousal', onset_seconds: 21600, duration_seconds: 5, event_datetime: '2023-10-02T05:00:00Z' },
]

const meta: Meta<typeof EventTimeline> = {
  title: 'Components/EventTimeline',
  component: EventTimeline,
  tags: ['autodocs'],
  args: { events, durationSeconds, startDatetime },
}

export default meta
type Story = StoryObj<typeof EventTimeline>

export const Default: Story = {}

export const WithSelection: Story = {
  args: { selectedEventId: 3 },
}

export const Empty: Story = {
  args: { events: [] },
}
