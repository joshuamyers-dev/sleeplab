import type { Meta, StoryObj } from '@storybook/react'
import { fireEvent, within } from '@testing-library/react'

import { api } from '../api/client'
import Register from './Register'

// Ensure we are in a logged-out state for the stories
window.localStorage.removeItem('cpap_auth_token')
window.__APP_CONFIG__ = {
  ...window.__APP_CONFIG__,
  DISABLE_USER_REGISTRATION: false,
}

// Preserve original api.register
const originalRegister = api.register

const meta: Meta<typeof Register> = {
  title: 'Pages/Register',
  component: Register,
  tags: ['autodocs', 'ai-generated'],
  decorators: [
    (Story) => {
      // Restore default behavior on every render
      api.register = originalRegister
      return <Story />
    },
  ],
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta

type Story = StoryObj<typeof Register>

export const Default: Story = {}

export const Filled: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    fireEvent.change(canvas.getByLabelText('Email'), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(canvas.getByLabelText('Password'), {
      target: { value: 'Password123!' },
    })
    fireEvent.change(canvas.getByLabelText('Confirm password'), {
      target: { value: 'Password123!' },
    })
  },
}

export const PasswordsMismatch: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    fireEvent.change(canvas.getByLabelText('Email'), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(canvas.getByLabelText('Password'), {
      target: { value: 'Password123!' },
    })
    fireEvent.change(canvas.getByLabelText('Confirm password'), {
      target: { value: 'Different456!' },
    })

    fireEvent.click(canvas.getByRole('button', { name: 'Create account' }))
  },
}

export const Submitting: Story = {
  play: async ({ canvasElement }) => {
    // Mock register to hang indefinitely for the submitting state
    api.register = () => new Promise(() => {})

    const canvas = within(canvasElement)

    fireEvent.change(canvas.getByLabelText('Email'), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(canvas.getByLabelText('Password'), {
      target: { value: 'Password123!' },
    })
    fireEvent.change(canvas.getByLabelText('Confirm password'), {
      target: { value: 'Password123!' },
    })

    fireEvent.click(canvas.getByRole('button', { name: 'Create account' }))
  },
}

export const ServerError: Story = {
  play: async ({ canvasElement }) => {
    // Mock register to fail with an error
    api.register = async () => {
      throw new Error('Email address already in use')
    }

    const canvas = within(canvasElement)

    fireEvent.change(canvas.getByLabelText('Email'), {
      target: { value: 'taken@example.com' },
    })
    fireEvent.change(canvas.getByLabelText('Password'), {
      target: { value: 'Password123!' },
    })
    fireEvent.change(canvas.getByLabelText('Confirm password'), {
      target: { value: 'Password123!' },
    })

    fireEvent.click(canvas.getByRole('button', { name: 'Create account' }))
  },
}
