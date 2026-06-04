import type { OximeterImportResponse, OximeterImportResult } from '../api/client'

export default function OximeterImportSummary({ result }: { result: OximeterImportResponse }) {
  const groups: Array<{ status: OximeterImportResult['status']; label: string; className: string }> = [
    { status: 'imported', label: 'Imported', className: 'text-[var(--olive-deep)]' },
    { status: 'skipped', label: 'Skipped', className: 'text-[var(--muted-foreground)]' },
    { status: 'unmatched', label: 'Unmatched', className: 'text-[var(--orange-700)]' },
    { status: 'failed', label: 'Failed', className: 'text-[var(--danger-text)]' },
  ]

  return (
    <div className="space-y-3 rounded-[20px] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <ResultCount label="Imported" value={result.imported} />
        <ResultCount label="Skipped" value={result.skipped} />
        <ResultCount label="Unmatched" value={result.unmatched} />
        <ResultCount label="Failed" value={result.failed} />
      </div>
      {groups.map(({ status, label, className }) => {
        const rows = result.results.filter((row) => row.status === status)
        if (!rows.length) return null
        return (
          <div key={status} className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2">
            <p className={`text-xs font-bold uppercase tracking-[0.14em] ${className}`}>{label}</p>
            <div className="mt-2 space-y-1">
              {rows.map((row) => (
                <p key={`${row.filename}-${row.status}`} className="text-xs text-[var(--muted-foreground)]">
                  <span className="font-bold text-[var(--foreground)]">{row.filename}</span>
                  {' · '}
                  {row.message}
                  {row.sample_count != null ? ` · ${row.sample_count} samples` : ''}
                </p>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ResultCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[12px] bg-[var(--surface-strong)] px-2 py-2">
      <p className="text-lg font-bold text-[var(--foreground)]">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{label}</p>
    </div>
  )
}
