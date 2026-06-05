import type { Meta, StoryObj } from '@storybook/react'
import InfoPopover from './InfoPopover'

const meta: Meta<typeof InfoPopover> = {
  title: 'Components/InfoPopover',
  component: InfoPopover,
  tags: ['autodocs'],
  args: {
    title: 'AHI',
    children: 'Apnea-Hypopnea Index — the average number of breathing interruptions per hour of sleep. Below 5 is normal.',
  },
}

export default meta
type Story = StoryObj<typeof InfoPopover>

export const Default: Story = {}

export const LongContent: Story = {
  args: {
    title: 'Leak Rate',
    children: 'Leak rate measures how much air escapes from your mask or tubing per minute. A small amount of intentional leak is normal for most mask types. Large leaks can reduce therapy effectiveness and cause noise.',
  },
}
