import type { MetricsResponse } from '../api/client'

export type MetricPoint = {
  ts: number
  pressure: number | null
  leak: number | null
  resp_rate: number | null
  flow_lim: number | null
  snore: number | null
  min_vent: number | null
}

export type MetricKey = keyof Omit<MetricPoint, 'ts'>

const GAP_THRESHOLD_MS = 5 * 60 * 1000
const MIN_THERAPY_BLOCK_MS = 300 * 1000
const DOMAIN_PADDING_MS = 12 * 60 * 1000

function hasAnyMetricValue(point: MetricPoint) {
  return point.pressure != null
    || point.leak != null
    || point.resp_rate != null
    || point.flow_lim != null
    || point.snore != null
    || point.min_vent != null
}

export function emptyMetricPoint(ts: number): MetricPoint {
  return { ts, pressure: null, leak: null, resp_rate: null, flow_lim: null, snore: null, min_vent: null }
}

export function metricsToPoints(metrics: MetricsResponse): MetricPoint[] {
  return metrics.timestamps.map((ts, i) => ({
    ts: new Date(ts).getTime(),
    pressure: metrics.pressure[i],
    leak: metrics.leak[i] != null ? metrics.leak[i]! * 1000 : null,
    resp_rate: metrics.resp_rate[i],
    flow_lim: metrics.flow_lim[i],
    snore: metrics.snore[i],
    min_vent: metrics.min_vent[i],
  }))
}

export function computeMetricsDomain(points: MetricPoint[]): [number, number] | null {
  const sorted = points
    .filter((point) => Number.isFinite(point.ts) && hasAnyMetricValue(point))
    .sort((a, b) => a.ts - b.ts)

  if (!sorted.length) return null

  const blocks: MetricPoint[][] = []
  for (const point of sorted) {
    const current = blocks.at(-1)
    const previous = current?.at(-1)
    if (!current || !previous || point.ts - previous.ts > GAP_THRESHOLD_MS) {
      blocks.push([point])
    } else {
      current.push(point)
    }
  }

  const meaningfulBlocks = blocks.filter((block) => {
    const first = block[0]
    const last = block.at(-1)
    return first && last && last.ts - first.ts >= MIN_THERAPY_BLOCK_MS
  })
  const includedBlocks = meaningfulBlocks.length ? meaningfulBlocks : blocks
  const firstTs = includedBlocks[0][0].ts
  const lastBlock = includedBlocks.at(-1)!
  const lastTs = lastBlock.at(-1)!.ts

  return [firstTs - DOMAIN_PADDING_MS, lastTs + DOMAIN_PADDING_MS]
}

export function addMetricGapBreaks(points: MetricPoint[]): MetricPoint[] {
  const data: MetricPoint[] = []

  for (let i = 0; i < points.length; i++) {
    const previous = points[i - 1]
    const point = points[i]
    if (previous && point.ts - previous.ts > GAP_THRESHOLD_MS) {
      data.push(emptyMetricPoint(previous.ts + 1))
      data.push(emptyMetricPoint(point.ts - 1))
    }
    data.push(point)
  }

  return data
}
