import type { Meta, StoryObj } from '@storybook/react'
import type { DailyStat } from '../api/client'
import AHITrendChart from './AHITrendChart'

const trend: DailyStat[] = Array.from({ length: 30 }, (_, i) => {
  const d = new Date('2023-10-01')
  d.setDate(d.getDate() + i)
  return {
    folder_date: d.toISOString().split('T')[0],
    ahi: 1 + Math.sin(i / 3) * 2 + Math.random(),
    duration_hours: 7 + Math.random(),
    session_id: `sess-${i}`,
  }
})

const meta: Meta<typeof AHITrendChart> = {
  title: 'Components/AHITrendChart',
  component: AHITrendChart,
  tags: ['autodocs'],
  args: { trend },
}

export default meta
type Story = StoryObj<typeof AHITrendChart>

export const Default: Story = {}

export const Worsening: Story = {
  args: {
    trend: trend.map((d, i) => ({ ...d, ahi: 2 + i * 0.5 })),
  },
}

export const Empty: Story = {
  args: { trend: [] },
}
