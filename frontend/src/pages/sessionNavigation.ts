import type { SessionSummary } from '../api/client'

type NavigableSession = Pick<SessionSummary, 'folder_date'>

/**
 * Navigation state for stepping between sessions in chronological order.
 *
 * @property currentIndex - Zero-based index of the current session in the sorted list.
 * @property current - Current session, or null if currentDate has no match.
 * @property previous - Session immediately before current (chronologically), or null.
 * @property next - Session immediately after current (chronologically), or null.
 * @property previousUrl - Route URL for the previous session, or null when at the start.
 * @property nextUrl - Route URL for the next session, or null when at the end.
 * @property isPreviousDisabled - True when there is no earlier session to navigate to.
 * @property isNextDisabled - True when there is no later session to navigate to.
 */
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

/**
 * Compute prev/next session navigation from a flat session list and the currently viewed date.
 *
 * Sessions are sorted chronologically; currentDate is matched by folder_date.
 * Returns an object suitable for rendering back/forward navigation controls.
 */
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
