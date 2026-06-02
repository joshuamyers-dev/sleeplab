/**
 * Module-level display timezone singleton.
 *
 * Initialised to the browser's local timezone so the app works correctly
 * before the server config is fetched.  App.tsx overwrites it with the
 * DISPLAY_TZ value from GET /config on startup.
 *
 * Usage:
 *   import { getDisplayTz } from '../lib/displayTz'
 *   new Date(ts).toLocaleTimeString([], { timeZone: getDisplayTz(), ... })
 */

let _tz: string = Intl.DateTimeFormat().resolvedOptions().timeZone

/**
 * Helper function for get display tz.
 */
export function getDisplayTz(): string {
  return _tz
}

/**
 * Helper function for set display tz.
 */
export function setDisplayTz(tz: string): void {
  _tz = tz
}
