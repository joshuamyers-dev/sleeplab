export const IMPORT_SYNC_STORAGE_KEY = 'cpap-import-sync-active'
export const IMPORT_COMPLETED_EVENT = 'cpap-import-complete'

/**
 * Helper function for notify import completed.
 */
export function notifyImportCompleted() {
  window.sessionStorage.setItem(IMPORT_COMPLETED_EVENT, String(Date.now()))
  window.dispatchEvent(new Event(IMPORT_COMPLETED_EVENT))
}
