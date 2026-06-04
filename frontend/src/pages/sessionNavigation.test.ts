import { describe, expect, it } from 'vitest'

import { getSessionNavigation } from './sessionNavigation'

describe('getSessionNavigation', () => {
  it('sorts sessions and returns previous and next targets for the current date', () => {
    const navigation = getSessionNavigation([
      { folder_date: '2026-01-03' },
      { folder_date: '2026-01-01' },
      { folder_date: '2026-01-02' },
    ], '2026-01-02')

    expect(navigation.currentIndex).toBe(1)
    expect(navigation.previousDate).toBe('2026-01-01')
    expect(navigation.nextDate).toBe('2026-01-03')
    expect(navigation.previousUrl).toBe('/sessions/2026-01-01')
    expect(navigation.nextUrl).toBe('/sessions/2026-01-03')
    expect(navigation.isPreviousDisabled).toBe(false)
    expect(navigation.isNextDisabled).toBe(false)
  })

  it('disables missing navigation targets at the list boundaries', () => {
    const navigation = getSessionNavigation([
      { folder_date: '2026-01-01' },
      { folder_date: '2026-01-02' },
    ], '2026-01-01')

    expect(navigation.previousDate).toBeNull()
    expect(navigation.nextDate).toBe('2026-01-02')
    expect(navigation.previousUrl).toBeNull()
    expect(navigation.nextUrl).toBe('/sessions/2026-01-02')
    expect(navigation.isPreviousDisabled).toBe(true)
    expect(navigation.isNextDisabled).toBe(false)
  })

  it('returns disabled navigation when the current date is not in the session list', () => {
    const navigation = getSessionNavigation([
      { folder_date: '2026-01-01' },
      { folder_date: '2026-01-02' },
    ], '2026-01-03')

    expect(navigation.currentIndex).toBe(-1)
    expect(navigation.current).toBeNull()
    expect(navigation.previousDate).toBeNull()
    expect(navigation.nextDate).toBeNull()
    expect(navigation.isPreviousDisabled).toBe(true)
    expect(navigation.isNextDisabled).toBe(true)
  })
})
