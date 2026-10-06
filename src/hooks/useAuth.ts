import { useContext } from 'react'
import { AuthContext, type AuthContextValue } from '@/providers/AuthProvider'

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}

/** The signed-in user's id. Only use inside protected routes. */
export function useUserId(): string {
  const { user } = useAuth()
  if (!user) throw new Error('useUserId requires an authenticated user')
  return user.id
}
