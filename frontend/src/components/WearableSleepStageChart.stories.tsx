import type { Meta, StoryObj } from '@storybook/react'
import type { WearableData } from '../api/client'
import WearableSleepStageChart from './WearableSleepStageChart'

const stages: WearableData['stages'] = [
  { timestamp: '2023-10-01T23:00:00Z', stage: 1 },
  { timestamp: '2023-10-01T23:30:00Z', stage: 2 },
  { timestamp: '2023-10-02T00:00:00Z', stage: 3 },
  { timestamp: '2023-10-02T00:30:00Z', stage: 4 },
  { timestamp: '2023-10-02T01:00:00Z', stage: 2 },
  { timestamp: '2023-10-02T01:30:00Z', stage: 3 },
  { timestamp: '2023-10-02T02:00:00Z', stage: 4 },
  { timestamp: '2023-10-02T02:30:00Z', stage: 2 },
  { timestamp: '2023-10-02T03:00:00Z', stage: 1 },
  { timestamp: '2023-10-02T03:30:00Z', stage: 2 },
  { timestamp: '2023-10-02T06:30:00Z', stage: 1 },
  { timestamp: '2023-10-02T07:00:00Z', stage: 1 },
]

const meta: Meta<typeof WearableSleepStageChart> = {
  title: 'Components/WearableSleepStageChart',
  component: WearableSleepStageChart,
  tags: ['autodocs'],
  args: { stages },
}

export default meta
type Story = StoryObj<typeof WearableSleepStageChart>

export const Default: Story = {}

export const MostlyDeep: Story = {
  args: {
    stages: stages.map((s) => ({ ...s, stage: s.stage === 1 ? 1 : 3 })),
  },
}
