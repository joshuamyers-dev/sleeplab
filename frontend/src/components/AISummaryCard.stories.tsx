import type { Meta, StoryObj } from '@storybook/react'
import AISummaryCard from './AISummaryCard'

const meta: Meta<typeof AISummaryCard> = {
  title: 'Components/AISummaryCard',
  component: AISummaryCard,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof AISummaryCard>

export const Default: Story = {
  args: {} as any,
}
