import { describe, expect, it } from 'vitest'

import type { MetricsResponse } from '../api/client'
import { addMetricGapBreaks, computeMetricsDomain, metricsToPoints } from './metricsChartDomain'

function iso(ms: number) {
  return new Date(ms).toISOString()
}

function metricsResponse(timestamps: number[]): MetricsResponse {
  return {
    timestamps: timestamps.map(iso),
    mask_pressure: timestamps.map(() => null),
    pressure: timestamps.map(() => 10),
    epr_pressure: timestamps.map(() => null),
    leak: timestamps.map(() => null),
    resp_rate: timestamps.map(() => 14),
    tidal_vol: timestamps.map(() => null),
    min_vent: timestamps.map(() => null),
    snore: timestamps.map(() => null),
    flow_lim: timestamps.map(() => null),
  }
}

function metricsResponseWithPressure(timestamps: number[], pressureForTimestamp: (ts: number) => number): MetricsResponse {
  return {
    ...metricsResponse(timestamps),
    pressure: timestamps.map(pressureForTimestamp),
    leak: timestamps.map(() => 0.01),
  }
}

function everyTwoMinutes(start: number, end: number) {
  const values: number[] = []
  for (let ts = start; ts <= end; ts += 2 * 60 * 1000) values.push(ts)
  return values
}

describe('computeMetricsDomain', () => {
  it('ignores tiny afternoon blocks when sizing the night metrics chart domain', () => {
    const tinyBlock = [
      Date.UTC(2026, 5, 1, 16, 59, 24),
      Date.UTC(2026, 5, 1, 17, 0, 24),
    ]
    const realBlockOneStart = Date.UTC(2026, 5, 2, 3, 59, 51)
    const realBlockThreeEnd = Date.UTC(2026, 5, 2, 10, 8, 31)
    const realBlocks = [
      ...everyTwoMinutes(realBlockOneStart, Date.UTC(2026, 5, 2, 5, 17, 51)),
      ...everyTwoMinutes(Date.UTC(2026, 5, 2, 5, 19, 31), Date.UTC(2026, 5, 2, 8, 27, 31)),
      ...everyTwoMinutes(Date.UTC(2026, 5, 2, 8, 28, 33), realBlockThreeEnd),
      realBlockThreeEnd,
    ]

    const domain = computeMetricsDomain(metricsToPoints(metricsResponse([...tinyBlock, ...realBlocks])))

    expect(domain).not.toBeNull()
    expect(domain![0]).toBe(realBlockOneStart - 12 * 60 * 1000)
    expect(domain![1]).toBe(realBlockThreeEnd + 12 * 60 * 1000)
    expect(domain![0]).toBeGreaterThan(tinyBlock[1])
  })

  it('keeps first real overnight block samples in the plotted chart data', () => {
    const tinyBlock = [
      Date.UTC(2026, 5, 1, 16, 59, 24),
      Date.UTC(2026, 5, 1, 17, 0, 24),
    ]
    const blockOne = everyTwoMinutes(
      Date.UTC(2026, 5, 2, 3, 59, 51),
      Date.UTC(2026, 5, 2, 5, 17, 51),
    )
    const blockTwo = everyTwoMinutes(
      Date.UTC(2026, 5, 2, 5, 19, 31),
      Date.UTC(2026, 5, 2, 8, 27, 31),
    )
    const blockThree = [
      ...everyTwoMinutes(Date.UTC(2026, 5, 2, 8, 28, 33), Date.UTC(2026, 5, 2, 10, 8, 31)),
      Date.UTC(2026, 5, 2, 10, 8, 31),
    ]
    const timestamps = [...tinyBlock, ...blockOne, ...blockTwo, ...blockThree]
    const metrics = metricsResponseWithPressure(timestamps, (ts) => blockOne.includes(ts) ? 4 : 10)
    const rawPoints = metricsToPoints(metrics)
    const domain = computeMetricsDomain(rawPoints)

    expect(domain).not.toBeNull()

    const plottedData = addMetricGapBreaks(rawPoints)
      .filter((point) => point.ts >= domain![0] && point.ts <= domain![1])
    const plottedSampleTimes = new Set(plottedData.filter((point) => point.pressure != null).map((point) => point.ts))

    expect(plottedSampleTimes.has(tinyBlock[0])).toBe(false)
    expect(blockOne.every((ts) => plottedSampleTimes.has(ts))).toBe(true)
    expect(blockTwo.every((ts) => plottedSampleTimes.has(ts))).toBe(true)
    expect(blockThree.every((ts) => plottedSampleTimes.has(ts))).toBe(true)
  })
})
