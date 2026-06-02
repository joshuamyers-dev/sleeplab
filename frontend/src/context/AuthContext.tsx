import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import {
  api,
  authTokenStore,
  UnauthorizedError,
  type AuthUser,
  type LoginRequest,
  type RegisterRequest,
  type UpdateProfileRequest,
} from '../api/client'

/**
 * Properties and structure for the auth context value.
 */
interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  login: (payload: LoginRequest) => Promise<void>
  register: (payload: RegisterRequest) => Promise<void>
  logout: () => Promise<void>
  updateProfile: (payload: UpdateProfileRequest) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * React component to render the auth provider.
 *
 * @returns The rendered React element.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!authTokenStore.get()) {
      setIsLoading(false)
      return
    }

    api.me()
      .then(setUser)
      .catch((error) => {
        if (!(error instanceof UnauthorizedError)) {
          console.error(error)
        }
        authTokenStore.clear()
        setUser(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const value: AuthContextValue = {
    user,
    isLoading,
    async login(payload) {
      const { token, user: nextUser } = await api.login(payload)
      authTokenStore.set(token)
      setUser(nextUser)
    },
    async register(payload) {
      const { token, user: nextUser } = await api.register(payload)
      authTokenStore.set(token)
      setUser(nextUser)
    },
    async logout() {
      authTokenStore.clear()
      await api.logout()
      setUser(null)
    },
    async updateProfile(payload) {
      const nextUser = await api.updateProfile(payload)
      setUser(nextUser)
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Custom hook for managing use auth.
 *
 * @returns Object containing hook state and controls.
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
