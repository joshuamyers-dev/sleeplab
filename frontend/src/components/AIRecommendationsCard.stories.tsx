import type { Meta, StoryObj } from '@storybook/react'
import AIRecommendationsCard from './AIRecommendationsCard'

const meta: Meta<typeof AIRecommendationsCard> = {
  title: 'Components/AIRecommendationsCard',
  component: AIRecommendationsCard,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof AIRecommendationsCard>

export const Default: Story = {
  args: {} as any,
}
