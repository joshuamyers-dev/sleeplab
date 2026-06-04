import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'

import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { useAuth } from '../context/AuthContext'
import { setDisplayTz as applyDisplayTz } from '../lib/displayTz'

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

  // Danger zone
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDeleteAllSessions() {
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await api.deleteAllSessions()
      setDeleteMessage('All session data deleted.')
      setDeleteConfirm(false)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete sessions')
    } finally {
      setIsDeleting(false)
    }
  }

  // SleepHQ import settings
  const [sleephqClientId, setSleephqClientId] = useState('')
  const [sleephqClientSecret, setSleephqClientSecret] = useState('')
  const [sleephqSecretSaved, setSleephqSecretSaved] = useState(false)
  const [sleephqSecretDirty, setSleephqSecretDirty] = useState(false)
  const [sleephqTeamId, setSleephqTeamId] = useState('')
  const [sleephqMachineId, setSleephqMachineId] = useState('')
  const [sleephqMessage, setSleephqMessage] = useState<string | null>(null)
  const [sleephqError, setSleephqError] = useState<string | null>(null)
  const [isSleephqSubmitting, setIsSleephqSubmitting] = useState(false)
  const [sleephqEnabled, setSleephqEnabled] = useState(false)
  const [isImportRunning, setIsImportRunning] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  // Local DATALOG import settings
  const [localPath, setLocalPath] = useState('')
  const [localFrequency, setLocalFrequency] = useState('daily')
  const [lastImportAt, setLastImportAt] = useState<string | null>(null)
  const [lastImportStatus, setLastImportStatus] = useState<string | null>(null)
  const [localMessage, setLocalMessage] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [isLocalSubmitting, setIsLocalSubmitting] = useState(false)
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

  // Internal app settings
  const [machineTz, setMachineTz] = useState('UTC')
  const [displayTz, setDisplayTz] = useState('UTC')
  const [hasMachineTz, setHasMachineTz] = useState(false)
  const [hasDisplayTz, setHasDisplayTz] = useState(false)
  const [timezoneMessage, setTimezoneMessage] = useState<string | null>(null)
  const [timezoneError, setTimezoneError] = useState<string | null>(null)
  const [isTimezoneSubmitting, setIsTimezoneSubmitting] = useState(false)

  const [llmProvider, setLlmProvider] = useState('ollama')
  const [llmBaseUrl, setLlmBaseUrl] = useState('')
  const [llmModel, setLlmModel] = useState('')
  const [llmApiKey, setLlmApiKey] = useState('')
  const [llmApiKeySaved, setLlmApiKeySaved] = useState(false)
  const [llmMessage, setLlmMessage] = useState<string | null>(null)
  const [llmError, setLlmError] = useState<string | null>(null)
  const [isLlmSubmitting, setIsLlmSubmitting] = useState(false)

  // Wearable settings
  const [wearableProvider, setWearableProvider] = useState('')
  const [wearableBaseUrl, setWearableBaseUrl] = useState('')
  const [wearableApiKey, setWearableApiKey] = useState('')
  const [wearableMessage, setWearableMessage] = useState<string | null>(null)
  const [wearableError, setWearableError] = useState<string | null>(null)
  const [isWearableSubmitting, setIsWearableSubmitting] = useState(false)

  useEffect(() => {
    if (!user) {
      return
    }
    // Mirror the authenticated profile into editable form fields when the user changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFirstName(user.first_name)
    setLastName(user.last_name)
    setEmail(user.email)
  }, [user])

  useEffect(() => {
    api.getImportSettings().then((settings) => {
      setSleephqEnabled(settings.sleephq_enabled ?? false)
      setSleephqClientId(settings.sleephq_client_id ?? '')
      setSleephqSecretSaved(settings.has_client_secret)
      setSleephqTeamId(settings.sleephq_team_id != null ? String(settings.sleephq_team_id) : '')
      setSleephqMachineId(settings.sleephq_machine_id != null ? String(settings.sleephq_machine_id) : '')
      setLocalPath(settings.local_datalog_path ?? '')
      setLocalFrequency(settings.local_import_frequency ?? 'daily')
      setLastImportAt(settings.last_local_import_at)
      setLastImportStatus(settings.last_local_import_status)
      setWearableProvider(settings.wearable_provider ?? '')
      setWearableBaseUrl(settings.wearable_base_url ?? '')
      setMachineTz(settings.has_machine_tz ? settings.machine_tz : browserTz)
      setDisplayTz(settings.has_display_tz ? settings.display_tz : browserTz)
      setHasMachineTz(settings.has_machine_tz)
      setHasDisplayTz(settings.has_display_tz)
      setLlmProvider(settings.llm_provider ?? 'ollama')
      setLlmBaseUrl(settings.llm_base_url ?? '')
      setLlmModel(settings.llm_model ?? '')
      setLlmApiKeySaved(settings.has_llm_api_key)
      // wearable_api_key is always null from server — leave blank
    }).catch(() => {
      // No settings saved yet — leave fields empty
    })
  }, [browserTz])

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

  async function handleRunImport() {
    setImportError(null)
    setImportMessage(null)
    setIsImportRunning(true)
    try {
      const result = await api.triggerSleepHQImport()
      setImportMessage(result.message)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not start import')
    } finally {
      setIsImportRunning(false)
    }
  }

  async function handleLocalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError(null)
    setLocalMessage(null)
    setIsLocalSubmitting(true)
    try {
      await api.saveImportSettings({
        local_datalog_path: localPath || null,
        local_import_frequency: localFrequency,
      })
      setLocalMessage('Settings saved.')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not save settings')
    } finally {
      setIsLocalSubmitting(false)
    }
  }

  async function handleTimezoneSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTimezoneError(null)
    setTimezoneMessage(null)
    setIsTimezoneSubmitting(true)
    try {
      const settings = await api.saveImportSettings({
        machine_tz: machineTz || undefined,
        display_tz: displayTz || undefined,
      })
      setMachineTz(settings.machine_tz)
      setDisplayTz(settings.display_tz)
      setHasMachineTz(settings.has_machine_tz)
      setHasDisplayTz(settings.has_display_tz)
      applyDisplayTz(settings.display_tz)
      setTimezoneMessage('Timezone settings saved.')
    } catch (err) {
      setTimezoneError(err instanceof Error ? err.message : 'Could not save timezone settings')
    } finally {
      setIsTimezoneSubmitting(false)
    }
  }

  function useBrowserTimezone() {
    setMachineTz(browserTz)
    setDisplayTz(browserTz)
    setTimezoneMessage(`Detected ${browserTz}. Save to use it for future imports and display.`)
    setTimezoneError(null)
  }

  async function handleLlmSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLlmError(null)
    setLlmMessage(null)
    setIsLlmSubmitting(true)
    try {
      const settings = await api.saveImportSettings({
        llm_provider: llmProvider || undefined,
        llm_base_url: llmBaseUrl || null,
        llm_model: llmModel || null,
        llm_api_key: llmApiKey || null,
      })
      setLlmProvider(settings.llm_provider)
      setLlmBaseUrl(settings.llm_base_url ?? '')
      setLlmModel(settings.llm_model ?? '')
      setLlmApiKeySaved(settings.has_llm_api_key)
      setLlmApiKey('')
      setLlmMessage('AI backend settings saved.')
    } catch (err) {
      setLlmError(err instanceof Error ? err.message : 'Could not save AI backend settings')
    } finally {
      setIsLlmSubmitting(false)
    }
  }

  async function handleWearableSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setWearableError(null)
    setWearableMessage(null)
    setIsWearableSubmitting(true)
    try {
      await api.saveImportSettings({
        wearable_provider: wearableProvider || null,
        wearable_base_url: wearableBaseUrl || null,
        wearable_api_key: wearableApiKey || null,
      })
      setWearableMessage('Settings saved.')
      setWearableApiKey('')
    } catch (err) {
      setWearableError(err instanceof Error ? err.message : 'Could not save settings')
    } finally {
      setIsWearableSubmitting(false)
    }
  }

  async function handleSleephqSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSleephqError(null)
    setSleephqMessage(null)
    setIsSleephqSubmitting(true)

    try {
      await api.saveImportSettings({
        sleephq_client_id: sleephqClientId || null,
        sleephq_client_secret: sleephqSecretDirty ? (sleephqClientSecret || null) : null,
        sleephq_team_id: sleephqTeamId ? Number(sleephqTeamId) : null,
        sleephq_machine_id: sleephqMachineId ? Number(sleephqMachineId) : null,
      })
      setSleephqMessage('SleepHQ settings saved.')
      if (sleephqSecretDirty && sleephqClientSecret) {
        setSleephqSecretSaved(true)
        setSleephqClientSecret('')
      }
      setSleephqSecretDirty(false)
    } catch (err) {
      setSleephqError(err instanceof Error ? err.message : 'Could not save settings')
    } finally {
      setIsSleephqSubmitting(false)
    }
  }

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
      {sleephqEnabled && <Card className="bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.45),_transparent_38%),var(--surface-strong)]">
        <CardHeader>
          <CardTitle className="text-2xl">SleepHQ API Import (Unofficial)</CardTitle>
          <CardDescription>
            Import your CPAP history from SleepHQ. This is a one-time historical import — it pulls your existing records into SleepLab and does not stay connected or sync automatically. You can re-run it at any time to pull in newer sessions. OAuth credentials can be found in your SleepHQ developer settings. Only read scope is requested — no data is written or deleted on SleepHQ.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSleephqSubmit}>
            <div className="space-y-3">
              <Label htmlFor="sleephqClientId">Client ID</Label>
              <Input
                id="sleephqClientId"
                value={sleephqClientId}
                onChange={(event) => setSleephqClientId(event.target.value)}
                autoComplete="off"
                placeholder="OAuth client ID from SleepHQ"
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="sleephqClientSecret">
                Client secret
                {sleephqSecretSaved && !sleephqSecretDirty && (
                  <span className="ml-2 text-xs font-normal text-[var(--olive-deep)]">saved</span>
                )}
              </Label>
              <Input
                id="sleephqClientSecret"
                type="password"
                value={sleephqClientSecret}
                onChange={(event) => {
                  setSleephqClientSecret(event.target.value)
                  setSleephqSecretDirty(true)
                }}
                autoComplete="new-password"
                placeholder={sleephqSecretSaved && !sleephqSecretDirty ? '••••••••••••••••' : 'OAuth client secret from SleepHQ'}
              />
              {sleephqSecretSaved && !sleephqSecretDirty && (
                <p className="text-xs text-[var(--muted-foreground)]">Leave blank to keep your existing secret.</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <Label htmlFor="sleephqTeamId">Team ID</Label>
                <Input
                  id="sleephqTeamId"
                  value={sleephqTeamId}
                  onChange={(event) => setSleephqTeamId(event.target.value)}
                  inputMode="numeric"
                  placeholder="Optional — auto-resolved if blank"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="sleephqMachineId">Machine ID</Label>
                <Input
                  id="sleephqMachineId"
                  value={sleephqMachineId}
                  onChange={(event) => setSleephqMachineId(event.target.value)}
                  inputMode="numeric"
                  placeholder="Optional — auto-resolved if blank"
                />
              </div>
            </div>

            {sleephqMessage ? <p className="text-sm font-medium text-[var(--olive-deep)]">{sleephqMessage}</p> : null}
            {sleephqError ? <p className="text-sm text-[var(--danger-text)]">{sleephqError}</p> : null}

            <Button type="submit" disabled={isSleephqSubmitting}>
              {isSleephqSubmitting ? 'Saving...' : 'Save SleepHQ settings'}
            </Button>
          </form>

          <div className="mt-6 border-t border-[var(--border)] pt-5 space-y-3">
            <p className="text-sm text-[var(--muted-foreground)]">
              Run a historical import from SleepHQ. Requires saved credentials above.
            </p>
            {importMessage ? <p className="text-sm font-medium text-[var(--olive-deep)]">{importMessage}</p> : null}
            {importError ? <p className="text-sm text-[var(--danger-text)]">{importError}</p> : null}
            <Button
              variant="outline"
              onClick={handleRunImport}
              disabled={isImportRunning || !sleephqSecretSaved}
            >
              {isImportRunning ? 'Starting import...' : 'Run SleepHQ import'}
            </Button>
          </div>
        </CardContent>
      </Card>}

      <Card className="bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.45),_transparent_38%),var(--surface-strong)]">
        <CardHeader>
          <CardTitle className="text-2xl">Timezone</CardTitle>
          <CardDescription>
            Set how CPAP file timestamps are interpreted during import and how times are shown in the app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleTimezoneSubmit}>
            {!hasMachineTz || !hasDisplayTz ? (
              <div className="rounded-lg border border-[var(--border)] px-4 py-3 text-sm">
                <p className="font-medium text-[var(--foreground)]">Browser timezone detected: {browserTz}</p>
                <p className="mt-1 text-[var(--muted-foreground)]">This is the best automatic guess available in the browser. Save it below if your CPAP machine is set to the same timezone.</p>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <Label htmlFor="machineTz">Machine timezone</Label>
                <Input
                  id="machineTz"
                  value={machineTz}
                  onChange={(event) => setMachineTz(event.target.value)}
                  autoComplete="off"
                  placeholder="America/New_York"
                />
                <p className="text-xs text-[var(--muted-foreground)]">Used when importing naive EDF timestamps.</p>
              </div>

              <div className="space-y-3">
                <Label htmlFor="displayTz">Display timezone</Label>
                <Input
                  id="displayTz"
                  value={displayTz}
                  onChange={(event) => setDisplayTz(event.target.value)}
                  autoComplete="off"
                  placeholder="America/New_York"
                />
                <p className="text-xs text-[var(--muted-foreground)]">Used for chart labels, session times, and event timelines.</p>
              </div>
            </div>

            {timezoneMessage ? <p className="text-sm font-medium text-[var(--olive-deep)]">{timezoneMessage}</p> : null}
            {timezoneError ? <p className="text-sm text-[var(--danger-text)]">{timezoneError}</p> : null}

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={useBrowserTimezone}>Use detected timezone</Button>
              <Button type="submit" disabled={isTimezoneSubmitting}>
                {isTimezoneSubmitting ? 'Saving...' : 'Save timezone settings'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.45),_transparent_38%),var(--surface-strong)]">
        <CardHeader>
          <CardTitle className="text-2xl">AI Backend</CardTitle>
          <CardDescription>
            Configure the OpenAI-compatible backend used for summaries and recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleLlmSubmit}>
            <div className="space-y-3">
              <Label htmlFor="llmProvider">Provider</Label>
              <select
                id="llmProvider"
                value={llmProvider}
                onChange={(event) => setLlmProvider(event.target.value)}
                className="flex h-9 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
              >
                <option value="openai">OpenAI</option>
                <option value="ollama">Ollama</option>
                <option value="litellm">LiteLLM</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <Label htmlFor="llmBaseUrl">Base URL</Label>
                <Input
                  id="llmBaseUrl"
                  value={llmBaseUrl}
                  onChange={(event) => setLlmBaseUrl(event.target.value)}
                  autoComplete="off"
                  placeholder={llmProvider === 'openai' ? 'https://api.openai.com/v1' : 'http://localhost:11434/v1'}
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="llmModel">Model</Label>
                <Input
                  id="llmModel"
                  value={llmModel}
                  onChange={(event) => setLlmModel(event.target.value)}
                  autoComplete="off"
                  placeholder={llmProvider === 'ollama' ? 'llama3.1:8b' : 'gpt-4o-mini'}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="llmApiKey">
                API key
                {llmApiKeySaved && (
                  <span className="ml-2 text-xs font-normal text-[var(--olive-deep)]">saved</span>
                )}
              </Label>
              <Input
                id="llmApiKey"
                type="password"
                value={llmApiKey}
                onChange={(event) => setLlmApiKey(event.target.value)}
                autoComplete="new-password"
                placeholder={llmApiKeySaved ? 'Leave blank to keep existing key' : 'Required for OpenAI and some custom backends'}
              />
            </div>

            {llmMessage ? <p className="text-sm font-medium text-[var(--olive-deep)]">{llmMessage}</p> : null}
            {llmError ? <p className="text-sm text-[var(--danger-text)]">{llmError}</p> : null}

            <Button type="submit" disabled={isLlmSubmitting}>
              {isLlmSubmitting ? 'Saving...' : 'Save AI backend settings'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.45),_transparent_38%),var(--surface-strong)]">
        <CardHeader>
          <CardTitle className="text-2xl">Local DATALOG Import</CardTitle>
          <CardDescription>
            Import sessions automatically from a directory mounted into the container at <code>/data</code>. Set the path to your DATALOG folder, then trigger imports manually here or via the <code>POST /import/trigger/all</code> webhook from an external scheduler (cron, Home Assistant, n8n).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleLocalSubmit}>
            <div className="space-y-3">
              <Label htmlFor="localPath">Server path</Label>
              <Input
                id="localPath"
                value={localPath}
                onChange={(event) => setLocalPath(event.target.value)}
                autoComplete="off"
                placeholder="/data/DATALOG"
              />
              <p className="text-xs text-[var(--muted-foreground)]">Must be inside <code>/data</code> — the container mount point for your host directory.</p>
            </div>

            <div className="space-y-3">
              <Label htmlFor="localFrequency">Poll frequency</Label>
              <select
                id="localFrequency"
                value={localFrequency}
                onChange={(event) => setLocalFrequency(event.target.value)}
                className="flex h-9 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
              <p className="text-xs text-[var(--muted-foreground)]">Used as a hint for external schedulers — SleepLab does not poll automatically.</p>
            </div>

            {lastImportAt && (
              <div className="rounded-lg border border-[var(--border)] px-4 py-3 text-sm space-y-1">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Last import</p>
                <p className="text-[var(--foreground)]">{new Date(lastImportAt).toLocaleString()}</p>
                {lastImportStatus && (
                  <p className={lastImportStatus.startsWith('ok') ? 'text-[var(--olive-deep)]' : 'text-[var(--danger-text)]'}>
                    {lastImportStatus}
                  </p>
                )}
              </div>
            )}

            {localMessage ? <p className="text-sm font-medium text-[var(--olive-deep)]">{localMessage}</p> : null}
            {localError ? <p className="text-sm text-[var(--danger-text)]">{localError}</p> : null}

            <Button type="submit" disabled={isLocalSubmitting}>
              {isLocalSubmitting ? 'Saving...' : 'Save DATALOG settings'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.45),_transparent_38%),var(--surface-strong)]">
        <CardHeader>
          <CardTitle className="text-2xl">Wearable Data</CardTitle>
          <CardDescription>
            Overlay heart rate, SpO₂, and sleep stages from a self-hosted wearable API onto your session charts. Supported providers: open-wearables, mirobody.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleWearableSubmit}>
            <div className="space-y-3">
              <Label htmlFor="wearableProvider">Provider</Label>
              <select
                id="wearableProvider"
                value={wearableProvider}
                onChange={(event) => setWearableProvider(event.target.value)}
                className="flex h-9 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
              >
                <option value="">None</option>
                <option value="open-wearables">open-wearables</option>
                <option value="mirobody">mirobody</option>
              </select>
            </div>

            <div className="space-y-3">
              <Label htmlFor="wearableBaseUrl">Base URL</Label>
              <Input
                id="wearableBaseUrl"
                value={wearableBaseUrl}
                onChange={(event) => setWearableBaseUrl(event.target.value)}
                autoComplete="off"
                placeholder="https://wearables.home.example.com"
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="wearableApiKey">API key</Label>
              <Input
                id="wearableApiKey"
                type="password"
                value={wearableApiKey}
                onChange={(event) => setWearableApiKey(event.target.value)}
                autoComplete="new-password"
                placeholder="Leave blank to keep existing key"
              />
            </div>

            {wearableMessage ? <p className="text-sm font-medium text-[var(--olive-deep)]">{wearableMessage}</p> : null}
            {wearableError ? <p className="text-sm text-[var(--danger-text)]">{wearableError}</p> : null}

            <Button type="submit" disabled={isWearableSubmitting}>
              {isWearableSubmitting ? 'Saving...' : 'Save wearable settings'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-[var(--danger-text)] bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.45),_transparent_38%),var(--surface-strong)]">
        <CardHeader>
          <CardTitle className="text-2xl text-[var(--danger-text)]">Danger Zone</CardTitle>
          <CardDescription>Permanently delete all imported session data. Your account will remain intact.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {deleteMessage ? <p className="text-sm font-medium text-[var(--olive-deep)]">{deleteMessage}</p> : null}
          {deleteError ? <p className="text-sm text-[var(--danger-text)]">{deleteError}</p> : null}
          {deleteConfirm ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--danger-text)] font-medium">Are you sure? This cannot be undone.</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
                <Button onClick={handleDeleteAllSessions} disabled={isDeleting} className="bg-[var(--danger-text)] text-white hover:opacity-90">
                  {isDeleting ? 'Deleting...' : 'Yes, delete everything'}
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={handleDeleteAllSessions} variant="outline" className="border-[var(--danger-text)] text-[var(--danger-text)] hover:bg-[var(--danger-soft)]">
              Delete all session data
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
