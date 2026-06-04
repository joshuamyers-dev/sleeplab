import { useEffect, useRef, useState, type ReactElement } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { BrowserRouter } from 'react-router-dom'

import { api } from './api/client'
import { setDisplayTz } from './lib/displayTz'
import {
  ActivityIcon,
  CalendarIcon,
  ChevronRightIcon,
  EquipmentIcon,
  HomeIcon,
  MoonIcon,
  SunIcon,
} from './components/icons/ChevronIcons'
import logo from './assets/logo.webp'
import Dashboard from './pages/Dashboard'
import CalendarPage from './pages/Calendar'
import EquipmentPage from './pages/Equipment'
import ImportPage from './pages/Import'
import InsightsPage from './pages/Insights'
import Login from './pages/Login'
import Register from './pages/Register'
import SessionDetail from './pages/SessionDetail'
import SettingsPage from './pages/Settings'
import TrendsPage from './pages/Trends'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Button } from './components/ui/button'
import { getIsUserRegistrationDisabled } from './config'
import {
  IMPORT_SYNC_STORAGE_KEY,
  notifyImportCompleted,
} from './lib/aiSummaryCache'

type ThemeMode = 'light' | 'dark'

function ProtectedRoute({ children }: { children: ReactElement }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface-strong)] p-10 text-center text-[var(--muted-foreground)]">Checking session...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}

function RootRoute() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <div className="min-h-screen bg-[var(--background)]" />
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return <Navigate to="/login" replace />
}

function getUserInitials(firstName: string, lastName: string, email: string) {
  const firstInitial = firstName.trim().charAt(0)
  const lastInitial = lastName.trim().charAt(0)
  const initials = `${firstInitial}${lastInitial}`.trim().toUpperCase()
  if (initials) {
    return initials
  }
  return email.trim().charAt(0).toUpperCase() || '?'
}

function AppLayout() {
  const { user, logout, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isRegistrationDisabled = getIsUserRegistrationDisabled()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>('light')
  const [appVersion, setAppVersion] = useState<string | null>(null)
  const [latestVersion, setLatestVersion] = useState<string | null>(null)
  const [releaseUrl, setReleaseUrl] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const wasSyncingRef = useRef(false)

  useEffect(() => {
    if (!user || isLoading) {
      return
    }
    api.getImportSettings()
      .then((settings) => {
        if (settings.has_display_tz) {
          setDisplayTz(settings.display_tz)
        }
      })
      .catch(() => {})
  }, [user, isLoading])

  useEffect(() => {
    let cancelled = false

    async function loadAppVersion() {
      try {
        const versionInfo = await api.getVersion()
        if (!cancelled) {
          setAppVersion(versionInfo.version)
          setLatestVersion(versionInfo.update_available ? versionInfo.latest_version : null)
          setReleaseUrl(versionInfo.release_url)
        }
      } catch {
        if (!cancelled) {
          setAppVersion(null)
        }
      }
    }

    void loadAppVersion()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('cpap-theme')
    if (storedTheme === 'light' || storedTheme === 'dark') {
      // Preserve the existing localStorage-driven theme initialization.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(storedTheme)
      return
    }

    // Preserve the previous explicit default write path for first-time users.
    setTheme('light')
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem('cpap-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!user || isLoading) {
      // Keep this reset synchronous so import progress never leaks after logout.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsSyncing(false)
      wasSyncingRef.current = false
      window.sessionStorage.removeItem(IMPORT_SYNC_STORAGE_KEY)
      return
    }

    let cancelled = false
    const hasPendingSync = window.sessionStorage.getItem(IMPORT_SYNC_STORAGE_KEY) === 'true'
    if (hasPendingSync) {
      setIsSyncing(true)
    }

    async function checkImportStatus() {
      try {
        const status = await api.getImportStatus()
        if (cancelled) {
          return
        }

        const hadBeenSyncing = wasSyncingRef.current
        setIsSyncing(status.running)
        if (status.running) {
          wasSyncingRef.current = true
          window.sessionStorage.setItem(IMPORT_SYNC_STORAGE_KEY, 'true')
        } else {
          if (hadBeenSyncing && user) {
            notifyImportCompleted()
          }
          wasSyncingRef.current = false
          window.sessionStorage.removeItem(IMPORT_SYNC_STORAGE_KEY)
        }
      } catch {
        if (!cancelled && !hasPendingSync) {
          setIsSyncing(false)
        }
      }
    }

    void checkImportStatus()
    const interval = window.setInterval(() => {
      void checkImportStatus()
    }, 5000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [user, isLoading])

  async function handleLogout() {
    setIsUserMenuOpen(false)
    await logout()
    navigate('/login')
  }

  const onOverview = location.pathname === '/dashboard'
  const onCalendar = location.pathname === '/calendar'
  const onTrends = location.pathname === '/trends'
  const onEquipment = location.pathname === '/equipment'

  const routes = (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={isRegistrationDisabled ? <Navigate to="/login" replace /> : <Register />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
      <Route path="/trends" element={<ProtectedRoute><TrendsPage /></ProtectedRoute>} />
      <Route path="/equipment" element={<ProtectedRoute><EquipmentPage /></ProtectedRoute>} />
      <Route path="/insights" element={<ProtectedRoute><InsightsPage /></ProtectedRoute>} />
      <Route path="/sessions/:date" element={<ProtectedRoute><SessionDetail /></ProtectedRoute>} />
      <Route path="/import" element={<ProtectedRoute><ImportPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
    </Routes>
  )

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-6 lg:px-8">
        <header className="mb-5 flex flex-col gap-4 rounded-[20px] border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-4 shadow-none sm:mb-6 sm:rounded-[24px] sm:px-5">
            <div className="flex items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-4">
                <Link to={user && !isLoading ? '/dashboard' : '/'} className="shrink-0">
                  <div className="flex h-10 w-32 items-center justify-start sm:h-20 sm:w-56 sm:justify-center">
                    <img
                      src={logo}
                      alt="SleepLab logo"
                      className="max-h-9 w-full object-contain sm:max-h-16"
                    />
                  </div>
                </Link>
              </div>

              <div className="flex items-center justify-end gap-2 sm:flex-wrap sm:gap-3">
                {user && !isLoading ? (
                  <>
                    <Link to="/import" className="hidden sm:inline-flex">
                      <Button className="h-10 px-4 text-sm">Import data</Button>
                    </Link>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--accent)] transition hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)] sm:hidden"
                      onClick={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
                      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                    >
                      {theme === 'light' ? <MoonIcon className="h-4 w-4" /> : <SunIcon className="h-4 w-4" />}
                    </button>
                    <div className="relative hidden rounded-full border border-[var(--border)] bg-[var(--surface-soft)] p-1 sm:grid sm:grid-cols-2">
                      <span
                        aria-hidden="true"
                        className={`absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] rounded-full bg-[var(--surface-strong)] transition-transform duration-200 ease-out ${
                          theme === 'dark' ? 'translate-x-full' : 'translate-x-0'
                        }`}
                      />
                      <button
                        type="button"
                        className={`relative z-10 inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-bold transition ${
                          theme === 'light'
                            ? 'text-[var(--accent)]'
                            : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                        }`}
                        onClick={() => setTheme('light')}
                        aria-pressed={theme === 'light'}
                      >
                        <SunIcon className="h-4 w-4" />
                        <span>Light mode</span>
                      </button>
                      <button
                        type="button"
                        className={`relative z-10 inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-bold transition ${
                          theme === 'dark'
                            ? 'text-[var(--accent)]'
                            : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                        }`}
                        onClick={() => setTheme('dark')}
                        aria-pressed={theme === 'dark'}
                      >
                        <MoonIcon className="h-4 w-4" />
                        <span>Dark mode</span>
                      </button>
                    </div>
                    <div ref={userMenuRef} className="relative">
                      <button
                        type="button"
                        className="inline-flex h-9 items-center gap-2 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-soft)] pl-0 pr-0 text-sm font-bold text-[var(--foreground)] transition hover:border-[var(--accent-border)] hover:text-[var(--accent)] sm:h-11 sm:pr-3"
                        onClick={() => setIsUserMenuOpen((current) => !current)}
                        aria-label="Open profile menu"
                      >
                        <span className="flex h-full w-9 items-center justify-center bg-[var(--accent-soft)] text-sm font-extrabold text-[var(--accent)] sm:w-11">
                          {getUserInitials(user.first_name, user.last_name, user.email)}
                        </span>
                        <ChevronRightIcon className={`hidden h-4 w-4 transition-transform sm:block ${isUserMenuOpen ? '-rotate-90' : 'rotate-90'}`} />
                      </button>
                      {isUserMenuOpen ? (
                        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 min-w-56 rounded-[16px] border border-[var(--border)] bg-[var(--surface-strong)] p-2">
                          <div className="px-3 py-2">
                            <p className="text-sm font-bold text-[var(--foreground)]">
                              {[user.first_name, user.last_name].filter(Boolean).join(' ') || 'Your account'}
                            </p>
                            <p className="mt-1 text-sm text-[var(--muted-foreground)]">{user.email}</p>
                          </div>
                          <Link
                            className="block rounded-[12px] px-3 py-2 text-left text-sm font-bold text-[var(--accent)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent-hover)]"
                            to="/settings"
                            onClick={() => setIsUserMenuOpen(false)}
                          >
                            Settings
                          </Link>
                          <button
                            type="button"
                            className="w-full rounded-[12px] px-3 py-2 text-left text-sm font-bold text-[var(--accent)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent-hover)]"
                            onClick={handleLogout}
                          >
                            Logout
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <>
                    <Link className="text-sm font-bold text-[var(--accent)] transition hover:text-[var(--accent-hover)]" to="/login">Login</Link>
                    {!isRegistrationDisabled ? (
                      <Button onClick={() => navigate('/register')}>Create account</Button>
                    ) : null}
                  </>
                )}
              </div>
            </div>

            {user && !isLoading ? (
              <nav className="grid grid-cols-2 gap-2 border-t border-[var(--border)] pt-4 sm:flex sm:flex-wrap sm:items-center" aria-label="Dashboard sections">
                <Link
                  to="/dashboard"
                  className={`inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-bold transition sm:justify-start sm:px-4 ${
                    onOverview
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]'
                  }`}
                >
                  <HomeIcon className="h-4 w-4" />
                  <span>Overview</span>
                </Link>
                <Link
                  to="/calendar"
                  className={`inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-bold transition sm:justify-start sm:px-4 ${
                    onCalendar
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]'
                  }`}
                >
                  <CalendarIcon className="h-4 w-4" />
                  <span>Calendar</span>
                </Link>
                <Link
                  to="/trends"
                  className={`inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-bold transition sm:justify-start sm:px-4 ${
                    onTrends
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]'
                  }`}
                >
                  <ActivityIcon className="h-4 w-4" />
                  <span>Trends</span>
                </Link>
                <Link
                  to="/equipment"
                  className={`inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-bold transition sm:justify-start sm:px-4 ${
                    onEquipment
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]'
                  }`}
                >
                  <EquipmentIcon className="h-4 w-4" />
                  <span>Equipment</span>
                </Link>
              </nav>
            ) : null}

            {user && !isLoading && isSyncing ? (
              <div className="flex items-start gap-3 rounded-[18px] border border-[var(--accent-border)] bg-[var(--accent-soft)] px-4 py-3 text-[var(--accent)]">
                <span
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--accent-border)] border-t-[var(--accent)]"
                />
                <div className="space-y-1">
                  <p className="text-sm font-bold">Synchronizing...</p>
                  <p className="text-sm font-medium text-[var(--accent)]/80">
                    We are importing your sleep data, so visualisations may be out of date.
                  </p>
                </div>
              </div>
            ) : null}
        </header>

        <main>
          {routes}
        </main>

        <footer className="mt-8 pb-4 text-center text-xs font-medium text-[var(--muted-foreground)]">
          SleepLab v{appVersion ?? 'development'}
          {latestVersion ? (
            <>
              {' -> '}
              {releaseUrl ? (
                <a className="font-bold text-[var(--accent)] hover:text-[var(--accent-hover)]" href={releaseUrl} target="_blank" rel="noreferrer">
                  v{latestVersion} available
                </a>
              ) : (
                <span className="font-bold text-[var(--accent)]">v{latestVersion} available</span>
              )}
            </>
          ) : null}
        </footer>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </BrowserRouter>
  )
}
