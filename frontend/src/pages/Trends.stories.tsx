import type { Meta, StoryObj } from '@storybook/react'
import { api } from '../api/client'
import type { SummaryStats, OverviewDailyStat, TrendAISummaryResponse, ImportSettings } from '../api/client'
import TrendsPage from './Trends'

const originalApi = { ...api }

// Mock data generation
function generateMockNights(count: number): OverviewDailyStat[] {
  const nights: OverviewDailyStat[] = []
  const today = new Date('2023-11-01T12:00:00Z')
  for (let i = count; i > 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const folder_date = d.toISOString().split('T')[0]
    nights.push({
      folder_date,
      session_id: `sess-${i}`,
      ahi: 1.5 + Math.random(),
      central_apnea_index: 0.2 + Math.random() * 0.5,
      obstructive_apnea_index: 0.5 + Math.random(),
      hypopnea_index: 0.8 + Math.random(),
      apnea_index: 0.7 + Math.random(),
      arousal_index: 5.0 + Math.random() * 2,
      usage_hours: 6 + Math.random() * 2,
      session_start_hour: 22 + Math.random(),
      session_end_hour: 6 + Math.random(),
      avg_pressure: 10 + Math.random() * 2,
      p95_pressure: 12 + Math.random() * 2,
      avg_leak: 5 + Math.random() * 5,
      large_leak_minutes: Math.random() > 0.8 ? 10 : 0,
      avg_flow_lim: 0.1 + Math.random() * 0.1,
      avg_tidal_vol: 450 + Math.random() * 100,
      avg_min_vent: 6 + Math.random(),
      avg_resp_rate: 14 + Math.random() * 3,
      min_spo2: 90 + Math.random() * 4,
      avg_spo2: 95 + Math.random() * 3,
      avg_pulse: 60 + Math.random() * 10,
      equipment_age_days: 30 - i > 0 ? 30 - i : 0,
    })
  }
  return nights
}

const mockSummary: SummaryStats = {
  total_nights: 150,
  nights_with_data: 145,
  compliance_pct: 95,
  avg_ahi: 2.1,
  avg_pressure: 10.5,
  ahi_trend: [],
  event_breakdown: {
    obstructive_apnea: 50,
    hypopnea: 120,
    central_apnea: 10,
  }
}

const mockOverviewStats = {
  nights: generateMockNights(30)
}

const mockImportSettings = {
  llm_configured: true,
} as unknown as ImportSettings

const mockTrendAISummary: TrendAISummaryResponse = {
  headline: 'Therapy is looking well-optimized',
  therapy_quality: 'AHI remains extremely low, and leaks are under control.',
  high_confidence_observations: [
    'AHI has remained below 2.0 for the past 14 days.',
    'Usage is excellent, averaging 7.5 hours per night.',
  ],
  possible_patterns: [
    'Slight increase in pressure around 3 AM correlates with REM sleep stages.',
  ],
  things_to_review: [
    'Check your mask cushion, as leak has slightly trended up over the past 3 days.',
  ],
  missing_or_uncertain: [],
  anomalies: [],
  trend_direction: 'stable',
  flag: 'good',
  cached: true,
  error: null,
}

const defaultApiMocks = {
  getSummary: () => Promise.resolve(mockSummary),
  getOverviewStats: () => Promise.resolve(mockOverviewStats),
  getImportSettings: () => Promise.resolve(mockImportSettings),
  getTrendAISummary: () => Promise.resolve(mockTrendAISummary),
}

const meta: Meta<typeof TrendsPage> = {
  title: 'Pages/Trends',
  component: TrendsPage,
  tags: ['autodocs', 'ai-generated'],
  decorators: [
    (Story, context) => {
      // Reset mocks before applying the story's mocks
      Object.assign(api, originalApi)
      if (context.parameters.apiMocks) {
        Object.assign(api, context.parameters.apiMocks)
      } else {
        Object.assign(api, defaultApiMocks)
      }
      return <Story />
    }
  ]
}

export default meta

type Story = StoryObj<typeof TrendsPage>

export const Default: Story = {
  parameters: {
    apiMocks: defaultApiMocks,
  }
}

export const Loading: Story = {
  parameters: {
    apiMocks: {
      ...defaultApiMocks,
      getSummary: () => new Promise(() => {}), // never resolves
      getOverviewStats: () => new Promise(() => {}), // never resolves
    }
  }
}

export const ErrorState: Story = {
  parameters: {
    apiMocks: {
      ...defaultApiMocks,
      getSummary: () => Promise.reject(new Error('Failed to load summary statistics from the server.')),
    }
  }
}

export const EmptyNights: Story = {
  parameters: {
    apiMocks: {
      ...defaultApiMocks,
      getOverviewStats: () => Promise.resolve({ nights: [] }),
    }
  }
}

export const AINotConfigured: Story = {
  parameters: {
    apiMocks: {
      ...defaultApiMocks,
      getImportSettings: () => Promise.resolve({
        ...mockImportSettings,
        llm_configured: false,
      }),
    }
  }
}

export const AILoading: Story = {
  parameters: {
    apiMocks: {
      ...defaultApiMocks,
      getTrendAISummary: () => new Promise(() => {}), // never resolves
    }
  }
}

export const AIError: Story = {
  parameters: {
    apiMocks: {
      ...defaultApiMocks,
      getTrendAISummary: () => Promise.resolve({ error: 'AI provider rate limit exceeded.' }),
    }
  }
}

export const AIFlagAlert: Story = {
  parameters: {
    apiMocks: {
      ...defaultApiMocks,
      getTrendAISummary: () => Promise.resolve({
        ...mockTrendAISummary,
        headline: 'Therapy needs attention',
        therapy_quality: 'AHI has been creeping up and there are sustained large leaks.',
        flag: 'alert',
        trend_direction: 'worsening',
      }),
    }
  }
}

export const AIFlagWatch: Story = {
  parameters: {
    apiMocks: {
      ...defaultApiMocks,
      getTrendAISummary: () => Promise.resolve({
        ...mockTrendAISummary,
        headline: 'Mixed results recently',
        therapy_quality: 'Events are slightly elevated over the weekend.',
        flag: 'watch',
        trend_direction: 'variable',
      }),
    }
  }
}
