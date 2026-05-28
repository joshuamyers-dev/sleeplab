import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import App from './App'

describe('App', () => {
  afterEach(() => {
    delete window.__APP_CONFIG__
  })

  it('renders without crashing', () => {
    render(<App />)
    expect(screen.getByText(/use your sleeplab account/i)).toBeDefined()
  })

  it('shows registration links by default', () => {
    render(<App />)
    expect(screen.getAllByText(/create account|create one/i).length).toBeGreaterThan(0)
  })

  it('hides registration links when registration is disabled', () => {
    window.__APP_CONFIG__ = { DISABLE_USER_REGISTRATION: 'true' }

    render(<App />)

    expect(screen.queryByText(/create account/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/create one/i)).not.toBeInTheDocument()
  })
})
