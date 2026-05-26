import { getApiBaseUrl } from '../config'

const BASE = getApiBaseUrl()
const TOKEN_STORAGE_KEY = 'cpap_auth_token'

export class UnauthorizedError extends Error {
  constructor(message = 'Authentication required') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export interface VersionResponse {
  version: string
  latest_version: string | null
  update_available: boolean
  release_url: string | null
}

export interface AuthUser {
  user_id: string
  email: string
  first_name: string
  last_name: string
}

export interface AuthResponse {
  token: string
  user: AuthUser
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest extends LoginRequest {}

export interface UpdateProfileRequest {
  first_name: string
  last_name: string
  email: string
}

export interface ChangePasswordRequest {
  current_password: string
  new_password: string
}

export interface ImportResponse {
  status: string
  message: string
}

export interface StartImportResponse {
  upload_id: string
  message: string
}

export interface ImportStatusResponse {
  running: boolean
  started_at: string | null
}

export interface AISummaryResponse {
  insights?: string | null
  going_well?: string[] | null
  whats_not?: string[] | null
  recommended_changes?: string[] | null
  disclaimer?: string | null
  error?: string | null
}

export interface SessionAISummaryResponse {
  headline?: string | null
  observations?: string[] | null
  recommendations?: string[] | null
  flag?: 'good' | 'watch' | 'alert' | null
  error?: string | null
}

export interface TrendAISummaryResponse {
  headline?: string | null
  anomalies?: string[] | null
  trend_direction?: 'improving' | 'stable' | 'worsening' | 'variable' | null
  flag?: 'good' | 'watch' | 'alert' | null
  error?: string | null
}

export interface SessionSummary {
  id: string
  session_id: string
  folder_date: string
  block_index: number
  start_datetime: string
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

export interface SessionDetail extends SessionSummary {
  pld_start_datetime: string
  device_serial: string | null
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

export type EquipmentType = 'cushion' | 'headgear' | 'tubing' | 'humidifier_chamber' | 'filter'

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

export interface EquipmentCreate {
  equipment_type: EquipmentType
  start_date: string
  replacement_days?: number | null
  mask_category?: string | null
  brand?: string | null
  model?: string | null
  notes?: string | null
}

export interface EquipmentUpdate {
  start_date?: string
  replacement_days?: number | null
  mask_category?: string | null
  brand?: string | null
  model?: string | null
  notes?: string | null
}

export interface InferredEquipment {
  cushion: Equipment | null
  headgear: Equipment | null
  tubing: Equipment | null
  humidifier_chamber: Equipment | null
  filter: Equipment | null
}

export interface EventRecord {
  id: number
  event_type: string
  onset_seconds: number
  duration_seconds: number | null
  event_datetime: string
}

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

export interface SpO2Response {
  timestamps: string[]
  spo2: (number | null)[]
  pulse: (number | null)[]
}

export interface WaveformResponse {
  timestamps: string[]
  flow: (number | null)[]
  pressure: (number | null)[]
}

export interface EventWindowResponse {
  event: EventRecord
  neighboring_events: EventRecord[]
  metrics: MetricsResponse
  waveform: WaveformResponse
}

export interface DailyStat {
  folder_date: string
  ahi: number | null
  duration_hours: number
  session_id: string
}

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

export interface OverviewStats {
  nights: OverviewDailyStat[]
}

export interface AppConfig {
  display_tz: string
  machine_tz: string
}

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

export interface WearableData {
  hr: { timestamp: string; value: number }[]
  spo2: { timestamp: string; value: number }[]
  stages: { timestamp: string; stage: number }[]
}

export interface WearableDailySummary {
  date: string
  avg_hr: number | null
  avg_spo2: number | null
  awake_h: number
  light_h: number
  deep_h: number
  rem_h: number
}

export interface SummaryStats {
  total_nights: number
  nights_with_data: number
  compliance_pct: number
  avg_ahi: number | null
  avg_pressure: number | null
  ahi_trend: DailyStat[]
  event_breakdown: Record<string, number>
}

function getStoredToken() {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY)
}

function setStoredToken(token: string) {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

function clearStoredToken() {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY)
}

async function request<T>(path: string, init?: RequestInit, params?: Record<string, string | number>) {
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

function get<T>(path: string, params?: Record<string, string | number>) {
  return request<T>(path, undefined, params)
}

function post<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  })
}

function put<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  })
}

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
  getAISummary: (days = 30) => get<AISummaryResponse>('/stats/ai-summary', { days }),
  getSessionAISummary: (sessionId: string) => get<SessionAISummaryResponse>(`/stats/sessions/${sessionId}/ai-summary`),
  getTrendAISummary: () => get<TrendAISummaryResponse>('/stats/trend-ai'),
  getSessions: (params?: { per_page?: number; date_from?: string; date_to?: string }) =>
    get<SessionSummary[]>('/sessions/', params as Record<string, string | number> | undefined),
  getSession: (id: string) => get<SessionDetail>(`/sessions/${id}`),
  getSessionByDate: (date: string) => get<SessionDetail>(`/sessions/by-date/${date}`),
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
