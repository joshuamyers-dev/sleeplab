import type { Meta, StoryObj } from '@storybook/react'
import type { MetricsResponse } from '../api/client'
import MetricsChartSplit from './MetricsChartSplit'

const timestamps = [
  '2023-10-01T23:00:00Z', '2023-10-02T00:00:00Z', '2023-10-02T01:00:00Z',
  '2023-10-02T02:00:00Z', '2023-10-02T03:00:00Z', '2023-10-02T04:00:00Z',
  '2023-10-02T05:00:00Z', '2023-10-02T06:00:00Z', '2023-10-02T07:00:00Z',
]

const metrics: MetricsResponse = {
  timestamps,
  mask_pressure: [10, 10.2, 10.5, 11, 10.8, 10.3, 10, 9.8, 10],
  pressure: [10, 10.2, 10.5, 11, 10.8, 10.3, 10, 9.8, 10],
  epr_pressure: [8, 8.2, 8.5, 9, 8.8, 8.3, 8, 7.8, 8],
  leak: [0, 0.05, 0.1, 0.08, 0.03, 0, 0.02, 0.05, 0],
  resp_rate: [15, 14.5, 15.2, 14.8, 15, 15.5, 14.3, 15.1, 15],
  tidal_vol: [0.5, 0.52, 0.48, 0.55, 0.5, 0.49, 0.51, 0.53, 0.5],
  min_vent: [7.5, 7.6, 7.3, 8.1, 7.5, 7.6, 7.2, 8.0, 7.5],
  snore: [0, 0, 0.1, 0, 0, 0, 0, 0, 0],
  flow_lim: [0, 0.05, 0.1, 0.05, 0, 0, 0.02, 0.03, 0],
}

const meta: Meta<typeof MetricsChartSplit> = {
  title: 'Components/MetricsChartSplit',
  component: MetricsChartSplit,
  tags: ['autodocs'],
  args: { metrics },
}

export default meta
type Story = StoryObj<typeof MetricsChartSplit>

export const Default: Story = {}
