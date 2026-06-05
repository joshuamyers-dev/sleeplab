import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'

import { api } from '../api/client'
import type { OximeterImportResponse } from '../api/client'
import { CheckCircleIcon } from '../components/icons/ChevronIcons'
import OximeterImportSummary from '../components/OximeterImportSummary'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { collectOximeterFilesFromInput } from '../lib/oximeterFiles'
import { Link } from 'react-router-dom'

const IMPORT_SYNC_STORAGE_KEY = 'cpap-import-sync-active'

/**
 * Type definition for the selected import file.
 */
type SelectedImportFile = {
  file: File
  relativePath: string
}

/**
 * Type definition for the upload phase.
 */
type UploadPhase = 'idle' | 'uploading' | 'complete'

/**
 * React component or element to render the import.
 *
 * @returns The rendered React element.
 */
export default function Import() {
  const directoryInputRef = useRef<HTMLInputElement | null>(null)
  const oximeterInputRef = useRef<HTMLInputElement | null>(null)
  const [rootName, setRootName] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<SelectedImportFile[]>([])
  const [folderLabel, setFolderLabel] = useState('No folder selected')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle')

  // SleepHQ import state
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState(0)
  const [totalFiles, setTotalFiles] = useState(0)

  // Local server import state
  const [localPath, setLocalPath] = useState<string | null>(null)
  const [localLastAt, setLocalLastAt] = useState<string | null>(null)
  const [localLastStatus, setLocalLastStatus] = useState<string | null>(null)
  const [isLocalImporting, setIsLocalImporting] = useState(false)
  const [localMessage, setLocalMessage] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  // Oximeter import state
  const [oximeterFiles, setOximeterFiles] = useState<File[]>([])
  const [oximeterLabel, setOximeterLabel] = useState('No O2 files selected')
  const [isOximeterImporting, setIsOximeterImporting] = useState(false)
  const [oximeterOverwrite, setOximeterOverwrite] = useState(false)
  const [oximeterResult, setOximeterResult] = useState<OximeterImportResponse | null>(null)
  const [oximeterError, setOximeterError] = useState<string | null>(null)

  useEffect(() => {
    api.getImportSettings().then((s) => {
      setLocalPath(s.local_datalog_path)
      setLocalLastAt(s.last_local_import_at)
      setLocalLastStatus(s.last_local_import_status)
    }).catch(() => {})
  }, [])

  async function handleSelectFolder() {
    setError(null)
    setUploadPhase('idle')
    setUploadedFiles(0)
    setTotalFiles(0)

    if (!supportsDirectorySelection()) {
      setError('This browser does not support folder import. Try Chrome or Edge, or use the desktop app.')
      return
    }

    if (!('showDirectoryPicker' in window)) {
      directoryInputRef.current?.click()
      return
    }

    try {
      const showDirectoryPicker = window.showDirectoryPicker
      if (!showDirectoryPicker) {
        directoryInputRef.current?.click()
        return
      }

      const directoryHandle = await showDirectoryPicker()
      const files = await collectEdfFiles(directoryHandle)
      applySelectedFiles(directoryHandle.name, files)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      setError(err instanceof Error ? err.message : 'Could not read selected folder')
    }
  }

  function handleDirectoryInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) {
      return
    }

    setError(null)
    setUploadPhase('idle')
    setUploadedFiles(0)
    setTotalFiles(0)

    const root = getInputRootName(files)
    const selected = collectEdfFilesFromInput(files, root)
    applySelectedFiles(root, selected)
    event.target.value = ''
  }

  function applySelectedFiles(root: string, files: SelectedImportFile[]) {
    setRootName(root)
    setSelectedFiles(files)
    setFolderLabel(files.length > 0 ? `${root} (${files.length} EDF files)` : `${root} (no EDF files found)`)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!rootName || selectedFiles.length === 0) {
      setError('Select a DATALOG folder first')
      return
    }

    setError(null)
    setUploadPhase('uploading')
    setUploadedFiles(0)
    setTotalFiles(selectedFiles.length)
    setIsSubmitting(true)
    try {
      const { upload_id } = await api.startImportUpload(rootName)
      const batchSize = 200

      for (let index = 0; index < selectedFiles.length; index += batchSize) {
        const batch = selectedFiles.slice(index, index + batchSize)
        await api.uploadImportBatch(upload_id, batch)
        setUploadedFiles(Math.min(index + batch.length, selectedFiles.length))
      }

      await api.finishImportUpload(upload_id)
      window.sessionStorage.setItem(IMPORT_SYNC_STORAGE_KEY, 'true')
      setUploadPhase('complete')
    } catch (err) {
      setUploadPhase('idle')
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const uploadPercent = totalFiles > 0 ? Math.round((uploadedFiles / totalFiles) * 100) : 0

  async function handleLocalImport() {
    setLocalError(null)
    setLocalMessage(null)
    setIsLocalImporting(true)
    try {
      const result = await api.triggerLocalImport()
      setLocalMessage(result.message || 'Import started. New sessions will appear shortly.')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setIsLocalImporting(false)
    }
  }

  async function handleSleepHQSync() {
    setSyncError(null)
    setSyncMessage(null)
    setIsSyncing(true)
    try {
      const result = await api.triggerSleepHQImport()
      setSyncMessage(result.message || 'Sync started. New sessions will appear shortly.')
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setIsSyncing(false)
    }
  }

  function handleOximeterInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = collectOximeterFilesFromInput(Array.from(event.target.files ?? []))
    setOximeterFiles(files)
    setOximeterResult(null)
    setOximeterError(null)
    setOximeterLabel(files.length > 0 ? `${files.length} O2 file${files.length === 1 ? '' : 's'} selected` : 'No compatible O2 files selected')
    event.target.value = ''
  }

  async function handleOximeterImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!oximeterFiles.length) {
      setOximeterError('Select one or more Wellue/Viatom binary files first')
      return
    }

    setIsOximeterImporting(true)
    setOximeterError(null)
    setOximeterResult(null)
    try {
      const result = await api.uploadOximeterFiles(oximeterFiles, { overwrite: oximeterOverwrite })
      setOximeterResult(result)
      if (result.imported > 0) {
        window.sessionStorage.setItem(IMPORT_SYNC_STORAGE_KEY, 'true')
      }
    } catch (err) {
      setOximeterError(err instanceof Error ? err.message : 'O2 import failed')
    } finally {
      setIsOximeterImporting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.6),_transparent_38%),var(--surface-strong)]">
        <CardHeader>
          <CardTitle className="text-2xl">Import Sleep Data</CardTitle>
          <CardDescription>
            Remove the SD card from your ResMed CPAP machine, insert it into your computer, open the card, and select the <span className="font-bold text-[var(--foreground)]">DATALOG</span> folder. SleepLab will read and process it directly in your browser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {supportsDirectorySelection() ? null : (
            <div className="mb-5 rounded-[16px] border border-[rgba(233,120,75,0.28)] bg-[rgba(233,120,75,0.08)] px-4 py-3 text-sm text-[var(--orange-700)]">
              <span className="font-bold">Browser not supported.</span> Folder import requires either the Chromium directory picker or a browser that supports directory uploads.
            </div>
          )}
          <form className="space-y-5" onSubmit={handleSubmit}>
            <input
              ref={directoryInputRef}
              hidden
              multiple
              type="file"
              onChange={handleDirectoryInputChange}
              {...DIRECTORY_INPUT_ATTRIBUTES}
            />
            <div className="space-y-3">
              <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <p className="text-sm text-[var(--foreground)]">{folderLabel}</p>
                <Button className="mt-4" type="button" variant="outline" onClick={handleSelectFolder} disabled={isSubmitting}>
                  Select folder
                </Button>
              </div>
            </div>
            {uploadPhase === 'uploading' ? (
              <div className="space-y-3 rounded-[20px] border border-[var(--accent-border)] bg-[var(--surface-soft)] p-4">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <p className="font-bold text-[var(--foreground)]">Uploading sleep data</p>
                  <p className="font-bold text-[var(--accent)]">{uploadPercent}%</p>
                </div>
                <div
                  aria-label="Upload progress"
                  aria-valuemax={totalFiles}
                  aria-valuemin={0}
                  aria-valuenow={uploadedFiles}
                  className="h-3 overflow-hidden rounded-full bg-[var(--border)]"
                  role="progressbar"
                >
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300 ease-out"
                    style={{ width: `${uploadPercent}%` }}
                  />
                </div>
                <p className="text-sm font-medium text-[var(--muted-foreground)]">
                  Uploaded {uploadedFiles} of {totalFiles} files
                </p>
              </div>
            ) : null}
            {uploadPhase === 'complete' ? (
              <div className="flex items-start gap-3 rounded-[20px] border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4 text-[var(--accent)]">
                <div className="space-y-1">
                  <p className="text-sm font-bold">Upload received</p>
                  <p className="text-sm font-medium text-[var(--muted-foreground)]">
                    Your files were uploaded. Synchronization is continuing in the background.
                  </p>
                </div>
              </div>
            ) : null}
            {error ? <p className="text-sm text-[var(--danger-text)]">{error}</p> : null}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Uploading...' : 'Start import'}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card className="bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.45),_transparent_38%),var(--surface-strong)]">
        <CardHeader>
          <CardTitle className="text-2xl">Import O2 Ring Data</CardTitle>
          <CardDescription>
            Upload ViHealth or O2 Insight Pro binary files from Wellue/Viatom oximeters. SleepLab will match each recording to an existing CPAP session by time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleOximeterImport}>
            <input
              ref={oximeterInputRef}
              hidden
              multiple
              type="file"
              onChange={handleOximeterInputChange}
            />
            <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <p className="text-sm text-[var(--foreground)]">{oximeterLabel}</p>
              {oximeterFiles.length > 0 ? (
                <div className="mt-3 max-h-24 overflow-auto rounded-[14px] border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2">
                  {oximeterFiles.map((file) => (
                    <p key={`${file.name}-${file.size}`} className="truncate text-xs font-medium text-[var(--muted-foreground)]">
                      {file.name}
                    </p>
                  ))}
                </div>
              ) : null}
              <Button className="mt-4" type="button" variant="outline" onClick={() => oximeterInputRef.current?.click()} disabled={isOximeterImporting}>
                Select O2 files
              </Button>
            </div>
            <label className="flex items-start gap-3 rounded-[16px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-sm">
              <input
                className="mt-1 h-4 w-4"
                type="checkbox"
                checked={oximeterOverwrite}
                onChange={(event) => setOximeterOverwrite(event.target.checked)}
              />
              <span>
                <span className="block font-bold text-[var(--foreground)]">Replace existing SpO2 data</span>
                <span className="text-[var(--muted-foreground)]">Leave this off to skip sessions that already have oximeter data.</span>
              </span>
            </label>
            {oximeterResult ? <OximeterImportSummary result={oximeterResult} /> : null}
            {oximeterError ? <p className="text-sm text-[var(--danger-text)]">{oximeterError}</p> : null}
            <Button type="submit" disabled={isOximeterImporting}>
              {isOximeterImporting ? 'Importing...' : 'Import O2 data'}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card className="bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.45),_transparent_38%),var(--surface-strong)]">
        <CardHeader>
          <CardTitle className="text-2xl">Import from SleepHQ</CardTitle>
          <CardDescription>
            Run a one-time import of recent CPAP sessions from your SleepHQ account. Configure your credentials in{' '}
            <Link className="font-medium text-[var(--foreground)] underline underline-offset-2" to="/settings">
              Settings
            </Link>
            {' '}first, then re-run this whenever you want to pull in newer sessions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {syncMessage ? (
            <div className="flex items-start gap-3 rounded-[20px] border border-[rgba(106,161,54,0.24)] bg-[rgba(106,161,54,0.1)] p-4 text-[var(--olive-deep)]">
              <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">{syncMessage}</p>
            </div>
          ) : null}
          {syncError ? <p className="text-sm text-[var(--danger-text)]">{syncError}</p> : null}
          <Button onClick={handleSleepHQSync} disabled={isSyncing}>
            {isSyncing ? 'Importing...' : 'Import now'}
          </Button>
        </CardContent>
      </Card>
      {localPath ? (
        <Card className="bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.45),_transparent_38%),var(--surface-strong)]">
          <CardHeader>
            <CardTitle className="text-2xl">Local Server Import</CardTitle>
            <CardDescription>
              Trigger an import from the server path configured in{' '}
              <Link className="font-medium text-[var(--foreground)] underline underline-offset-2" to="/settings">
                Settings
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-[var(--border)] px-4 py-3 text-sm space-y-1">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Server path</p>
              <p className="font-mono text-[var(--foreground)]">{localPath}</p>
            </div>
            {localLastAt && (
              <div className="rounded-lg border border-[var(--border)] px-4 py-3 text-sm space-y-1">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Last import</p>
                <p className="text-[var(--foreground)]">{new Date(localLastAt).toLocaleString()}</p>
                {localLastStatus && (
                  <p className={localLastStatus.startsWith('ok') ? 'text-[var(--olive-deep)]' : 'text-[var(--danger-text)]'}>
                    {localLastStatus}
                  </p>
                )}
              </div>
            )}
            {localMessage ? (
              <div className="flex items-start gap-3 rounded-[20px] border border-[rgba(106,161,54,0.24)] bg-[rgba(106,161,54,0.1)] p-4 text-[var(--olive-deep)]">
                <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-sm font-medium">{localMessage}</p>
              </div>
            ) : null}
            {localError ? <p className="text-sm text-[var(--danger-text)]">{localError}</p> : null}
            <Button onClick={handleLocalImport} disabled={isLocalImporting}>
              {isLocalImporting ? 'Importing...' : 'Import now'}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

async function collectEdfFiles(
  directoryHandle: FileSystemDirectoryHandle,
  prefix = '',
): Promise<SelectedImportFile[]> {
  const entries: SelectedImportFile[] = []

  for await (const [name, handle] of directoryHandle.entries()) {
    if (handle.kind === 'file') {
      if (!name.toLowerCase().endsWith('.edf')) {
        continue
      }

      const file = await handle.getFile()
      entries.push({
        file,
        relativePath: prefix ? `${prefix}/${name}` : name,
      })
      continue
    }

    const nested = await collectEdfFiles(handle, prefix ? `${prefix}/${name}` : name)
    entries.push(...nested)
  }

  return entries.sort((left, right) => left.relativePath.localeCompare(right.relativePath))
}

/**
 * Helper function for collect edf files from input.
 */
function collectEdfFilesFromInput(files: File[], rootName: string): SelectedImportFile[] {
  return files
    .filter((file) => file.name.toLowerCase().endsWith('.edf'))
    .map((file) => ({
      file,
      relativePath: getRelativePathFromInput(file, rootName),
    }))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
}

/** Helper function for get input root name. */
function getInputRootName(files: File[]) {
  const firstWithPath = files.find((file) => getRelativePathFromInput(file).includes('/'))
  if (firstWithPath) {
    return getRelativePathFromInput(firstWithPath).split('/')[0]
  }

  return 'DATALOG'
}

/**
 * Helper function for get relative path from input.
 */
function getRelativePathFromInput(file: File, rootName?: string) {
  const rawPath = file.webkitRelativePath || file.name
  if (!rootName) {
    return rawPath
  }

  const prefix = `${rootName}/`
  return rawPath.startsWith(prefix) ? rawPath.slice(prefix.length) : rawPath
}

/**
 * Helper function for supports directory selection.
 */
function supportsDirectorySelection() {
  return 'showDirectoryPicker' in window || supportsWebkitDirectoryInput()
}

/**
 * Helper function for supports webkit directory input.
 */
function supportsWebkitDirectoryInput() {
  return 'webkitdirectory' in document.createElement('input')
}

const DIRECTORY_INPUT_ATTRIBUTES = {
  webkitdirectory: '',
  directory: '',
} as const

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
  }
}
