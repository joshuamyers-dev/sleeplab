import type { Meta, StoryObj } from '@storybook/react'
import type { SpO2Response, WearableData } from '../api/client'
import SpO2Chart from './SpO2Chart'

const timestamps = [
  '2023-10-01T23:00:00Z', '2023-10-02T00:00:00Z', '2023-10-02T01:00:00Z',
  '2023-10-02T02:00:00Z', '2023-10-02T03:00:00Z', '2023-10-02T04:00:00Z',
  '2023-10-02T05:00:00Z', '2023-10-02T06:00:00Z', '2023-10-02T07:00:00Z',
]

const spo2: SpO2Response = {
  timestamps,
  spo2: [96, 95, 94, 93, 95, 96, 97, 96, 95],
  pulse: [62, 60, 58, 61, 63, 60, 59, 61, 62],
}

const wearable: WearableData = {
  hr: timestamps.map((timestamp, i) => ({ timestamp, value: 60 + i })),
  spo2: timestamps.map((timestamp, i) => ({ timestamp, value: 96 - i * 0.3 })),
  stages: timestamps.map((timestamp, i) => ({ timestamp, stage: (i % 4) + 1 })),
}

const meta: Meta<typeof SpO2Chart> = {
  title: 'Components/SpO2Chart',
  component: SpO2Chart,
  tags: ['autodocs'],
  args: { spo2 },
}

export default meta
type Story = StoryObj<typeof SpO2Chart>

export const Default: Story = {}

export const WithWearable: Story = {
  args: { wearable },
}

export const LowSpo2: Story = {
  args: {
    spo2: {
      ...spo2,
      spo2: [92, 89, 88, 87, 90, 91, 92, 93, 94],
    },
  },
}
