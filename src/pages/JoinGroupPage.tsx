import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Link2Off, Loader2, Users } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Logo } from '@/components/common/Logo'
import { ErrorState } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { Card, Skeleton } from '@/components/ui/primitives'
import { useAuth } from '@/hooks/useAuth'
import { useJoinGroup } from '@/hooks/useGroupMutations'
import { fetchInvitePreview } from '@/lib/api/mutations'
import { getErrorMessage } from '@/lib/errors'
import { authPath } from '@/lib/navigation'
import { queryKeys } from '@/lib/queryKeys'

export function JoinGroupPage() {
  const { inviteToken = '' } = useParams()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const join = useJoinGroup()
  const preview = useQuery({
    // Include the user so "already a member" is re-evaluated after logging in.
    queryKey: [...queryKeys.invite(inviteToken), user?.id ?? 'anon'],
    queryFn: () => fetchInvitePreview(inviteToken),
    enabled: !authLoading,
  })
  const here = `/join/${inviteToken}`

  const handleJoin = () =>
    join.mutate(inviteToken, {
      onSuccess: ({ groupId, status }) => {
        toast.success(status === 'already_member' ? "You're already a member" : `Welcome to ${preview.data?.name ?? 'the group'}!`)
        navigate(`/groups/${groupId}`, { replace: true })
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    })

  let body
  if (authLoading || preview.isPending) {
    body = (
      <div className="space-y-3" role="status" aria-label="Loading invite">
        <Skeleton className="mx-auto h-6 w-40" />
        <Skeleton className="mx-auto h-8 w-56" />
        <Skeleton className="mx-auto h-4 w-32" />
        <Skeleton className="h-11 w-full" />
      </div>
    )
  } else if (preview.isError) {
    body = <ErrorState title="We couldn't load this invite" error={preview.error} onRetry={() => void preview.refetch()} className="border-0 p-0" />
  } else if (!preview.data) {
    body = (
      <div className="text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-negative-soft text-negative">
          <Link2Off aria-hidden className="size-6" />
        </div>
        <h1 className="text-xl font-semibold">Invite not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This invite link is invalid or expired. Ask a member for a new one.</p>
        <Button asChild variant="outline" className="mt-6 w-full">
          <Link to={user ? '/dashboard' : '/'}>{user ? 'Go to your groups' : 'Go to home page'}</Link>
        </Button>
      </div>
    )
  } else {
    const g = preview.data
    body = (
      <div className="text-center">
        <p className="text-sm font-medium text-primary">You&apos;re invited!</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{g.name}</h1>
        {g.description && <p className="mt-2 text-sm text-muted-foreground">{g.description}</p>}
        <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
          <Users aria-hidden className="size-4" />
          {g.creatorName ? `Created by ${g.creatorName} · ` : ''}
          {g.memberCount} {g.memberCount === 1 ? 'member' : 'members'}
        </p>

        <div className="mt-6 space-y-2">
          {!user ? (
            <>
              <p className="mb-3 text-sm text-muted-foreground">Log in or create an account to join.</p>
              <Button asChild size="lg" className="w-full">
                <Link to={authPath('login', here)}>Log in to join</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full">
                <Link to={authPath('signup', here)}>Create account to join</Link>
              </Button>
            </>
          ) : g.isMember ? (
            <>
              <p className="mb-3 flex items-center justify-center gap-1.5 text-sm text-positive">
                <CheckCircle2 aria-hidden className="size-4" /> You&apos;re already a member.
              </p>
              <Button asChild size="lg" className="w-full">
                <Link to={`/groups/${g.groupId}`}>Open group</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="mb-3 text-sm text-muted-foreground">Join {g.name}?</p>
              <Button size="lg" className="w-full" onClick={handleJoin} disabled={join.isPending}>
                {join.isPending && <Loader2 className="animate-spin" />}
                Join group
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10 sm:justify-center">
      <Logo className="mb-8" to={user ? '/dashboard' : '/'} />
      <Card className="w-full max-w-sm p-6 sm:p-8">
        <main>{body}</main>
      </Card>
    </div>
  )
}
