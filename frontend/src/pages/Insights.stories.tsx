import type { Meta, StoryObj } from '@storybook/react'

import type { AISummaryResponse, ImportSettings, SummaryStats } from '../api/client'
import { api } from '../api/client'
import InsightsPage from './Insights'

const meta: Meta<typeof InsightsPage> = {
  title: 'Pages/Insights',
  component: InsightsPage,
  tags: ['autodocs', 'ai-generated'],
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta
type Story = StoryObj<typeof InsightsPage>

/**
 * Helper decorator to mock the API calls used by InsightsPage and its child components.
 */
const createApiDecorator = (
  summaryData: Partial<SummaryStats> | Error | 'loading',
  settingsData: Partial<ImportSettings> | Error | 'loading',
  aiSummaryData?: Partial<AISummaryResponse> | Error | 'loading' | null
) => {
  return (Story: any) => {
    // Mock getSummary
    if (summaryData === 'loading') {
      api.getSummary = () => new Promise(() => {})
    } else if (summaryData instanceof Error) {
      api.getSummary = () => Promise.reject(summaryData)
    } else {
      api.getSummary = () =>
        Promise.resolve({
          total_nights: 30,
          nights_with_data: 25,
          compliance_pct: 85,
          avg_ahi: 1.5,
          avg_pressure: 10.2,
          ahi_trend: [],
          event_breakdown: {},
          ...summaryData,
        } as SummaryStats)
    }

    // Mock getImportSettings
    if (settingsData === 'loading') {
      api.getImportSettings = () => new Promise(() => {})
    } else if (settingsData instanceof Error) {
      api.getImportSettings = () => Promise.reject(settingsData)
    } else {
      api.getImportSettings = () =>
        Promise.resolve({
          llm_configured: true,
          ...settingsData,
        } as ImportSettings)
    }

    // Mock getAISummary (used by the nested AISummaryCard component)
    if (aiSummaryData === 'loading') {
      api.getAISummary = () => new Promise(() => {})
    } else if (aiSummaryData instanceof Error) {
      api.getAISummary = () => Promise.reject(aiSummaryData)
    } else if (aiSummaryData !== null && aiSummaryData !== undefined) {
      api.getAISummary = () =>
        Promise.resolve({
          headline: 'Excellent therapy performance.',
          therapy_quality: 'Your sleep metrics indicate optimal therapy over the last 30 days.',
          high_confidence_observations: [
            'AHI remains consistently below 2',
            'Usage is consistently above 6 hours per night',
          ],
          possible_patterns: ['Minor leak spikes around 3 AM on weekends'],
          things_to_review: ['Check mask fit to resolve sporadic leaks'],
          missing_or_uncertain: [],
          cached: true,
          flag: 'good',
          ...aiSummaryData,
        } as AISummaryResponse)
    }

    return (
      <div className="p-6">
        <Story />
      </div>
    )
  }
}

export const Loading: Story = {
  decorators: [createApiDecorator('loading', 'loading')],
}

export const ErrorState: Story = {
  decorators: [
    createApiDecorator(new Error('Failed to fetch summary data'), { llm_configured: true }),
  ],
}

export const EmptyNoAIConfigured: Story = {
  decorators: [
    createApiDecorator({ nights_with_data: 0 }, { llm_configured: false }),
  ],
}

export const EmptyWithAIConfigured: Story = {
  decorators: [
    createApiDecorator({ nights_with_data: 0 }, { llm_configured: true }),
  ],
}

export const ReadyNoAIConfigured: Story = {
  decorators: [
    createApiDecorator({ nights_with_data: 25 }, { llm_configured: false }),
  ],
}

export const ReadyWithAILoading: Story = {
  decorators: [
    createApiDecorator({ nights_with_data: 25 }, { llm_configured: true }, 'loading'),
  ],
}

export const ReadyWithAIError: Story = {
  decorators: [
    createApiDecorator(
      { nights_with_data: 25 },
      { llm_configured: true },
      new Error('Failed to connect to LLM provider')
    ),
  ],
}

export const ReadyWithAI: Story = {
  decorators: [
    createApiDecorator({ nights_with_data: 25 }, { llm_configured: true }, {}),
  ],
}
