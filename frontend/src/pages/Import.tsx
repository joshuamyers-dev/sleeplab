import { useState, type FormEvent } from 'react'

import { api } from '../api/client'
import { CheckCircleIcon } from '../components/icons/ChevronIcons'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'

const IMPORT_SYNC_STORAGE_KEY = 'cpap-import-sync-active'

type SelectedImportFile = {
  file: File
  relativePath: string
}

type UploadPhase = 'idle' | 'uploading' | 'complete'

export default function Import() {
  const [rootName, setRootName] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<SelectedImportFile[]>([])
  const [folderLabel, setFolderLabel] = useState('No folder selected')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle')
  const [uploadedFiles, setUploadedFiles] = useState(0)
  const [totalFiles, setTotalFiles] = useState(0)

  async function handleSelectFolder() {
    setError(null)
    setUploadPhase('idle')
    setUploadedFiles(0)
    setTotalFiles(0)

    if (!('showDirectoryPicker' in window)) {
      setError('This browser does not support directory picking. Use a Chromium-based browser.')
      return
    }

    try {
      const showDirectoryPicker = window.showDirectoryPicker
      if (!showDirectoryPicker) {
        setError('This browser does not support directory picking. Use a Chromium-based browser.')
        return
      }

      const directoryHandle = await showDirectoryPicker()
      const files = await collectEdfFiles(directoryHandle)
      setRootName(directoryHandle.name)
      setSelectedFiles(files)
      setFolderLabel(files.length > 0 ? `${directoryHandle.name} (${files.length} EDF files)` : `${directoryHandle.name} (no EDF files found)`)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      setError(err instanceof Error ? err.message : 'Could not read selected folder')
    }
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

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.6),_transparent_38%),var(--surface-strong)]">
        <CardHeader>
          <CardTitle className="text-2xl">Import Sleep Data</CardTitle>
          <CardDescription>
            Remove the SD card from your ResMed CPAP machine, insert it into your computer, open the card, and select the <span className="font-bold text-[var(--foreground)]">DATALOG</span> folder. SleepLab will read and process it directly in your browser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {'showDirectoryPicker' in window ? null : (
            <div className="mb-5 rounded-[16px] border border-[rgba(233,120,75,0.28)] bg-[rgba(233,120,75,0.08)] px-4 py-3 text-sm text-[var(--orange-700)]">
              <span className="font-bold">Browser not supported.</span> Folder import requires a Chromium-based browser such as Chrome or Edge. Firefox and Safari are not supported.
            </div>
          )}
          <form className="space-y-5" onSubmit={handleSubmit}>
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
              <div className="flex items-start gap-3 rounded-[20px] border border-[rgba(106,161,54,0.24)] bg-[rgba(106,161,54,0.1)] p-4 text-[var(--olive-deep)]">
                <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-bold">Upload complete</p>
                  <p className="text-sm font-medium text-[var(--muted-foreground)]">
                    Your files have been uploaded successfully. Synchronization is continuing in the background.
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
    </div>
  )
}

async function collectEdfFiles(
  directoryHandle: FileSystemDirectoryHandle,
  prefix = '',
): Promise<SelectedImportFile[]> {
  const entries: SelectedImportFile[] = []

  // @ts-expect-error File System Access API iterator is not fully typed in all TS lib versions.
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

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
  }
}
