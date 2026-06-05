import { getApiBaseUrl } from '../config'

const BASE = getApiBaseUrl()
const TOKEN_STORAGE_KEY = 'cpap_auth_token'

/**
 * Class representing the unauthorized error.
 */
export class UnauthorizedError extends Error {
  constructor(message = 'Authentication required') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

/**
 * Represents the version status payload returned by the SleepLab backend API.
 */
export interface VersionResponse {
  /** The current installed application version string. */
  version: string
  /** The latest available release version string on GitHub, or null if checking failed. */
  latest_version: string | null
  /** Flag indicating whether a newer release version is available for upgrade. */
  update_available: boolean
  /** The URL string pointing to the latest release details on GitHub, or null. */
  release_url: string | null
}

/**
 * Profile details of an authenticated SleepLab user.
 */
export interface AuthUser {
  /** The unique UUID string identifying the user. */
  user_id: string
  /** The verified email address of the user. */
  email: string
  /** The user's first name. */
  first_name: string
  /** The user's last name. */
  last_name: string
}

/**
 * Successful authentication response containing the bearer token and user profile details.
 */
export interface AuthResponse {
  /** The signed JWT access token. */
  token: string
  /** The profile info of the authenticated user. */
  user: AuthUser
}

/**
 * Request payload structure for user login credentials.
 */
export interface LoginRequest {
  /** The user's email address candidate. */
  email: string
  /** The plain text password candidate. */
  password: string
}

/** Properties and structure for the register request. */
export type RegisterRequest = LoginRequest

/**
 * Properties and structure for the update profile request.
 */
export interface UpdateProfileRequest {
  first_name: string
  last_name: string
  email: string
}

/**
 * Properties and structure for the change password request.
 */
export interface ChangePasswordRequest {
  current_password: string
  new_password: string
}

/**
 * Properties and structure for the import response.
 */
export interface ImportResponse {
  status: string
  message: string
}

/**
 * Properties and structure for the start import response.
 */
export interface StartImportResponse {
  upload_id: string
  message: string
}

/**
 * Properties and structure for the import status response.
 */
export interface ImportStatusResponse {
  running: boolean
  started_at: string | null
  status: 'running' | 'completed' | 'failed'
  message: string | null
}

/**
 * Properties and structure for the oximeter import result.
 */
export interface OximeterImportResult {
  filename: string
  status: 'imported' | 'skipped' | 'unmatched' | 'failed'
  message: string
  session_id?: string | null
  folder_date?: string | null
  sample_count?: number | null
}

/**
 * Properties and structure for the oximeter import response.
 */
export interface OximeterImportResponse {
  status: 'completed' | 'partial' | 'failed'
  message: string
  imported: number
  skipped: number
  unmatched: number
  failed: number
  results: OximeterImportResult[]
}

/**
 * Properties and structure for the a i summary response.
 */
export interface AISummaryResponse {
  headline?: string | null
  therapy_quality?: string | null
  high_confidence_observations?: string[] | null
  possible_patterns?: string[] | null
  things_to_review?: string[] | null
  missing_or_uncertain?: string[] | null
  flag?: 'good' | 'watch' | 'alert' | null
  cached?: boolean
  insights?: string | null
  going_well?: string[] | null
  whats_not?: string[] | null
  recommended_changes?: string[] | null
  disclaimer?: string | null
  error?: string | null
}

/**
 * Properties and structure for the session a i summary response.
 */
export interface SessionAISummaryResponse {
  headline?: string | null
  therapy_quality?: string | null
  high_confidence_observations?: string[] | null
  possible_patterns?: string[] | null
  things_to_review?: string[] | null
  missing_or_uncertain?: string[] | null
  observations?: string[] | null
  recommendations?: string[] | null
  flag?: 'good' | 'watch' | 'alert' | null
  cached?: boolean
  error?: string | null
}

/**
 * Properties and structure for the trend a i summary response.
 */
export interface TrendAISummaryResponse {
  headline?: string | null
  therapy_quality?: string | null
  high_confidence_observations?: string[] | null
  possible_patterns?: string[] | null
  things_to_review?: string[] | null
  missing_or_uncertain?: string[] | null
  anomalies?: string[] | null
  trend_direction?: 'improving' | 'stable' | 'worsening' | 'variable' | null
  flag?: 'good' | 'watch' | 'alert' | null
  cached?: boolean
  error?: string | null
}

/**
 * Properties and structure for the session summary.
 */
export interface SessionSummary {
  id: string
  session_id: string
  folder_date: string
  block_index: number
  start_datetime: string
  end_datetime: string | null
  duration_seconds: number
  duration_hours: number
  ahi: number | null
  central_apnea_count: number
  obstructive_apnea_count: number
  hypopnea_count: number
  apnea_count: number
  arousal_count: number
  total_ahi_events: number
  avg_pressure: number | null
  p95_pressure: number | null
  avg_leak: number | null
  has_spo2: boolean
  machine_tz: string | null
}

/** Score breakdown for a single therapy metric (AHI, leak, duration, or SpO2). */
export interface TherapyScoreComponent {
  score: number
  max_score: number
  label: string
  value: number | null
  unit: string | null
  unavailable_reason: string | null
}

/** Overall nightly therapy quality score (0–100) with letter grade and per-metric breakdown. */
export interface TherapyScore {
  total: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  low_confidence: boolean
  callout: string
  components: {
    ahi: TherapyScoreComponent | null
    leak: TherapyScoreComponent | null
    duration: TherapyScoreComponent | null
    spo2: TherapyScoreComponent | null
  }
}

/** Properties and structure for the session detail. */
export interface SessionDetail extends SessionSummary {
  pld_start_datetime: string
  device_serial: string | null
  therapy_score: TherapyScore
  score_vs_30d_avg: number | null
  note: string | null
  tags: string[]
  avg_resp_rate: number | null
  avg_tidal_vol: number | null
  avg_min_vent: number | null
  avg_snore: number | null
  avg_flow_lim: number | null
  avg_spo2: number | null
  min_spo2: number | null
  therapy_mode: string | null
  mask_type: string | null
  humidity_level: number | null
  temperature_c: number | null
}

/** Aggregated AHI comparison for nights carrying a specific user-applied tag vs. untagged baseline. */
export interface TagInsight {
  tag: string
  night_count: number
  avg_ahi: number | null
  baseline_avg_ahi: number | null
  delta_ahi: number | null
}

/** Type definition for the equipment type. */
export type EquipmentType = 'cushion' | 'headgear' | 'tubing' | 'humidifier_chamber' | 'filter'

/**
 * Properties and structure for the equipment.
 */
export interface Equipment {
  id: string
  equipment_type: EquipmentType
  start_date: string
  replacement_days: number | null
  mask_category: string | null
  brand: string | null
  model: string | null
  notes: string | null
  days_in_use: number | null
  created_at: string
  updated_at: string
}

/**
 * Properties and structure for the equipment create.
 */
export interface EquipmentCreate {
  equipment_type: EquipmentType
  start_date: string
  replacement_days?: number | null
  mask_category?: string | null
  brand?: string | null
  model?: string | null
  notes?: string | null
}

/**
 * Properties and structure for the equipment update.
 */
export interface EquipmentUpdate {
  start_date?: string
  replacement_days?: number | null
  mask_category?: string | null
  brand?: string | null
  model?: string | null
  notes?: string | null
}

/**
 * Properties and structure for the inferred equipment.
 */
export interface InferredEquipment {
  cushion: Equipment | null
  headgear: Equipment | null
  tubing: Equipment | null
  humidifier_chamber: Equipment | null
  filter: Equipment | null
}

/**
 * Properties and structure for the event record.
 */
export interface EventRecord {
  id: number
  event_type: string
  onset_seconds: number
  duration_seconds: number | null
  event_datetime: string
}

/**
 * Properties and structure for the metrics response.
 */
export interface MetricsResponse {
  timestamps: string[]
  mask_pressure: (number | null)[]
  pressure: (number | null)[]
  epr_pressure: (number | null)[]
  leak: (number | null)[]
  resp_rate: (number | null)[]
  tidal_vol: (number | null)[]
  min_vent: (number | null)[]
  snore: (number | null)[]
  flow_lim: (number | null)[]
}

/**
 * Properties and structure for the sp o2 response.
 */
export interface SpO2Response {
  timestamps: string[]
  spo2: (number | null)[]
  pulse: (number | null)[]
}

/**
 * Properties and structure for the waveform response.
 */
export interface WaveformResponse {
  timestamps: string[]
  flow: (number | null)[]
  pressure: (number | null)[]
}

/**
 * Properties and structure for the event window response.
 */
export interface EventWindowResponse {
  event: EventRecord
  neighboring_events: EventRecord[]
  metrics: MetricsResponse
  waveform: WaveformResponse
}

/**
 * Properties and structure for the daily stat.
 */
export interface DailyStat {
  folder_date: string
  ahi: number | null
  duration_hours: number
  session_id: string
}

/**
 * Properties and structure for the overview daily stat.
 */
export interface OverviewDailyStat {
  folder_date: string
  session_id: string
  ahi: number | null
  central_apnea_index: number | null
  obstructive_apnea_index: number | null
  hypopnea_index: number | null
  apnea_index: number | null
  arousal_index: number | null
  usage_hours: number
  session_start_hour: number | null
  session_end_hour: number | null
  avg_pressure: number | null
  p95_pressure: number | null
  avg_leak: number | null
  large_leak_minutes: number | null
  avg_flow_lim: number | null
  avg_tidal_vol: number | null
  avg_min_vent: number | null
  avg_resp_rate: number | null
  min_spo2: number | null
  avg_spo2: number | null
  avg_pulse: number | null
  equipment_age_days: number | null
}

/**
 * Properties and structure for the overview stats.
 */
export interface OverviewStats {
  nights: OverviewDailyStat[]
}

/**
 * Properties and structure for the app config.
 */
export interface AppConfig {
  display_tz: string
  machine_tz: string
}

/**
 * Properties and structure for the import settings.
 */
export interface ImportSettings {
  sleephq_client_id: string | null
  sleephq_client_secret: string | null
  has_client_secret: boolean
  sleephq_team_id: number | null
  sleephq_machine_id: number | null
  auto_import_sleephq: boolean
  lookback_days: number
  sleephq_enabled: boolean
  local_datalog_path: string | null
  local_import_frequency: string
  last_local_import_at: string | null
  last_local_import_status: string | null
  wearable_provider: string | null
  wearable_base_url: string | null
  wearable_api_key: string | null
  machine_tz: string
  display_tz: string
  has_machine_tz: boolean
  has_display_tz: boolean
  llm_provider: string
  llm_base_url: string | null
  llm_model: string | null
  llm_api_key: string | null
  has_llm_api_key: boolean
  llm_configured: boolean
}

/**
 * Properties and structure for the wearable data.
 */
export interface WearableData {
  hr: { timestamp: string; value: number }[]
  spo2: { timestamp: string; value: number }[]
  stages: { timestamp: string; stage: number }[]
}

/**
 * Properties and structure for the wearable daily summary.
 */
export interface WearableDailySummary {
  date: string
  avg_hr: number | null
  avg_spo2: number | null
  awake_h: number
  light_h: number
  deep_h: number
  rem_h: number
}

/**
 * Properties and structure for the summary stats.
 */
export interface SummaryStats {
  total_nights: number
  nights_with_data: number
  compliance_pct: number
  avg_ahi: number | null
  avg_pressure: number | null
  ahi_trend: DailyStat[]
  event_breakdown: Record<string, number>
}

/**
 * Helper function for get stored token.
 */
function getStoredToken() {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY)
}

/**
 * Helper function for set stored token.
 */
function setStoredToken(token: string) {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

/**
 * Helper function for clear stored token.
 */
function clearStoredToken() {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY)
}

async function request<T>(path: string, init?: RequestInit, params?: Record<string, string | number | boolean>) {
  const qs = params
    ? '?' + new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)])).toString()
    : ''
  const isFormData = init?.body instanceof FormData
  const token = getStoredToken()

  const response = await fetch(`${BASE}${path}${qs}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (response.status === 401) {
    clearStoredToken()
    if (path !== '/auth/me' && !path.startsWith('/auth/')) {
      window.location.replace('/login')
    }
    throw new UnauthorizedError()
  }

  if (!response.ok) {
    let message = `API ${response.status}: ${path}`
    try {
      const payload = await response.json()
      if (payload?.detail) {
        message = String(payload.detail)
      }
    } catch {
      // Ignore non-JSON responses.
    }
    throw new Error(message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

async function requestBlob(path: string, params?: Record<string, string | number | boolean>) {
  const qs = params
    ? '?' + new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)])).toString()
    : ''
  const token = getStoredToken()

  const response = await fetch(`${BASE}${path}${qs}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (response.status === 401) {
    clearStoredToken()
    if (path !== '/auth/me' && !path.startsWith('/auth/')) {
      window.location.replace('/login')
    }
    throw new UnauthorizedError()
  }

  if (!response.ok) {
    let message = `API ${response.status}: ${path}`
    try {
      const payload = await response.json()
      if (payload?.detail) {
        message = String(payload.detail)
      }
    } catch {
      // Ignore non-JSON responses.
    }
    throw new Error(message)
  }

  return response.blob()
}

/** Helper function for get. */
function get<T>(path: string, params?: Record<string, string | number | boolean>) {
  return request<T>(path, undefined, params)
}

/**
 * Helper function for post.
 */
function post<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  })
}

/**
 * Helper function for put.
 */
function put<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  })
}

/**
 * Helper function for post form.
 */
function postForm<T>(path: string, formData: FormData) {
  return request<T>(path, {
    method: 'POST',
    body: formData,
  })
}

export const api = {
  getVersion: () => get<VersionResponse>('/version'),
  getSummary: () => get<SummaryStats>('/stats/summary'),
  getOverviewStats: (days = 180) => get<OverviewStats>('/stats/overview', { days }),
  getAISummary: (days = 30, force = false) => get<AISummaryResponse>('/stats/ai-summary', { days, force }),
  getSessionAISummary: (sessionId: string, force = false) =>
    get<SessionAISummaryResponse>(`/stats/sessions/${sessionId}/ai-summary`, { force }),
  getTrendAISummary: (force = false) => get<TrendAISummaryResponse>('/stats/trend-ai', { force }),
  getSessions: (params?: { per_page?: number; date_from?: string; date_to?: string }) =>
    get<SessionSummary[]>('/sessions/', params as Record<string, string | number> | undefined),
  downloadSessionReportPdf: (from: string, to: string) => requestBlob('/sessions/export/pdf', { from, to }),
  getSession: (id: string) => get<SessionDetail>(`/sessions/${id}`),
  getSessionByDate: (date: string) => get<SessionDetail>(`/sessions/by-date/${date}`),
  getTagInsights: () => get<TagInsight[]>('/sessions/tag-insights'),
  updateSessionNote: (id: string, note: string) =>
    put<SessionDetail>(`/sessions/${id}/note`, { note }),
  updateSessionTags: (id: string, tags: string[]) =>
    put<SessionDetail>(`/sessions/${id}/tags`, { tags }),
  updateSessionTimezone: (id: string, machineTz: string) =>
    put<SessionDetail>(`/sessions/${id}/timezone`, { machine_tz: machineTz }),
  getEvents: (id: string) => get<EventRecord[]>(`/sessions/${id}/events`),
  getEventWindow: (id: string, eventId: number, params?: { before_seconds?: number; after_seconds?: number; waveform_downsample?: number }) =>
    get<EventWindowResponse>(`/sessions/${id}/events/${eventId}/window`, params as Record<string, string | number> | undefined),
  getMetrics: (id: string, downsample = 15) =>
    get<MetricsResponse>(`/sessions/${id}/metrics`, { downsample }),
  getSessionSpo2: (id: string) => get<SpO2Response>(`/sessions/${id}/spo2`),
  listEquipment: () => get<Equipment[]>('/equipment/'),
  createEquipment: (payload: EquipmentCreate) => post<Equipment>('/equipment/', payload),
  updateEquipment: (id: string, payload: EquipmentUpdate) => put<Equipment>(`/equipment/${id}`, payload),
  deleteEquipment: (id: string) => request<void>(`/equipment/${id}`, { method: 'DELETE' }),
  getInferredEquipment: (refDate: string) => get<InferredEquipment>('/equipment/inferred', { ref_date: refDate }),
  register: (payload: RegisterRequest) => post<AuthResponse>('/auth/register', payload),
  login: (payload: LoginRequest) => post<AuthResponse>('/auth/login', payload),
  logout: () => post<{ status: string }>('/auth/logout'),
  me: () => get<AuthUser>('/auth/me'),
  updateProfile: (payload: UpdateProfileRequest) => put<AuthUser>('/auth/profile', payload),
  changePassword: (payload: ChangePasswordRequest) => put<{ status: string }>('/auth/password', payload),
  deleteAllSessions: () => request<void>('/sessions/all', { method: 'DELETE' }),
  startImportUpload: (rootName: string, fromDate?: string) =>
    post<StartImportResponse>('/upload/datalog/start', {
      root_name: rootName,
      from_date: fromDate,
    }),
  uploadImportBatch: (uploadId: string, files: Array<{ file: File; relativePath: string }>) => {
    const formData = new FormData()
    for (const entry of files) {
      formData.append('files', entry.file, entry.relativePath)
    }
    return postForm<{ status: string; uploaded_files: number; total_files: number }>(
      `/upload/datalog/${uploadId}/batch`,
      formData,
    )
  },
  finishImportUpload: (uploadId: string) => post<ImportResponse>(`/upload/datalog/${uploadId}/finish`),
  getImportStatus: () => get<ImportStatusResponse>('/upload/status'),
  uploadOximeterFiles: (files: File[], options?: { machine_tz?: string; overwrite?: boolean }) => {
    const formData = new FormData()
    for (const file of files) {
      formData.append('files', file, file.name)
    }
    if (options?.machine_tz) {
      formData.append('machine_tz', options.machine_tz)
    }
    if (options?.overwrite != null) {
      formData.append('overwrite', String(options.overwrite))
    }
    return postForm<OximeterImportResponse>('/upload/oximeter', formData)
  },
  getImportSettings: () => get<ImportSettings>('/import/settings'),
  saveImportSettings: (payload: Partial<ImportSettings>) => put<ImportSettings>('/import/settings', payload),
  triggerSleepHQImport: () => post<{ status: string; message: string }>('/import/trigger'),
  triggerLocalImport: () => post<{ status: string; message: string }>('/import/trigger-local'),
  getWearableData: (date: string) => get<WearableData>('/wearable/data', { date }),
  getWearableSummary: (dateFrom: string, dateTo: string) =>
    get<WearableDailySummary[]>('/wearable/summary', { date_from: dateFrom, date_to: dateTo }),
  getAppConfig: () => get<AppConfig>('/config'),
}

export const authTokenStore = {
  clear: clearStoredToken,
  get: getStoredToken,
  set: setStoredToken,
}
