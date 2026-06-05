import type { Meta, StoryObj } from '@storybook/react';
import Import from './Import';
import OximeterImportSummary from '../components/OximeterImportSummary';

const meta = {
  title: 'Pages/Import',
  component: Import,
  tags: ['autodocs'],
} satisfies Meta<typeof Import>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SummaryImportedOnly: Story = {
  name: 'Oximeter Summary - Imported Only',
  render: () => (
    <div className="mx-auto max-w-2xl">
      <OximeterImportSummary
        result={{
          imported: 2,
          skipped: 0,
          unmatched: 0,
          failed: 0,
          results: [
            {
              filename: '2023-10-01_23-00-00.bin',
              status: 'imported',
              message: 'Matched to session',
              sample_count: 28800,
            },
            {
              filename: '2023-10-02_23-15-00.bin',
              status: 'imported',
              message: 'Matched to session',
              sample_count: 27500,
            },
          ],
        }}
      />
    </div>
  ),
};

export const SummaryWithSkippedAndUnmatched: Story = {
  name: 'Oximeter Summary - Mixed with Skipped & Unmatched',
  render: () => (
    <div className="mx-auto max-w-2xl">
      <OximeterImportSummary
        result={{
          imported: 1,
          skipped: 2,
          unmatched: 1,
          failed: 0,
          results: [
            {
              filename: '2023-10-01_23-00-00.bin',
              status: 'imported',
              message: 'Matched to session',
              sample_count: 28800,
            },
            {
              filename: '2023-10-02_23-15-00.bin',
              status: 'skipped',
              message: 'Oximeter data already exists for this session',
            },
            {
              filename: '2023-10-03_23-30-00.bin',
              status: 'skipped',
              message: 'Oximeter data already exists for this session',
            },
            {
              filename: '2023-10-04_14-00-00.bin',
              status: 'unmatched',
              message: 'No CPAP session found at this time',
            },
          ],
        }}
      />
    </div>
  ),
};

export const SummaryWithFailures: Story = {
  name: 'Oximeter Summary - Failures',
  render: () => (
    <div className="mx-auto max-w-2xl">
      <OximeterImportSummary
        result={{
          imported: 0,
          skipped: 0,
          unmatched: 0,
          failed: 3,
          results: [
            {
              filename: 'corrupted_file_1.bin',
              status: 'failed',
              message: 'Invalid file signature',
            },
            {
              filename: 'empty_file.bin',
              status: 'failed',
              message: 'File is empty',
            },
            {
              filename: 'unknown_format.dat',
              status: 'failed',
              message: 'Unsupported format version',
            },
          ],
        }}
      />
    </div>
  ),
};

export const SummaryAllStatesCombined: Story = {
  name: 'Oximeter Summary - All States Combined',
  render: () => (
    <div className="mx-auto max-w-2xl">
      <OximeterImportSummary
        result={{
          imported: 2,
          skipped: 1,
          unmatched: 1,
          failed: 1,
          results: [
            {
              filename: '2023-10-01.bin',
              status: 'imported',
              message: 'Matched to session',
              sample_count: 28800,
            },
            {
              filename: '2023-10-02.bin',
              status: 'imported',
              message: 'Matched to session',
              sample_count: 29100,
            },
            {
              filename: '2023-10-03.bin',
              status: 'skipped',
              message: 'Already exists',
            },
            {
              filename: '2023-10-04.bin',
              status: 'unmatched',
              message: 'No CPAP session found',
            },
            {
              filename: '2023-10-05.bin',
              status: 'failed',
              message: 'Invalid file format',
            },
          ],
        }}
      />
    </div>
  ),
};
