import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import EventTimeline from './EventTimeline'

describe('EventTimeline', () => {
  it('keeps events after summed session duration inside the timeline bar', () => {
    render(
      <EventTimeline
        startDatetime="2026-06-02T03:57:00Z"
        durationSeconds={16440}
        events={[
          {
            id: 1,
            event_type: 'Hypopnea',
            onset_seconds: 17400,
            duration_seconds: null,
            event_datetime: '2026-06-02T08:47:00Z',
          },
        ]}
      />,
    )

    const marker = screen.getByRole('button', { name: /hypopnea/i })

    expect(Number.parseFloat(marker.style.left)).toBeLessThanOrEqual(100)
    expect(Number.parseFloat(marker.style.left) + Number.parseFloat(marker.style.width)).toBeLessThanOrEqual(100)
  })

  it('positions events against the provided wall-clock domain', () => {
    const domainStart = new Date('2026-06-02T03:45:00Z').getTime()
    const domainEnd = new Date('2026-06-02T10:45:00Z').getTime()

    render(
      <EventTimeline
        startDatetime="2026-06-02T03:57:00Z"
        durationSeconds={16440}
        timeDomain={[domainStart, domainEnd]}
        events={[
          {
            id: 1,
            event_type: 'Hypopnea',
            onset_seconds: 17400,
            duration_seconds: null,
            event_datetime: '2026-06-02T08:47:00Z',
          },
        ]}
      />,
    )

    const marker = screen.getByRole('button', { name: /hypopnea/i })

    expect(Number.parseFloat(marker.style.left)).toBeGreaterThan(70)
    expect(Number.parseFloat(marker.style.left)).toBeLessThan(75)
  })
})
