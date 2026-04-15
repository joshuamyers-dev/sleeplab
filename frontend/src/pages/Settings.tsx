import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'

import { api, type LocalImportSettings } from '../api/client'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { useAuth } from '../context/AuthContext'

const FREQ_OPTIONS: { value: LocalImportSettings['poll_frequency']; label: string }[] = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily',  label: 'Daily'  },
  { value: 'weekly', label: 'Weekly' },
]

export default function SettingsPage() {
  const { user, isLoading, updateProfile } = useAuth()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [isProfileSubmitting, setIsProfileSubmitting] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false)

  // Server-path import settings
  const [datalогPath, setDatalогPath] = useState('')
  const [autoImport, setAutoImport] = useState(false)
  const [pollFrequency, setPollFrequency] = useState<LocalImportSettings['poll_frequency']>('daily')
  const [lookbackDays, setLookbackDays] = useState(7)
  const [importStatus, setImportStatus] = useState<LocalImportSettings | null>(null)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [isImportSubmitting, setIsImportSubmitting] = useState(false)

  useEffect(() => {
    if (!user) {
      return
    }
    setFirstName(user.first_name)
    setLastName(user.last_name)
    setEmail(user.email)
  }, [user])

  useEffect(() => {
    api.getLocalImportSettings().then((s) => {
      setDatalогPath(s.datalog_path ?? '')
      setAutoImport(s.auto_import_enabled)
      setPollFrequency(s.poll_frequency)
      setLookbackDays(s.lookback_days)
      setImportStatus(s)
    }).catch(() => {/* no settings yet */})
  }, [])

  if (!isLoading && !user) {
    return <Navigate to="/login" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProfileError(null)
    setProfileMessage(null)
    setIsProfileSubmitting(true)

    try {
      await updateProfile({
        first_name: firstName,
        last_name: lastName,
        email,
      })
      setProfileMessage('Settings saved.')
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Could not update settings')
    } finally {
      setIsProfileSubmitting(false)
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }

    setPasswordError(null)
    setPasswordMessage(null)
    setIsPasswordSubmitting(true)

    try {
      await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      })
      setPasswordMessage('Password updated.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Could not change password')
    } finally {
      setIsPasswordSubmitting(false)
    }
  }

  async function handleImportSettingsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setImportError(null)
    setImportMessage(null)
    setIsImportSubmitting(true)
    try {
      const updated = await api.saveLocalImportSettings({
        datalog_path: datalогPath.trim() || null,
        auto_import_enabled: autoImport,
        poll_frequency: pollFrequency,
        lookback_days: lookbackDays,
      })
      setImportStatus(updated)
      setImportMessage('Settings saved.')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not save settings')
    } finally {
      setIsImportSubmitting(false)
    }
  }

  const lastRun = importStatus?.last_import_at
    ? new Date(importStatus.last_import_at).toLocaleString()
    : null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.6),_transparent_38%),var(--surface-strong)]">
        <CardHeader>
          <CardTitle className="text-2xl">Settings</CardTitle>
          <CardDescription>Update the name and email shown on your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  autoComplete="given-name"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>

            {profileMessage ? <p className="text-sm font-medium text-[var(--olive-deep)]">{profileMessage}</p> : null}
            {profileError ? <p className="text-sm text-[var(--danger-text)]">{profileError}</p> : null}

            <Button type="submit" disabled={isProfileSubmitting}>
              {isProfileSubmitting ? 'Saving...' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.45),_transparent_38%),var(--surface-strong)]">
        <CardHeader>
          <CardTitle className="text-2xl">Change password</CardTitle>
          <CardDescription>Use a new password with at least 8 characters.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handlePasswordSubmit}>
            <div className="space-y-3">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            {passwordMessage ? <p className="text-sm font-medium text-[var(--olive-deep)]">{passwordMessage}</p> : null}
            {passwordError ? <p className="text-sm text-[var(--danger-text)]">{passwordError}</p> : null}

            <Button type="submit" disabled={isPasswordSubmitting}>
              {isPasswordSubmitting ? 'Updating password...' : 'Update password'}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card className="bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.45),_transparent_38%),var(--surface-strong)]">
        <CardHeader>
          <CardTitle className="text-2xl">Server Import</CardTitle>
          <CardDescription>
            Point SleepLab at a DATALOG directory mounted on the server (e.g. a NAS share or rsync'd SD card).
            The path must be inside the container's <code className="font-mono text-xs">/data/imports</code> mount.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleImportSettingsSubmit}>
            <div className="space-y-3">
              <Label htmlFor="datalогPath">DATALOG path</Label>
              <Input
                id="datalогPath"
                value={datalогPath}
                onChange={(e) => setDatalогPath(e.target.value)}
                placeholder="/data/imports/your-uuid/DATALOG"
                autoComplete="off"
              />
            </div>

            <div className="space-y-3">
              <Label>Poll frequency</Label>
              <div className="flex gap-4">
                {FREQ_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="pollFrequency"
                      value={opt.value}
                      checked={pollFrequency === opt.value}
                      onChange={() => setPollFrequency(opt.value)}
                      className="accent-[var(--accent)]"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="lookbackDays">Lookback days</Label>
              <Input
                id="lookbackDays"
                type="number"
                min={1}
                max={365}
                value={lookbackDays}
                onChange={(e) => setLookbackDays(Number(e.target.value))}
                className="w-28"
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                id="autoImport"
                type="checkbox"
                checked={autoImport}
                onChange={(e) => setAutoImport(e.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              <Label htmlFor="autoImport" className="cursor-pointer">
                Enable automatic import on the configured schedule
              </Label>
            </div>

            {lastRun ? (
              <p className="text-xs text-[var(--muted-foreground)]">
                Last import: {lastRun}
                {importStatus?.last_import_status ? ` — ${importStatus.last_import_status}` : ''}
                {importStatus?.last_import_message ? ` · ${importStatus.last_import_message}` : ''}
              </p>
            ) : null}

            {importMessage ? <p className="text-sm font-medium text-[var(--olive-deep)]">{importMessage}</p> : null}
            {importError ? <p className="text-sm text-[var(--danger-text)]">{importError}</p> : null}

            <Button type="submit" disabled={isImportSubmitting}>
              {isImportSubmitting ? 'Saving...' : 'Save import settings'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
