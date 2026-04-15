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

export function getDisplayTz(): string {
  return _tz
}

export function setDisplayTz(tz: string): void {
  _tz = tz
}
