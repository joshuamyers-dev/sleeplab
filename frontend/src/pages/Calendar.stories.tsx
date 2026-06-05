import type { Meta, StoryObj } from '@storybook/react'
import CalendarPage from './Calendar'
import { api } from '../api/client'
import type { SessionSummary } from '../api/client'

const mockSessions: SessionSummary[] = [
  {
    id: '1',
    session_id: 's1',
    folder_date: '2023-10-01',
    block_index: 0,
    start_datetime: '2023-10-01T22:00:00Z',
    duration_seconds: 28800,
    duration_hours: 8,
    ahi: 2.5, // Normal (< 5)
    central_apnea_count: 0,
    obstructive_apnea_count: 5,
    hypopnea_count: 10,
    apnea_count: 5,
    arousal_count: 20,
    total_ahi_events: 15,
    avg_pressure: 10,
    p95_pressure: 12,
    avg_leak: 5,
    has_spo2: true,
    machine_tz: 'America/New_York',
  },
  {
    id: '2',
    session_id: 's2',
    folder_date: '2023-10-02',
    block_index: 0,
    start_datetime: '2023-10-02T22:30:00Z',
    duration_seconds: 25200,
    duration_hours: 7,
    ahi: 8.5, // Mild (5 - 15)
    central_apnea_count: 2,
    obstructive_apnea_count: 10,
    hypopnea_count: 45,
    apnea_count: 12,
    arousal_count: 30,
    total_ahi_events: 57,
    avg_pressure: 11,
    p95_pressure: 13,
    avg_leak: 8,
    has_spo2: false,
    machine_tz: 'America/New_York',
  },
  {
    id: '3',
    session_id: 's3',
    folder_date: '2023-10-03',
    block_index: 0,
    start_datetime: '2023-10-03T23:00:00Z',
    duration_seconds: 21600,
    duration_hours: 6,
    ahi: 18.0, // Moderate (15 - 30)
    central_apnea_count: 5,
    obstructive_apnea_count: 20,
    hypopnea_count: 83,
    apnea_count: 25,
    arousal_count: 50,
    total_ahi_events: 108,
    avg_pressure: 12,
    p95_pressure: 14,
    avg_leak: 15,
    has_spo2: true,
    machine_tz: 'America/New_York',
  },
  {
    id: '4',
    session_id: 's4',
    folder_date: '2023-10-04',
    block_index: 0,
    start_datetime: '2023-10-04T22:15:00Z',
    duration_seconds: 27000,
    duration_hours: 7.5,
    ahi: 35.0, // Severe (30+)
    central_apnea_count: 10,
    obstructive_apnea_count: 50,
    hypopnea_count: 200,
    apnea_count: 60,
    arousal_count: 100,
    total_ahi_events: 260,
    avg_pressure: 15,
    p95_pressure: 18,
    avg_leak: 30,
    has_spo2: false,
    machine_tz: 'America/New_York',
  },
  {
    id: '5',
    session_id: 's5',
    folder_date: '2023-10-05',
    block_index: 0,
    start_datetime: '2023-10-05T22:00:00Z',
    duration_seconds: 28800,
    duration_hours: 8,
    ahi: 1.2, // Normal
    central_apnea_count: 0,
    obstructive_apnea_count: 2,
    hypopnea_count: 8,
    apnea_count: 2,
    arousal_count: 10,
    total_ahi_events: 10,
    avg_pressure: 9,
    p95_pressure: 10,
    avg_leak: 2,
    has_spo2: true,
    machine_tz: 'America/New_York',
  },
  {
    id: '6',
    session_id: 's6',
    folder_date: '2023-10-06',
    block_index: 0,
    start_datetime: '2023-10-06T22:00:00Z',
    duration_seconds: 28800,
    duration_hours: 8,
    ahi: null, // No Data Available
    central_apnea_count: 0,
    obstructive_apnea_count: 0,
    hypopnea_count: 0,
    apnea_count: 0,
    arousal_count: 0,
    total_ahi_events: 0,
    avg_pressure: 10,
    p95_pressure: 12,
    avg_leak: 5,
    has_spo2: false,
    machine_tz: 'America/New_York',
  },
]

const meta: Meta<typeof CalendarPage> = {
  title: 'Pages/Calendar',
  component: CalendarPage,
  tags: ['autodocs', 'ai-generated'],
  decorators: [
    (Story, context) => {
      const { mockGetSessions } = context.parameters
      if (mockGetSessions) {
        api.getSessions = mockGetSessions
      }
      return <Story />
    },
  ],
}

export default meta
type Story = StoryObj<typeof CalendarPage>

export const Populated: Story = {
  parameters: {
    mockGetSessions: async () => mockSessions,
  },
}

export const Loading: Story = {
  parameters: {
    mockGetSessions: () => new Promise((resolve) => setTimeout(resolve, 1000000)), // Simulate hanging request
  },
}

export const ErrorState: Story = {
  parameters: {
    mockGetSessions: () => Promise.reject(new Error('Failed to load calendar data. Please check your network connection.')),
  },
}

export const Empty: Story = {
  parameters: {
    mockGetSessions: async () => [],
  },
}

export const SingleDay: Story = {
  parameters: {
    mockGetSessions: async () => [mockSessions[0]],
  },
}
