import type { Meta, StoryObj } from '@storybook/react'

import Dashboard from './Dashboard'
import { api } from '../api/client'
import type { 
  SummaryStats, 
  SessionSummary, 
  WearableDailySummary, 
  AISummaryResponse, 
  ImportSettings 
} from '../api/client'

const mockSummaryPopulated: SummaryStats = {
  total_nights: 30,
  nights_with_data: 28,
  compliance_pct: 93.3,
  avg_ahi: 2.4,
  avg_pressure: 10.2,
  ahi_trend: [
    { folder_date: '2023-10-01', ahi: 3.1, duration_hours: 7.5, session_id: '1' },
    { folder_date: '2023-10-02', ahi: 2.2, duration_hours: 8.0, session_id: '2' },
    { folder_date: '2023-10-03', ahi: 1.8, duration_hours: 6.5, session_id: '3' },
    { folder_date: '2023-10-04', ahi: 2.5, duration_hours: 7.2, session_id: '4' },
    { folder_date: '2023-10-05', ahi: 1.5, duration_hours: 6.8, session_id: '5' },
  ],
  event_breakdown: {
    obstructive_apnea: 15,
    central_apnea: 2,
    hypopnea: 20,
  },
}

const mockSessionsPopulated: SessionSummary[] = [
  {
    id: '1',
    session_id: '1',
    folder_date: '2023-10-01',
    block_index: 0,
    start_datetime: '2023-10-01T22:00:00Z',
    duration_seconds: 27000,
    duration_hours: 7.5,
    ahi: 3.1,
    central_apnea_count: 0,
    obstructive_apnea_count: 5,
    hypopnea_count: 10,
    apnea_count: 5,
    arousal_count: 0,
    total_ahi_events: 15,
    avg_pressure: 10.0,
    p95_pressure: 11.0,
    avg_leak: 2.0,
    has_spo2: false,
    machine_tz: 'UTC',
  },
  {
    id: '2',
    session_id: '2',
    folder_date: '2023-10-02',
    block_index: 0,
    start_datetime: '2023-10-02T22:30:00Z',
    duration_seconds: 28800,
    duration_hours: 8.0,
    ahi: 2.2,
    central_apnea_count: 1,
    obstructive_apnea_count: 3,
    hypopnea_count: 8,
    apnea_count: 4,
    arousal_count: 2,
    total_ahi_events: 14,
    avg_pressure: 10.5,
    p95_pressure: 11.5,
    avg_leak: 1.5,
    has_spo2: true,
    machine_tz: 'UTC',
  },
]

const mockWearableSummaryPopulated: WearableDailySummary[] = [
  {
    date: '2023-10-01',
    avg_hr: 60,
    avg_spo2: 96,
    awake_h: 0.5,
    light_h: 4.0,
    deep_h: 1.5,
    rem_h: 1.5,
  },
  {
    date: '2023-10-02',
    avg_hr: 58,
    avg_spo2: 97,
    awake_h: 0.3,
    light_h: 4.2,
    deep_h: 1.8,
    rem_h: 1.7,
  },
]

const mockImportSettings = {
  llm_configured: true,
} as ImportSettings

const mockAISummary: AISummaryResponse = {
  headline: 'Therapy is looking great.',
  therapy_quality: 'Your treatment is well managed with a very low number of events.',
  high_confidence_observations: ['Good overall compliance', 'AHI remains below 5'],
  possible_patterns: ['Slightly higher events on weekends'],
  things_to_review: ['Mask seal might be slipping on some nights'],
  missing_or_uncertain: [],
  cached: true,
}

const meta: Meta<typeof Dashboard> = {
  title: 'Pages/Dashboard',
  component: Dashboard,
  tags: ['autodocs', 'ai-generated'],
}

export default meta
type Story = StoryObj<typeof Dashboard>

export const Loading: Story = {
  decorators: [
    (Story) => {
      // Mock APIs to never resolve to simulate loading state
      api.getSummary = () => new Promise(() => {})
      api.getSessions = () => new Promise(() => {})
      return <Story />
    },
  ],
}

export const ErrorState: Story = {
  name: 'Error',
  decorators: [
    (Story) => {
      // Mock APIs to reject to simulate error state
      api.getSummary = () => Promise.reject(new Error('Failed to connect to API'))
      api.getSessions = () => Promise.reject(new Error('Failed to connect to API'))
      return <Story />
    },
  ],
}

export const Empty: Story = {
  decorators: [
    (Story) => {
      // Mock APIs to return empty data
      api.getSummary = () => Promise.resolve({
        total_nights: 0,
        nights_with_data: 0,
        compliance_pct: 0,
        avg_ahi: null,
        avg_pressure: null,
        ahi_trend: [],
        event_breakdown: {},
      })
      api.getSessions = () => Promise.resolve([])
      return <Story />
    },
  ],
}

export const Populated: Story = {
  decorators: [
    (Story) => {
      // Mock APIs to return full data
      api.getSummary = () => Promise.resolve(mockSummaryPopulated)
      api.getSessions = () => Promise.resolve(mockSessionsPopulated)
      api.getWearableSummary = () => Promise.resolve(mockWearableSummaryPopulated)
      api.getImportSettings = () => Promise.resolve(mockImportSettings)
      api.getAISummary = () => Promise.resolve(mockAISummary)
      return <Story />
    },
  ],
}
