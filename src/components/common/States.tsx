import { AlertTriangle, Loader2, RefreshCw, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/primitives'
import { getErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center rounded-3xl border border-dashed border-rose-200 bg-white/40 px-6 py-10 text-center backdrop-blur', className)}>
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-brand text-white shadow-md shadow-rose-500/25">
        <Icon aria-hidden className="size-6" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({
  error,
  title = 'Something went wrong',
  onRetry,
  className,
}: {
  error?: unknown
  title?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div role="alert" className={cn('glass flex flex-col items-center rounded-3xl px-6 py-10 text-center', className)}>
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-negative-soft text-negative">
        <AlertTriangle aria-hidden className="size-6" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{getErrorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          <RefreshCw /> Try again
        </Button>
      )}
    </div>
  )
}

export function FullPageSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status">
      <Loader2 aria-hidden className="size-6 animate-spin text-rose-500" />
      <span className="sr-only">{label}…</span>
    </div>
  )
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="glass flex items-center gap-3 rounded-3xl p-4">
          <Skeleton className="size-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  )
}

export function GroupPageSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading group">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
      <ListSkeleton rows={3} />
    </div>
  )
}
