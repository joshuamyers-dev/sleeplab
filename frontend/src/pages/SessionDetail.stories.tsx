import type { Meta, StoryObj } from '@storybook/react';
import { Routes, Route } from 'react-router-dom';
import SessionDetail from './SessionDetail';
import { api } from '../api/client';
import type { EquipmentType } from '../api/client';

const mockSession = {
  id: 'sesh-123',
  session_id: 'sesh-123',
  folder_date: '2023-10-01',
  block_index: 0,
  start_datetime: '2023-10-01T23:00:00Z',
  duration_seconds: 28800,
  duration_hours: 8,
  ahi: 1.5,
  central_apnea_count: 2,
  obstructive_apnea_count: 5,
  hypopnea_count: 5,
  apnea_count: 7,
  arousal_count: 0,
  total_ahi_events: 12,
  avg_pressure: 10.2,
  p95_pressure: 12.0,
  avg_leak: 0.05,
  has_spo2: true,
  machine_tz: 'America/New_York',
  pld_start_datetime: '2023-10-01T23:00:00Z',
  device_serial: '12345678',
  avg_resp_rate: 15.2,
  avg_tidal_vol: 0.5,
  avg_min_vent: 7.5,
  avg_snore: 0.1,
  avg_flow_lim: 0.05,
  avg_spo2: 95.5,
  min_spo2: 89.0,
  therapy_mode: 'AutoSet',
  mask_type: 'Full Face',
  humidity_level: 4,
  temperature_c: 27,
};

const mockEvents = [
  { id: 1, event_type: 'Obstructive Apnea', onset_seconds: 3600, duration_seconds: 15, event_datetime: '2023-10-02T00:00:00Z' },
  { id: 2, event_type: 'Hypopnea', onset_seconds: 7200, duration_seconds: 12, event_datetime: '2023-10-02T01:00:00Z' },
];

const mockMetrics = {
  timestamps: ['2023-10-01T23:00:00Z', '2023-10-02T07:00:00Z'],
  mask_pressure: [10, 11],
  pressure: [10, 11],
  epr_pressure: [8, 9],
  leak: [0, 0.1],
  resp_rate: [15, 14],
  tidal_vol: [0.5, 0.55],
  min_vent: [7.5, 7.7],
  snore: [0, 0],
  flow_lim: [0, 0],
};

const mockSpo2 = {
  timestamps: ['2023-10-01T23:00:00Z', '2023-10-02T07:00:00Z'],
  spo2: [96, 95],
  pulse: [60, 65],
};

const mockEquipment = {
  cushion: { 
    id: 'eq-1', 
    equipment_type: 'cushion' as EquipmentType, 
    start_date: '2023-09-01', 
    replacement_days: 30, 
    mask_category: 'F20', 
    brand: 'ResMed', 
    model: 'AirFit F20', 
    notes: '', 
    days_in_use: 30, 
    created_at: '', 
    updated_at: '' 
  },
  headgear: null,
  tubing: null,
  humidifier_chamber: null,
  filter: null,
};

const mockWearableData = {
  hr: [{ timestamp: '2023-10-01T23:00:00Z', value: 60 }, { timestamp: '2023-10-02T07:00:00Z', value: 65 }],
  spo2: [{ timestamp: '2023-10-01T23:00:00Z', value: 96 }, { timestamp: '2023-10-02T07:00:00Z', value: 95 }],
  stages: [{ timestamp: '2023-10-01T23:00:00Z', stage: 1 }, { timestamp: '2023-10-02T07:00:00Z', stage: 2 }],
};

const meta: Meta<typeof SessionDetail> = {
  title: 'Pages/SessionDetail',
  component: SessionDetail,
  tags: ['autodocs', 'ai-generated'],
  parameters: {
    initialEntries: ['/sessions/2023-10-01'],
  },
  decorators: [
    (Story, context) => {
      const session = context.parameters.sessionData !== undefined ? context.parameters.sessionData : mockSession;
      const wearable = context.parameters.wearableData !== undefined ? context.parameters.wearableData : mockWearableData;
      const equipment = context.parameters.equipmentData !== undefined ? context.parameters.equipmentData : mockEquipment;

      // Mock API calls
      api.getSessionByDate = async () => session;
      api.getEvents = async () => mockEvents;
      api.getMetrics = async () => mockMetrics;
      api.getSessions = async () => [session];
      api.getSessionSpo2 = async () => mockSpo2;
      api.getInferredEquipment = async () => equipment;
      api.getWearableData = async () => wearable;
      api.getEventWindow = async () => ({
        event: mockEvents[0],
        neighboring_events: [],
        metrics: mockMetrics,
        waveform: { timestamps: ['2023-10-01T23:00:00Z'], flow: [0.5], pressure: [10] }
      });
      api.getSessionAISummary = async () => ({
        headline: "A good night's sleep",
        therapy_quality: "Great",
        high_confidence_observations: ["Few events", "Low leak"],
        possible_patterns: ["Consistent breathing"],
        things_to_review: [],
        missing_or_uncertain: [],
        flag: "good",
        cached: true,
      });
      api.getImportSettings = async () => ({
        llm_configured: true,
      } as any);

      if (context.parameters.loading) {
        api.getSessionByDate = () => new Promise(() => {}); // Never resolves
      }

      return (
        <Routes>
          <Route path="/sessions/:date" element={<Story />} />
        </Routes>
      );
    },
  ],
};

export default meta;

type Story = StoryObj<typeof SessionDetail>;

export const Loading: Story = {
  parameters: {
    loading: true,
  },
};

export const GoodNight: Story = {
  parameters: {
    sessionData: {
      ...mockSession,
      ahi: 1.5,
    },
  },
};

export const MildNight: Story = {
  parameters: {
    sessionData: {
      ...mockSession,
      ahi: 12.0,
    },
  },
};

export const RoughNight: Story = {
  parameters: {
    sessionData: {
      ...mockSession,
      ahi: 25.0,
    },
  },
};

export const DifficultNight: Story = {
  parameters: {
    sessionData: {
      ...mockSession,
      ahi: 45.0,
    },
  },
};

export const NoDataNight: Story = {
  parameters: {
    sessionData: {
      ...mockSession,
      ahi: null,
    },
  },
};

export const MinimalData: Story = {
  parameters: {
    sessionData: {
      ...mockSession,
      has_spo2: false,
      therapy_mode: null,
      mask_type: null,
      humidity_level: null,
      temperature_c: null,
    },
    wearableData: null,
    equipmentData: null,
  },
};

export const MissingTimezone: Story = {
  parameters: {
    sessionData: {
      ...mockSession,
      machine_tz: null,
    },
  },
};
