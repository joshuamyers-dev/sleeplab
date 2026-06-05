import type { Meta, StoryObj } from '@storybook/react'
import type { EventWindowResponse } from '../api/client'
import EventInspector from './EventInspector'

const mockData: EventWindowResponse = {
  event: {
    id: 1,
    event_type: 'Obstructive Apnea',
    onset_seconds: 3600,
    duration_seconds: 18,
    event_datetime: '2023-10-02T00:00:00Z',
  },
  neighboring_events: [
    { id: 2, event_type: 'Hypopnea', onset_seconds: 3800, duration_seconds: 12, event_datetime: '2023-10-02T00:03:20Z' },
  ],
  metrics: {
    timestamps: ['2023-10-01T23:55:00Z', '2023-10-01T23:57:00Z', '2023-10-02T00:00:00Z', '2023-10-02T00:03:00Z', '2023-10-02T00:05:00Z'],
    mask_pressure: [10, 10.2, 10.5, 11, 10.8],
    pressure: [10, 10.2, 10.5, 11, 10.8],
    epr_pressure: [8, 8.2, 8.5, 9, 8.8],
    leak: [0, 0.05, 0.1, 0.08, 0.03],
    resp_rate: [15, 14.5, 0, 0, 15.2],
    tidal_vol: [0.5, 0.52, 0, 0, 0.48],
    min_vent: [7.5, 7.6, 0, 0, 7.3],
    snore: [0, 0, 0, 0, 0],
    flow_lim: [0, 0.05, 0.1, 0.05, 0],
  },
  waveform: {
    timestamps: ['2023-10-01T23:59:00Z', '2023-10-01T23:59:30Z', '2023-10-02T00:00:00Z', '2023-10-02T00:00:30Z', '2023-10-02T00:01:00Z'],
    flow: [0.3, 0.2, 0, 0, 0.3],
    pressure: [10, 10, 10, 10.5, 10.5],
  },
}

const meta: Meta<typeof EventInspector> = {
  title: 'Components/EventInspector',
  component: EventInspector,
  tags: ['autodocs'],
  args: {
    data: mockData,
    loading: false,
    windowMinutes: 5,
    hasPreviousEvent: true,
    hasNextEvent: true,
    onWindowMinutesChange: () => {},
    onPreviousEvent: () => {},
    onNextEvent: () => {},
  },
}

export default meta
type Story = StoryObj<typeof EventInspector>

export const Default: Story = {}

export const Loading: Story = {
  args: { data: null, loading: true },
}

export const NoData: Story = {
  args: { data: null, loading: false },
}

export const NoPrevious: Story = {
  args: { hasPreviousEvent: false },
}

export const NoNext: Story = {
  args: { hasNextEvent: false },
}
