import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'

import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { useAuth } from '../context/AuthContext'

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

  useEffect(() => {
    if (!user) {
      return
    }
    setFirstName(user.first_name)
    setLastName(user.last_name)
    setEmail(user.email)
  }, [user])

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
    </div>
  )
}
