import type { Meta, StoryObj } from '@storybook/react'
import SessionAICard from './SessionAICard'

const meta: Meta<typeof SessionAICard> = {
  title: 'Components/SessionAICard',
  component: SessionAICard,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof SessionAICard>

export const Default: Story = {
  args: {} as any,
}
