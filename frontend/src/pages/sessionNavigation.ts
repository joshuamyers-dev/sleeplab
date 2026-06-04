import type { SessionSummary } from '../api/client'

type NavigableSession = Pick<SessionSummary, 'folder_date'>

export interface SessionNavigation {
  currentIndex: number
  current: NavigableSession | null
  previous: NavigableSession | null
  next: NavigableSession | null
  previousDate: string | null
  nextDate: string | null
  previousUrl: string | null
  nextUrl: string | null
  isPreviousDisabled: boolean
  isNextDisabled: boolean
}

export function getSessionNavigation(sessions: NavigableSession[], currentDate: string): SessionNavigation {
  const sortedSessions = [...sessions].sort((a, b) => a.folder_date.localeCompare(b.folder_date))
  const currentIndex = sortedSessions.findIndex((session) => session.folder_date === currentDate)
  const current = currentIndex >= 0 ? sortedSessions[currentIndex] : null
  const previous = currentIndex > 0 ? sortedSessions[currentIndex - 1] : null
  const next = currentIndex >= 0 && currentIndex < sortedSessions.length - 1
    ? sortedSessions[currentIndex + 1]
    : null
  const previousDate = previous?.folder_date ?? null
  const nextDate = next?.folder_date ?? null

  return {
    currentIndex,
    current,
    previous,
    next,
    previousDate,
    nextDate,
    previousUrl: previousDate ? `/sessions/${previousDate}` : null,
    nextUrl: nextDate ? `/sessions/${nextDate}` : null,
    isPreviousDisabled: previous == null,
    isNextDisabled: next == null,
  }
}
