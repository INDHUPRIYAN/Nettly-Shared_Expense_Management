import { AlertTriangle, Compass } from 'lucide-react'
import { Link, isRouteErrorResponse, useRouteError } from 'react-router'
import { Logo } from '@/components/common/Logo'
import { Button } from '@/components/ui/button'
import { APP_NAME } from '@/config/app'

function Centered({ icon: Icon, title, text }: { icon: typeof Compass; title: string; text: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Logo className="mb-10" />
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
        <Icon aria-hidden className="size-6" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">{text}</p>
      <div className="mt-6 flex gap-2">
        <Button asChild>
          <Link to="/dashboard">Your groups</Link>
        </Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    </main>
  )
}

export function NotFoundPage() {
  return <Centered icon={Compass} title="Page not found" text="The page you're looking for doesn't exist or has moved." />
}

/** Route-level error boundary: friendly message, never a stack trace. */
export function RouteErrorPage() {
  const error = useRouteError()
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />
  if (import.meta.env.DEV) console.error(error)
  return <Centered icon={AlertTriangle} title="Something went wrong" text="An unexpected error occurred. Reloading usually fixes it." />
}

/** Shown when the deployment is missing its Supabase environment variables. */
export function ConfigErrorPage({ missing }: { missing: string[] }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <AlertTriangle aria-hidden className="mb-4 size-8 text-pending" />
      <h1 className="text-xl font-semibold">{APP_NAME} is not configured</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Set these environment variables and rebuild: <code className="font-mono">{missing.join(', ')}</code>
      </p>
    </main>
  )
}
