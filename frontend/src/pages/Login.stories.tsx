import type { Meta, StoryObj } from '@storybook/react'

import Login from './Login'

const meta: Meta<typeof Login> = {
  title: 'Pages/Login',
  component: Login,
  tags: ['autodocs', 'ai-generated'],
  decorators: [
    (Story) => {
      // Ensure we start in a logged-out state so the component doesn't immediately redirect
      window.localStorage.removeItem('cpap_auth_token')
      return <Story />
    },
  ],
}

export default meta
type Story = StoryObj<typeof Login>

export const Default: Story = {
  decorators: [
    (Story) => {
      // Ensure registration is enabled for the default story
      if (window.__APP_CONFIG__) {
        window.__APP_CONFIG__.DISABLE_USER_REGISTRATION = false
      }
      return <Story />
    },
  ],
}

export const RegistrationDisabled: Story = {
  decorators: [
    (Story) => {
      // Override config to disable registration for this story
      window.__APP_CONFIG__ = {
        ...window.__APP_CONFIG__,
        DISABLE_USER_REGISTRATION: true,
      }
      return <Story />
    },
  ],
}
