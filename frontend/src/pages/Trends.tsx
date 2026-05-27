import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import type { OverviewDailyStat, SummaryStats, TrendAISummaryResponse } from '../api/client'
import { api } from '../api/client'
import GlossaryText from '../components/GlossaryText'
import InfoPopover from '../components/InfoPopover'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { IMPORT_COMPLETED_EVENT } from '../lib/aiSummaryCache'

const TREND_FLAG_COLORS = {
  good: {
    dot: 'bg-[var(--green-500)]',
    badge: 'bg-[rgba(106,161,54,0.12)] text-[var(--green-700)]',
    border: 'border-[rgba(106,161,54,0.35)]',
  },
  watch: {
    dot: 'bg-[var(--orange-500)]',
    badge: 'bg-[rgba(233,120,75,0.12)] text-[var(--orange-700)]',
    border: 'border-[rgba(233,120,75,0.35)]',
  },
  alert: {
    dot: 'bg-[var(--danger-text)]',
    badge: 'bg-[var(--danger-soft)] text-[var(--danger-text)]',
    border: 'border-[var(--accent-border)]',
  },
} as const

const TREND_DIRECTION_LABEL: Record<string, string> = {
  improving: 'Improving',
  stable: 'Stable',
  worsening: 'Worsening',
  variable: 'Variable',
}

type MetricKey = keyof Pick<
  OverviewDailyStat,
  | 'ahi'
  | 'central_apnea_index'
  | 'obstructive_apnea_index'
  | 'hypopnea_index'
  | 'apnea_index'
  | 'arousal_index'
  | 'usage_hours'
  | 'session_start_hour'
  | 'session_end_hour'
  | 'avg_pressure'
  | 'p95_pressure'
  | 'avg_leak'
  | 'large_leak_minutes'
  | 'avg_flow_lim'
  | 'avg_tidal_vol'
  | 'avg_min_vent'
  | 'avg_resp_rate'
  | 'min_spo2'
  | 'avg_spo2'
  | 'avg_pulse'
  | 'equipment_age_days'
>

interface TrendMetric {
  key: MetricKey
  label: string
  shortLabel: string
  unit: string
  chart: 'line' | 'bar'
  guidance: {
    range: string
    detail: string
    source: string
    sourceUrl: string
  }
  domain?: [number | 'auto', number | 'auto']
  referenceLines?: Array<{ value: number; label: string; color: string }>
  precision?: number
  secondaryKey?: MetricKey
  secondaryLabel?: string
}

const TREND_METRICS: TrendMetric[] = [
  {
    key: 'ahi',
    label: 'AHI',
    shortLabel: 'AHI',
    unit: 'events/hr',
    chart: 'line',
    guidance: {
      range: 'Under 5 events/hr is generally considered normal; 5-14 mild, 15-29 moderate, and 30+ severe.',
      detail: 'AHI is the combined count of apneas and hypopneas per hour. On treatment, many people aim to keep residual AHI below 5 unless their clinician gives a different target.',
      source: 'Cleveland Clinic',
      sourceUrl: 'https://my.clevelandclinic.org/health/articles/apnea-hypopnea-index-ahi',
    },
    referenceLines: [
      { value: 5, label: '5', color: '#6AA136' },
      { value: 15, label: '15', color: '#E9784B' },
    ],
    precision: 1,
  },
  {
    key: 'central_apnea_index',
    label: 'Central apnea index',
    shortLabel: 'CAI',
    unit: 'events/hr',
    chart: 'bar',
    precision: 1,
    guidance: {
      range: 'A central apnea/hypopnea index around 5 or more per hour is commonly used as a clinical flag for central sleep apnea patterns.',
      detail: 'Small numbers can occur on PAP. Persistent or rising central events are worth discussing with a sleep clinician, especially if they make up a large share of AHI.',
      source: 'AASM / Cleveland Clinic',
      sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/40820608/',
    },
  },
  {
    key: 'obstructive_apnea_index',
    label: 'Obstructive apnea index',
    shortLabel: 'OAI',
    unit: 'events/hr',
    chart: 'bar',
    precision: 1,
    guidance: {
      range: 'Lower is better. AHI under 5 events/hr is the usual treated-breathing benchmark, and obstructive events are one component of that total.',
      detail: 'If OAI is the main contributor to AHI, it can point toward residual airway obstruction, mask leak, position, or pressure settings to review.',
      source: 'Cleveland Clinic',
      sourceUrl: 'https://my.clevelandclinic.org/health/articles/apnea-hypopnea-index-ahi',
    },
  },
  {
    key: 'hypopnea_index',
    label: 'Hypopnea index',
    shortLabel: 'HI',
    unit: 'events/hr',
    chart: 'bar',
    precision: 1,
    guidance: {
      range: 'Lower is better. Hypopneas count toward AHI, where under 5 events/hr is generally considered normal.',
      detail: 'A higher hypopnea index means partial breathing reductions are driving more of the nightly AHI.',
      source: 'Cleveland Clinic',
      sourceUrl: 'https://my.clevelandclinic.org/health/articles/apnea-hypopnea-index-ahi',
    },
  },
  {
    key: 'apnea_index',
    label: 'Apnea index',
    shortLabel: 'AI',
    unit: 'events/hr',
    chart: 'bar',
    precision: 1,
    guidance: {
      range: 'Lower is better. This is one component of AHI, and AHI under 5 events/hr is the usual normal benchmark.',
      detail: 'Use this beside CAI/OAI to see whether full pauses are central, obstructive, or mixed in pattern.',
      source: 'Cleveland Clinic',
      sourceUrl: 'https://my.clevelandclinic.org/health/articles/apnea-hypopnea-index-ahi',
    },
  },
  {
    key: 'arousal_index',
    label: 'Arousal index',
    shortLabel: 'Arousal',
    unit: 'events/hr',
    chart: 'bar',
    precision: 1,
    guidance: {
      range: 'There is not one universal home-CPAP cutoff for a good arousal index.',
      detail: 'Watch the trend and context. Arousals can fragment sleep even when AHI looks controlled, but interpretation depends on how events were scored.',
      source: 'AASM',
      sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5337595/',
    },
  },
  {
    key: 'usage_hours',
    label: 'Usage',
    shortLabel: 'Usage',
    unit: 'hours',
    chart: 'line',
    domain: [0, 'auto'],
    precision: 2,
    guidance: {
      range: 'A common adherence benchmark is at least 4 hours per night on at least 70% of nights.',
      detail: 'More full-night use is usually more informative than meeting the minimum insurance-style threshold.',
      source: 'AASM',
      sourceUrl: 'https://aasm.org/resources/pdf/responsetocmsjan.pdf',
    },
  },
  {
    key: 'session_start_hour',
    label: 'Session times',
    shortLabel: 'Times',
    unit: 'clock',
    chart: 'line',
    guidance: {
      range: 'There is no universal good bedtime or wake time in CPAP data.',
      detail: 'Look for consistency, short nights, or schedule changes that line up with AHI, leak, oxygen, or daytime symptoms.',
      source: 'SleepLab trend context',
      sourceUrl: 'https://my.clevelandclinic.org/health/articles/apnea-hypopnea-index-ahi',
    },
    domain: [0, 24],
    precision: 2,
    secondaryKey: 'session_end_hour',
    secondaryLabel: 'End',
  },
  {
    key: 'avg_pressure',
    label: 'Average pressure',
    shortLabel: 'Avg pressure',
    unit: 'cmH2O',
    chart: 'line',
    precision: 1,
    guidance: {
      range: 'There is no single good pressure number; useful pressure depends on prescription, machine mode, and airway needs.',
      detail: 'Watch for pressure changes that line up with residual events, leak, comfort problems, or awakenings.',
      source: 'AASM PAP guidance',
      sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6374094/',
    },
  },
  {
    key: 'p95_pressure',
    label: '95th pressure',
    shortLabel: 'P95 pressure',
    unit: 'cmH2O',
    chart: 'line',
    precision: 1,
    guidance: {
      range: 'There is no universal good 95th pressure; it is a context marker for where pressure spends the high end of the night.',
      detail: 'A rising P95 can reflect more obstruction, position/REM effects, leak response, or pressure range behavior.',
      source: 'AASM PAP guidance',
      sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6374094/',
    },
  },
  {
    key: 'avg_leak',
    label: 'Leak',
    shortLabel: 'Leak',
    unit: 'L/min',
    chart: 'line',
    precision: 1,
    guidance: {
      range: 'For ResMed-style unintentional leak, staying below about 24 L/min is commonly treated as acceptable.',
      detail: 'Short leak spikes matter less than sustained large leak, especially if events rise or therapy feels worse.',
      source: 'ResMed',
      sourceUrl: 'https://document.resmed.com/documents/us/10114280r1_ResMed_Therapy_Handbook_AMER_Eng_Digital_SinglePages.pdf',
    },
  },
  {
    key: 'large_leak_minutes',
    label: 'Large leak time',
    shortLabel: 'Large leak',
    unit: 'min',
    chart: 'bar',
    domain: [0, 'auto'],
    precision: 1,
    guidance: {
      range: 'Less is better. SleepLab currently counts minutes above 24 L/min as large leak time.',
      detail: 'Sustained large leak can make event detection and delivered pressure less reliable.',
      source: 'ResMed',
      sourceUrl: 'https://document.resmed.com/documents/us/10114280r1_ResMed_Therapy_Handbook_AMER_Eng_Digital_SinglePages.pdf',
    },
  },
  {
    key: 'avg_flow_lim',
    label: 'Flow limitation',
    shortLabel: 'Flow lim',
    unit: '',
    chart: 'line',
    precision: 3,
    guidance: {
      range: 'Lower is generally better, but device-reported flow limitation does not have a universal medical cutoff.',
      detail: 'Use it as a trend: increases can suggest partial airway restriction even when AHI remains low.',
      source: 'SleepLab trend context',
      sourceUrl: 'https://my.clevelandclinic.org/health/articles/apnea-hypopnea-index-ahi',
    },
  },
  {
    key: 'avg_tidal_vol',
    label: 'Tidal volume',
    shortLabel: 'Tidal vol',
    unit: 'mL',
    chart: 'line',
    precision: 0,
    guidance: {
      range: 'There is no single good tidal volume in CPAP trend data.',
      detail: 'Interpret in context with minute ventilation, respiratory rate, leak, body size, and sleep stage.',
      source: 'SleepLab trend context',
      sourceUrl: 'https://my.clevelandclinic.org/health/articles/10881-vital-signs',
    },
  },
  {
    key: 'avg_min_vent',
    label: 'Minute ventilation',
    shortLabel: 'Min vent',
    unit: 'L/min',
    chart: 'line',
    precision: 1,
    guidance: {
      range: 'There is no universal good minute-ventilation target in home CPAP trend data.',
      detail: 'Look for night-to-night shifts alongside respiratory rate, tidal volume, leak, and oxygen saturation.',
      source: 'SleepLab trend context',
      sourceUrl: 'https://my.clevelandclinic.org/health/articles/10881-vital-signs',
    },
  },
  {
    key: 'avg_resp_rate',
    label: 'Respiratory rate',
    shortLabel: 'Resp rate',
    unit: 'breaths/min',
    chart: 'line',
    precision: 1,
    guidance: {
      range: 'Cleveland Clinic lists a normal adult resting respiratory rate around 12-18 breaths per minute.',
      detail: 'Sleeping values can vary. Watch persistent shifts or changes paired with oxygen drops, leaks, or symptoms.',
      source: 'Cleveland Clinic',
      sourceUrl: 'https://my.clevelandclinic.org/health/articles/10881-vital-signs',
    },
  },
  {
    key: 'min_spo2',
    label: 'SpO2 minimum',
    shortLabel: 'Min SpO2',
    unit: '%',
    chart: 'line',
    domain: [70, 100],
    precision: 0,
    guidance: {
      range: 'Cleveland Clinic lists 95%-100% as normal for most pulse-oximeter readings.',
      detail: 'A brief minimum can be artifact, but repeated or sustained drops below normal are worth reviewing with a clinician.',
      source: 'Cleveland Clinic',
      sourceUrl: 'https://my.clevelandclinic.org/health/diagnostics/22447-blood-oxygen-level',
    },
  },
  {
    key: 'avg_spo2',
    label: 'SpO2 average',
    shortLabel: 'Avg SpO2',
    unit: '%',
    chart: 'line',
    domain: [70, 100],
    precision: 1,
    guidance: {
      range: 'For most people, pulse-oximeter SpO2 of 95%-100% is considered normal.',
      detail: 'Average SpO2 should be interpreted with minimum SpO2 and time spent low, not as a standalone diagnosis.',
      source: 'Cleveland Clinic',
      sourceUrl: 'https://my.clevelandclinic.org/health/diagnostics/22447-blood-oxygen-level',
    },
  },
  {
    key: 'avg_pulse',
    label: 'Pulse',
    shortLabel: 'Pulse',
    unit: 'bpm',
    chart: 'line',
    precision: 0,
    guidance: {
      range: 'Cleveland Clinic lists normal adult resting pulse around 60-100 bpm.',
      detail: 'Sleep pulse is often lower than daytime resting pulse. Trends are most useful beside SpO2, events, medications, and symptoms.',
      source: 'Cleveland Clinic',
      sourceUrl: 'https://my.clevelandclinic.org/health/articles/10881-vital-signs',
    },
  },
  {
    key: 'equipment_age_days',
    label: 'Equipment age',
    shortLabel: 'Equipment',
    unit: 'days',
    chart: 'line',
    domain: [0, 'auto'],
    precision: 0,
    guidance: {
      range: 'Replacement timing depends on the part, wear, insurance schedule, and manufacturer guidance.',
      detail: 'Use this to spot whether leak or comfort worsens as masks, cushions, tubing, filters, or chambers age.',
      source: 'SleepLab equipment context',
      sourceUrl: 'https://my.clevelandclinic.org/health/articles/apnea-hypopnea-index-ahi',
    },
  },
]

const TREND_METRIC_GROUPS = [
  {
    label: 'Events',
    keys: ['ahi', 'central_apnea_index', 'obstructive_apnea_index', 'hypopnea_index', 'apnea_index', 'arousal_index'],
  },
  {
    label: 'Therapy',
    keys: ['usage_hours', 'session_start_hour', 'avg_pressure', 'p95_pressure', 'avg_leak', 'large_leak_minutes'],
  },
  {
    label: 'Breathing',
    keys: ['avg_flow_lim', 'avg_tidal_vol', 'avg_min_vent', 'avg_resp_rate'],
  },
  {
    label: 'Oximetry',
    keys: ['min_spo2', 'avg_spo2', 'avg_pulse'],
  },
  {
    label: 'Equipment',
    keys: ['equipment_age_days'],
  },
] satisfies Array<{ label: string; keys: MetricKey[] }>

const RANGE_OPTIONS = [
  { label: '90D', days: 90 },
  { label: '180D', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'All', days: 3650 },
]

function getMetric(key: MetricKey) {
  return TREND_METRICS.find((metric) => metric.key === key) ?? TREND_METRICS[0]
}

function TrendAICard() {
  const [data, setData] = useState<TrendAISummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null)
  const [refreshState, setRefreshState] = useState({ token: 0, force: false })

  useEffect(() => {
    api.getImportSettings()
      .then((settings) => setAiConfigured(settings.llm_configured))
      .catch(() => setAiConfigured(false))
  }, [])

  useEffect(() => {
    if (aiConfigured !== true) {
      return
    }
    setLoading(true)
    api
      .getTrendAISummary(refreshState.force)
      .then(setData)
      .finally(() => setLoading(false))
  }, [aiConfigured, refreshState])

  if (aiConfigured !== true) {
    return null
  }

  const flag = (data?.flag ?? 'watch') as keyof typeof TREND_FLAG_COLORS
  const colors = TREND_FLAG_COLORS[flag] ?? TREND_FLAG_COLORS.watch
  const directionLabel = data?.trend_direction ? TREND_DIRECTION_LABEL[data.trend_direction] ?? data.trend_direction : null

  return (
    <Card className="overflow-hidden border-[var(--border)] bg-[radial-gradient(circle_at_top_left,_rgba(82,81,167,0.10),_transparent_28%),radial-gradient(circle_at_90%_18%,_rgba(106,161,54,0.10),_transparent_20%),var(--surface-strong)]">
      <CardContent className="p-6 pt-6">
        <div className="flex min-h-10 items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${loading ? 'bg-[var(--accent)] animate-pulse' : colors.dot}`} />
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">AI Trend Analysis</p>
          </div>
          {!loading && data && !data.error && directionLabel && (
            <div className="flex shrink-0 items-center gap-2">
              <div className={`rounded-full px-3 py-1 text-xs font-bold ${colors.badge}`}>
                {data.cached ? 'Cached' : directionLabel}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => setRefreshState((current) => ({ token: current.token + 1, force: true }))}
              >
                Regenerate
              </Button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="mt-4 space-y-2.5">
            <div className="h-5 w-3/4 animate-pulse rounded bg-[var(--accent-soft)]" />
            <div className="h-4 w-full animate-pulse rounded bg-[var(--accent-soft)]" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-[var(--accent-soft)]" />
          </div>
        ) : data?.error ? (
          <p className="mt-4 text-sm text-[var(--muted-foreground)]">{data.error}</p>
        ) : data?.headline ? (
          <>
            <p className="mt-3 text-lg font-extrabold leading-7 text-[var(--foreground)]">
              <GlossaryText text={data.headline} />
            </p>
            {data.therapy_quality && (
              <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
                <GlossaryText text={data.therapy_quality} />
              </p>
            )}
            {(data.high_confidence_observations ?? data.anomalies) && (
              <ul className={`mt-4 space-y-2 border-l-2 pl-3 ${colors.border}`}>
                {(data.high_confidence_observations ?? data.anomalies ?? []).map((item) => (
                  <li key={item} className="text-sm leading-6 text-[var(--muted-foreground)]">
                    <GlossaryText text={item} />
                  </li>
                ))}
              </ul>
            )}
            {data.possible_patterns && data.possible_patterns.length > 0 && (
              <ul className={`mt-4 space-y-2 border-l-2 pl-3 ${colors.border}`}>
                {data.possible_patterns.map((item) => (
                  <li key={item} className="text-sm leading-6 text-[var(--muted-foreground)]">
                    <GlossaryText text={item} />
                  </li>
                ))}
              </ul>
            )}
            {data.things_to_review && data.things_to_review.length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Review</p>
                <ul className="mt-2 space-y-2">
                  {data.things_to_review.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm leading-6 text-[var(--foreground)]">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                      <GlossaryText text={item} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.missing_or_uncertain && data.missing_or_uncertain.length > 0 && (
              <div className="mt-5 border-l-2 border-[var(--border)] pl-3">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Uncertain</p>
                <ul className="mt-2 space-y-1.5 text-sm leading-6 text-[var(--muted-foreground)]">
                  {data.missing_or_uncertain.map((item) => (
                    <li key={item}>
                      <GlossaryText text={item} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-5 text-xs text-[var(--muted-foreground)]">
              AI-generated. Not medical advice. Discuss any concerns with your doctor or sleep specialist.
            </p>
          </>
        ) : (
          <p className="mt-4 text-sm text-[var(--muted-foreground)]">AI trend analysis unavailable.</p>
        )}
      </CardContent>
    </Card>
  )
}

function ahiTone(ahi: number | null) {
  if (ahi == null) return 'text-[var(--muted-foreground)]'
  if (ahi < 5) return 'text-[var(--green-700)]'
  if (ahi < 15) return 'text-[var(--yellow-700)]'
  return 'text-[var(--orange-700)]'
}

function humanizeEventType(eventType: string) {
  return eventType
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatMetricValue(value: number | null | undefined, metric: TrendMetric) {
  if (value == null) return '-'
  if (metric.unit === 'clock') return formatClockHour(value)
  const precision = metric.precision ?? 1
  const formatted = value.toFixed(precision)
  return metric.unit ? `${formatted} ${metric.unit}` : formatted
}

function formatMetricRange(low: number, high: number, metric: TrendMetric) {
  if (metric.unit === 'clock') {
    return `${formatClockHour(low)} / ${formatClockHour(high)}`
  }

  const precision = metric.precision ?? 1
  const lowValue = low.toFixed(precision)
  const highValue = high.toFixed(precision)
  return metric.unit ? `${lowValue} / ${highValue} ${metric.unit}` : `${lowValue} / ${highValue}`
}

function formatMetricDelta(value: number | null | undefined, metric: TrendMetric) {
  if (value == null) return '-'
  const sign = value >= 0 ? '+' : ''
  if (metric.unit === 'clock') return `${sign}${value.toFixed(2)} hr`
  return `${sign}${formatMetricValue(value, metric)}`
}

function roundsToZero(value: number, metric: TrendMetric) {
  const precision = metric.precision ?? 1
  return Number(value.toFixed(precision)) === 0
}

function formatClockHour(hour: number) {
  const normalized = ((hour % 24) + 24) % 24
  const wholeHours = Math.floor(normalized)
  const minutes = Math.round((normalized - wholeHours) * 60)
  const displayHours = minutes === 60 ? (wholeHours + 1) % 24 : wholeHours
  const displayMinutes = minutes === 60 ? 0 : minutes
  const suffix = displayHours >= 12 ? 'PM' : 'AM'
  const hour12 = displayHours % 12 || 12
  return `${hour12}:${String(displayMinutes).padStart(2, '0')} ${suffix}`
}

function getActiveSessionId(payload: unknown) {
  if (!payload || typeof payload !== 'object' || !('activePayload' in payload)) {
    return null
  }
  const activePayload = (payload as { activePayload?: Array<{ payload?: { sessionId?: unknown } }> }).activePayload
  const sessionId = activePayload?.[0]?.payload?.sessionId
  return typeof sessionId === 'string' ? sessionId : null
}

function metricNumber(value: OverviewDailyStat[MetricKey]) {
  return typeof value === 'number' ? value : null
}

function calculateMetricSummary(nights: OverviewDailyStat[], metric: TrendMetric) {
  const points = nights
    .map((night) => ({ night, value: metricNumber(night[metric.key]) }))
    .filter((point): point is { night: OverviewDailyStat; value: number } => point.value != null)

  if (points.length === 0) {
    return null
  }

  const average = points.reduce((sum, point) => sum + point.value, 0) / points.length
  const latest = points[points.length - 1]
  const lowest = points.reduce((best, point) => point.value < best.value ? point : best, points[0])
  const highest = points.reduce((best, point) => point.value > best.value ? point : best, points[0])
  const recent = points.slice(-7)
  const previous = points.slice(Math.max(0, points.length - 14), Math.max(0, points.length - 7))
  const recentAverage = recent.reduce((sum, point) => sum + point.value, 0) / recent.length
  const previousAverage = previous.length > 0
    ? previous.reduce((sum, point) => sum + point.value, 0) / previous.length
    : null
  const change = previousAverage == null ? null : recentAverage - previousAverage

  return { average, latest, lowest, highest, change }
}

function MetricSummaryCards({ nights, metric }: { nights: OverviewDailyStat[]; metric: TrendMetric }) {
  const summary = calculateMetricSummary(nights, metric)

  if (!summary) {
    return (
      <div className="mb-5 rounded-[16px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-4 text-sm text-[var(--muted-foreground)]">
        No values are available for this metric in the selected range.
      </div>
    )
  }

  const changeLabel = summary.change == null
    ? 'Not enough history'
    : roundsToZero(summary.change, metric)
      ? 'No meaningful change'
      : `${formatMetricDelta(summary.change, metric)} vs prior 7 nights`

  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Latest</p>
        <p className="mt-2 text-lg font-extrabold text-[var(--foreground)]">{formatMetricValue(summary.latest.value, metric)}</p>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">{summary.latest.night.folder_date}</p>
      </div>
      <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Average</p>
        <p className="mt-2 text-lg font-extrabold text-[var(--foreground)]">{formatMetricValue(summary.average, metric)}</p>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">{nights.length} nights selected</p>
      </div>
      <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Low / High</p>
        <p className="mt-2 text-lg font-extrabold text-[var(--foreground)]">
          {formatMetricRange(summary.lowest.value, summary.highest.value, metric)}
        </p>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          {summary.lowest.night.folder_date} / {summary.highest.night.folder_date}
        </p>
      </div>
      <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Recent shift</p>
        <p className="mt-2 text-lg font-extrabold text-[var(--foreground)]">{changeLabel}</p>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">7-night average comparison</p>
      </div>
    </div>
  )
}

function OverviewChart({
  nights,
  metric,
}: {
  nights: OverviewDailyStat[]
  metric: TrendMetric
}) {
  const navigate = useNavigate()
  const data = nights.map((night) => ({
    ...night,
    date: night.folder_date,
    primary: night[metric.key],
    secondary: metric.secondaryKey ? night[metric.secondaryKey] : null,
  }))

  return (
    <Card id="long-range-overview">
      <CardContent className="px-4 pb-5 pt-5 sm:px-6 sm:pt-6">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-[var(--foreground)]">{metric.label}</p>
              <InfoPopover title={`${metric.label} guidance`}>
                <div className="space-y-2">
                  <p>{metric.guidance.range}</p>
                  <p>{metric.guidance.detail}</p>
                  <a
                    href={metric.guidance.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex font-bold text-[var(--accent)] hover:text-[var(--accent-hover)]"
                  >
                    Source: {metric.guidance.source}
                  </a>
                  <p className="text-xs leading-5">General education only. Use your clinician's target when it differs.</p>
                </div>
              </InfoPopover>
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">{nights.length} nights in the selected range</p>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">{metric.unit || 'Index'}</p>
        </div>
        <MetricSummaryCards nights={nights} metric={metric} />
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart
            data={data}
            margin={{ top: 12, right: 16, bottom: 0, left: 0 }}
            onClick={(payload) => {
              const sessionId = getActiveSessionId(payload)
              if (sessionId) {
                navigate(`/sessions/${sessionId}`)
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-200)" />
            <XAxis
              dataKey="date"
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              tickFormatter={(value: string) => value.slice(5)}
              minTickGap={24}
            />
            <YAxis
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              domain={metric.domain ?? [0, 'auto']}
              tickFormatter={(value) => metric.unit === 'clock' ? formatClockHour(Number(value)).replace(':00 ', ' ') : String(value)}
              width={54}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--popover-surface)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                color: 'var(--foreground)',
              }}
              labelStyle={{ color: 'var(--foreground)' }}
              formatter={(value, name) => {
                const label = name === 'secondary' ? (metric.secondaryLabel ?? 'End') : metric.shortLabel
                return [formatMetricValue(typeof value === 'number' ? value : null, metric), label]
              }}
            />
            {metric.referenceLines?.map((line) => (
              <ReferenceLine
                key={line.value}
                y={line.value}
                stroke={line.color}
                strokeDasharray="4 4"
                label={{ value: line.label, fill: line.color, fontSize: 10 }}
              />
            ))}
            {metric.chart === 'bar' ? (
              <Bar dataKey="primary" name={metric.shortLabel} fill="#5251A7" radius={[6, 6, 0, 0]} maxBarSize={28} />
            ) : (
              <Line
                type="monotone"
                dataKey="primary"
                name={metric.shortLabel}
                stroke="#5251A7"
                dot={false}
                strokeWidth={2}
                connectNulls
              />
            )}
            {metric.secondaryKey ? (
              <Line
                type="monotone"
                dataKey="secondary"
                name={metric.secondaryLabel ?? 'End'}
                stroke="#6AA136"
                dot={false}
                strokeWidth={2}
                connectNulls
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

function RecentOverviewTable({ nights, metric }: { nights: OverviewDailyStat[]; metric: TrendMetric }) {
  const recent = nights.slice(-10).reverse()

  return (
    <Card id="overview-table">
      <CardContent className="px-0 pb-2 pt-5 sm:pt-6">
        <div className="px-5 sm:px-6">
          <p className="text-sm font-bold text-[var(--foreground)]">Recent nights</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Latest values for the selected trend.</p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-y border-[var(--border)] bg-[var(--surface-soft)] text-left text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                <th className="px-5 py-3 sm:px-6">Date</th>
                <th className="px-5 py-3 sm:px-6">{metric.shortLabel}</th>
                <th className="px-5 py-3 sm:px-6">AHI</th>
                <th className="px-5 py-3 sm:px-6">Usage</th>
                <th className="px-5 py-3 sm:px-6">Leak</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((night) => (
                <tr key={night.folder_date} className="border-b border-[var(--border)] last:border-b-0">
                  <td className="px-5 py-3 font-bold text-[var(--foreground)] sm:px-6">{night.folder_date}</td>
                  <td className="px-5 py-3 text-[var(--foreground)] sm:px-6">
                    {formatMetricValue(night[metric.key], metric)}
                    {metric.secondaryKey ? (
                      <span className="ml-2 text-[var(--muted-foreground)]">
                        to {formatMetricValue(night[metric.secondaryKey], metric)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-5 py-3 text-[var(--muted-foreground)] sm:px-6">{formatMetricValue(night.ahi, getMetric('ahi'))}</td>
                  <td className="px-5 py-3 text-[var(--muted-foreground)] sm:px-6">{night.usage_hours.toFixed(2)} hours</td>
                  <td className="px-5 py-3 text-[var(--muted-foreground)] sm:px-6">{formatMetricValue(night.avg_leak, getMetric('avg_leak'))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

export default function TrendsPage() {
  const [summary, setSummary] = useState<SummaryStats | null>(null)
  const [overview, setOverview] = useState<OverviewDailyStat[]>([])
  const [rangeDays, setRangeDays] = useState(180)
  const [metricKey, setMetricKey] = useState<MetricKey>('ahi')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const metric = getMetric(metricKey)

  useEffect(() => {
    async function loadTrends() {
      try {
        const [data, overviewData] = await Promise.all([
          api.getSummary(),
          api.getOverviewStats(rangeDays),
        ])
        setSummary(data)
        setOverview(overviewData.nights)
        setError(null)
      } catch (err) {
        setError(String(err))
      } finally {
        setLoading(false)
      }
    }

    void loadTrends()

    function handleImportCompleted() {
      setLoading(true)
      void loadTrends()
    }

    window.addEventListener(IMPORT_COMPLETED_EVENT, handleImportCompleted)
    return () => window.removeEventListener(IMPORT_COMPLETED_EVENT, handleImportCompleted)
  }, [rangeDays])

  if (loading) {
    return <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface-strong)] p-10 text-center text-[var(--muted-foreground)]">Loading trends...</div>
  }

  if (error || !summary) {
    return <div className="rounded-[22px] border border-[var(--accent-border)] bg-[var(--danger-soft)] p-10 text-center text-[var(--danger-text)]">Error loading trends: {error ?? 'Unknown error'}</div>
  }

  const sortedBreakdown = Object.entries(summary.event_breakdown)
    .sort((left, right) => right[1] - left[1])

  return (
    <div className="space-y-6">
      <TrendAICard />

      <div className="grid gap-4 md:grid-cols-3">
        <Card id="ahi-summary" className="bg-[radial-gradient(circle_at_top_left,_rgba(82,81,167,0.08),_transparent_32%),var(--surface-strong)]">
          <CardContent className="px-6 pb-6 pt-7">
            <p className="text-sm font-bold text-[var(--foreground)]">Average AHI</p>
            <p className={`mt-2 text-4xl font-semibold ${ahiTone(summary.avg_ahi)}`}>{summary.avg_ahi?.toFixed(1) ?? '—'}</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">Average breathing events per hour.</p>
          </CardContent>
        </Card>
        <Card id="usage-trend" className="bg-[radial-gradient(circle_at_top_left,_rgba(106,161,54,0.08),_transparent_32%),var(--surface-strong)]">
          <CardContent className="px-6 pb-6 pt-7">
            <p className="text-sm font-bold text-[var(--foreground)]">Compliance</p>
            <p className="mt-2 text-4xl font-semibold text-[var(--foreground)]">{summary.compliance_pct}%</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">How consistently therapy was used.</p>
          </CardContent>
        </Card>
        <Card id="pressure-trend" className="bg-[radial-gradient(circle_at_top_left,_rgba(233,120,75,0.08),_transparent_32%),var(--surface-strong)]">
          <CardContent className="px-6 pb-6 pt-7">
            <p className="text-sm font-bold text-[var(--foreground)]">Average Pressure</p>
            <p className="mt-2 text-4xl font-semibold text-[var(--foreground)]">{summary.avg_pressure?.toFixed(1) ?? '—'}</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">Typical treatment pressure across recent nights.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="px-4 pb-5 pt-5 sm:px-6 sm:pt-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-bold text-[var(--foreground)]">Long-range overview</p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">Pick a range and metric to scan nightly therapy patterns over time.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <div className="grid grid-cols-4 rounded-full border border-[var(--border)] bg-[var(--surface-soft)] p-1">
                {RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.days}
                    type="button"
                    className={`rounded-full px-3 py-2 text-sm font-bold transition ${
                      rangeDays === option.days
                        ? 'bg-[var(--surface-strong)] text-[var(--accent)]'
                        : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                    }`}
                    onClick={() => {
                      setLoading(true)
                      setRangeDays(option.days)
                    }}
                    aria-pressed={rangeDays === option.days}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <select
                className="h-11 min-w-56 rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-4 text-sm font-bold text-[var(--foreground)] outline-none focus:border-[var(--accent-border)]"
                value={metricKey}
                onChange={(event) => setMetricKey(event.target.value as MetricKey)}
                aria-label="Jump to any trend metric"
                title="Jump to any metric"
              >
                <option value={metricKey}>Jump to metric...</option>
                {TREND_METRICS.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_1fr] xl:grid-cols-[1.1fr_1fr_0.75fr]">
            {TREND_METRIC_GROUPS.map((group) => (
              <div key={group.label} className="min-w-0">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{group.label}</p>
                <div className="flex flex-wrap gap-2">
                  {group.keys.map((key) => {
                    const option = getMetric(key)
                    return (
                      <Button
                        key={option.key}
                        variant={metricKey === option.key ? 'default' : 'outline'}
                        size="sm"
                        className="h-8 px-3 text-xs sm:h-9 sm:text-sm"
                        onClick={() => setMetricKey(option.key)}
                      >
                        {option.shortLabel}
                      </Button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {overview.length > 0 ? (
        <>
          <OverviewChart nights={overview} metric={metric} />
          <RecentOverviewTable nights={overview} metric={metric} />
        </>
      ) : (
        <Card>
          <CardContent className="px-6 pb-6 pt-7 text-center text-sm text-[var(--muted-foreground)]">
            No trend rows are available for this range.
          </CardContent>
        </Card>
      )}

      <Card id="event-breakdown">
        <CardContent className="px-6 pb-6 pt-7">
          <p className="text-sm font-bold text-[var(--foreground)]">Respiratory event breakdown</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">A simple count of the breathing-event types found across your imported nights.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {sortedBreakdown.map(([eventType, count]) => (
              <div key={eventType} className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-4">
                <p className="text-sm font-bold text-[var(--foreground)]">{humanizeEventType(eventType)}</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--foreground)]">{count}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
