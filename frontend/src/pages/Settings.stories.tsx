import type { Meta, StoryObj } from '@storybook/react'
import { Route, Routes } from 'react-router-dom'

import { api, authTokenStore, UnauthorizedError, type ImportSettings, type AuthUser } from '../api/client'
import SettingsPage from './Settings'

const mockUser: AuthUser = {
  user_id: '1',
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
}

const defaultSettings: ImportSettings = {
  sleephq_enabled: true,
  sleephq_client_id: 'client_12345',
  has_client_secret: true,
  sleephq_client_secret: null,
  sleephq_team_id: 100,
  sleephq_machine_id: 200,
  auto_import_sleephq: false,
  lookback_days: 30,
  local_datalog_path: '/data/DATALOG',
  local_import_frequency: 'daily',
  last_local_import_at: '2023-10-12T08:00:00Z',
  last_local_import_status: 'ok - 1 session imported',
  wearable_provider: 'open-wearables',
  wearable_base_url: 'https://wearables.example.com',
  wearable_api_key: null,
  machine_tz: 'America/New_York',
  display_tz: 'America/New_York',
  has_machine_tz: true,
  has_display_tz: true,
  llm_provider: 'ollama',
  llm_base_url: 'http://localhost:11434',
  llm_model: 'llama3.1:8b',
  has_llm_api_key: true,
  llm_api_key: null,
  llm_configured: true,
}

const meta = {
  title: 'Pages/SettingsPage',
  component: SettingsPage,
  tags: ['autodocs', 'ai-generated'],
  parameters: {
    initialEntries: ['/settings'],
  },
  decorators: [
    (Story, context) => {
      const { mockAuth = true, mockSettings = defaultSettings, rejectSettings = false } = context.parameters

      // Mock auth store
      authTokenStore.get = () => (mockAuth ? 'fake-token' : null)
      authTokenStore.set = () => {}
      authTokenStore.clear = () => {}

      // Mock API calls
      api.me = async () => {
        if (!mockAuth) throw new UnauthorizedError()
        return mockUser
      }

      api.getImportSettings = async () => {
        if (rejectSettings) throw new Error('Not found')
        return mockSettings
      }

      // Mock form submissions for interactivity
      api.updateProfile = async (payload) => ({ ...mockUser, ...payload })
      api.changePassword = async () => ({ status: 'ok' })
      api.saveImportSettings = async (payload) => ({ ...mockSettings, ...payload } as any)
      api.triggerSleepHQImport = async () => ({ status: 'ok', message: 'Import started successfully.' })
      api.deleteAllSessions = async () => {}

      return (
        <div className="p-4 bg-[var(--background)] min-h-screen">
          <Routes>
            <Route path="/settings" element={<Story />} />
            <Route path="/login" element={<div className="p-4 text-[var(--danger-text)] text-center font-bold">Redirected to /login</div>} />
          </Routes>
        </div>
      )
    },
  ],
} satisfies Meta<typeof SettingsPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  parameters: {
    mockAuth: true,
    mockSettings: defaultSettings,
  },
}

export const FirstTimeSetup: Story = {
  parameters: {
    mockAuth: true,
    rejectSettings: true,
  },
}

export const SleepHQDisabled: Story = {
  parameters: {
    mockAuth: true,
    mockSettings: {
      ...defaultSettings,
      sleephq_enabled: false,
    },
  },
}

export const MissingTimezone: Story = {
  parameters: {
    mockAuth: true,
    mockSettings: {
      ...defaultSettings,
      has_machine_tz: false,
      has_display_tz: false,
    },
  },
}

export const Unauthenticated: Story = {
  parameters: {
    mockAuth: false,
  },
}
