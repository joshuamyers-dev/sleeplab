import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const navigate = useNavigate()
  const { register, user, isLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isLoading && user) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setError(null)
    setIsSubmitting(true)
    try {
      await register({ email, password })
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center">
      <Card className="w-full bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.65),_transparent_38%),var(--surface-strong)]">
        <CardHeader>
          <CardTitle className="text-2xl">Create account</CardTitle>
          <CardDescription>Set up a secure login for your imported therapy sessions.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-3">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div className="space-y-3">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            <div className="space-y-3">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </div>
            {error ? <p className="text-sm text-[var(--danger-text)]">{error}</p> : null}
            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </Button>
          </form>
          <p className="mt-4 text-sm text-[var(--muted-foreground)]">
            Already registered? <Link className="font-bold text-[var(--accent)] transition hover:text-[var(--accent-hover)]" to="/login">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
