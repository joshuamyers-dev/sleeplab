/**
 * Module-level display timezone singleton.
 * Defaults to the browser's local timezone. Can be overridden by the
 * server config (GET /config) on app startup.
 */

let _tz: string = Intl.DateTimeFormat().resolvedOptions().timeZone

export function getDisplayTz(): string {
  return _tz
}

export function setDisplayTz(tz: string): void {
  _tz = tz
}
