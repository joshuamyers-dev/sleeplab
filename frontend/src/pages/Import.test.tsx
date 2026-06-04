import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import OximeterImportSummary from '../components/OximeterImportSummary'
import { collectOximeterFilesFromInput } from '../lib/oximeterFiles'

function file(name: string) {
  return new File(['data'], name, { type: 'application/octet-stream' })
}

describe('collectOximeterFilesFromInput', () => {
  it('keeps extensionless Viatom filenames', () => {
    const result = collectOximeterFilesFromInput([
      file('20250115220000'),
      file('notes.txt'),
      file('.DS_Store'),
    ])

    expect(result.map((entry) => entry.name)).toEqual(['20250115220000'])
  })

  it('keeps common binary export extensions', () => {
    const result = collectOximeterFilesFromInput([
      file('o2-night.bin'),
      file('1745080270764.dat'),
      file('report.csv'),
    ])

    expect(result.map((entry) => entry.name)).toEqual(['1745080270764.dat', 'o2-night.bin'])
  })
})

describe('OximeterImportSummary', () => {
  it('renders imported, skipped, unmatched, and failed result states', () => {
    render(
      <OximeterImportSummary
        result={{
          imported: 1,
          skipped: 1,
          unmatched: 1,
          failed: 1,
          results: [
            { filename: 'imported.bin', status: 'imported', message: 'Imported oximeter data', sample_count: 2 },
            { filename: 'skipped.bin', status: 'skipped', message: 'Session already has SpO2 data' },
            { filename: 'unmatched.bin', status: 'unmatched', message: 'No existing CPAP session overlaps this oximeter recording' },
            { filename: 'failed.bin', status: 'failed', message: 'Unsupported Viatom/Wellue signature' },
          ],
        }}
      />,
    )

    expect(screen.getByText('imported.bin')).toBeInTheDocument()
    expect(screen.getByText('skipped.bin')).toBeInTheDocument()
    expect(screen.getByText('unmatched.bin')).toBeInTheDocument()
    expect(screen.getByText('failed.bin')).toBeInTheDocument()
  })
})
