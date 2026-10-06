import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router'
import { FullPageSpinner } from '@/components/common/States'
import { useAuth } from '@/hooks/useAuth'
import { authPath, safeNextPath } from '@/lib/navigation'

/** Requires a session; otherwise sends the user to log in and back here afterwards. */
export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageSpinner />
  if (!user) return <Navigate to={authPath('login', location.pathname + location.search)} replace />
  return <Outlet />
}

/** Login/signup pages: logged-in users go straight to where they were heading. */
export function PublicOnlyRoute() {
  const { user, loading } = useAuth()
  const [params] = useSearchParams()
  if (loading) return <FullPageSpinner />
  if (user) return <Navigate to={safeNextPath(params.get('next'))} replace />
  return <Outlet />
}
