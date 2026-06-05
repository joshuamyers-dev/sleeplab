import type { Meta, StoryObj } from '@storybook/react'
import type { WearableDailySummary } from '../api/client'
import WearableSleepSummaryChart from './WearableSleepSummaryChart'

const data: WearableDailySummary[] = Array.from({ length: 14 }, (_, i) => {
  const d = new Date('2023-10-01')
  d.setDate(d.getDate() + i)
  return {
    date: d.toISOString().split('T')[0],
    avg_hr: 58 + Math.random() * 8,
    avg_spo2: 95 + Math.random() * 2,
    awake_h: 0.5 + Math.random() * 0.5,
    light_h: 2.5 + Math.random(),
    deep_h: 1.5 + Math.random(),
    rem_h: 1.5 + Math.random(),
  }
})

const meta: Meta<typeof WearableSleepSummaryChart> = {
  title: 'Components/WearableSleepSummaryChart',
  component: WearableSleepSummaryChart,
  tags: ['autodocs'],
  args: { data },
}

export default meta
type Story = StoryObj<typeof WearableSleepSummaryChart>

export const Default: Story = {}

export const Empty: Story = {
  args: { data: [] },
}
