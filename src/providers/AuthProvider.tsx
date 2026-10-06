import type { Session, User } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { fetchProfile } from '@/lib/api/mutations'
import { env } from '@/lib/env'
import { AppError, getErrorMessage } from '@/lib/errors'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase/client'
import type { LoginInput, SignupInput } from '@/lib/validation'
import type { Profile } from '@/types/app'

export interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  /** True until the stored session has been restored. */
  loading: boolean
  signIn: (input: LoginInput) => Promise<void>
  /** Resolves to whether the user must confirm their email before logging in. */
  signUp: (input: SignupInput, redirectPath?: string) => Promise<{ needsConfirmation: boolean }>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const signingOut = useRef(false)
  const hadSession = useRef(false)

  useEffect(() => {
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      hadSession.current = Boolean(data.session)
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      setLoading(false)
      if (event === 'SIGNED_OUT') {
        if (hadSession.current && !signingOut.current) {
          toast.info('Your session expired. Please log in again.')
        }
        signingOut.current = false
        queryClient.clear()
      }
      hadSession.current = Boolean(next)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [queryClient])

  const userId = session?.user.id
  const profileQuery = useQuery({
    queryKey: queryKeys.profile(userId ?? ''),
    queryFn: () => fetchProfile(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
  })

  const signIn = useCallback(async ({ email, password }: LoginInput) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new AppError(getErrorMessage(error, "We couldn't log you in."), error.code)
  }, [])

  const signUp = useCallback(async ({ name, email, password }: SignupInput, redirectPath = '/dashboard') => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${env.appUrl}/login?next=${encodeURIComponent(redirectPath)}`,
      },
    })
    if (error) throw new AppError(getErrorMessage(error, "We couldn't create your account."), error.code)
    // With email confirmation enabled Supabase returns a user without a session.
    // An empty identities list means the email is already registered.
    if (data.user && data.user.identities?.length === 0) {
      throw new AppError('An account with this email already exists. Try logging in.', 'user_already_exists')
    }
    return { needsConfirmation: !data.session }
  }, [])

  const signOut = useCallback(async () => {
    signingOut.current = true
    const { error } = await supabase.auth.signOut()
    if (error) {
      // The local session is cleared even if the network call fails.
      await supabase.auth.signOut({ scope: 'local' })
    }
    queryClient.clear()
  }, [queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile: profileQuery.data ?? null,
      loading,
      signIn,
      signUp,
      signOut,
    }),
    [session, profileQuery.data, loading, signIn, signUp, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
