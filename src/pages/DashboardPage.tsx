import { ChevronRight, KeyRound, Plus, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { BalanceAmount } from '@/components/common/Money'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/common/States'
import { CreateGroupDialog } from '@/components/groups/CreateGroupDialog'
import { JoinByCodeDialog } from '@/components/groups/JoinByCodeDialog'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/primitives'
import { useAuth } from '@/hooks/useAuth'
import { useMyGroups } from '@/hooks/useGroup'
import { balanceState, formatMoney } from '@/lib/settlement'
import type { GroupSummary } from '@/types/app'

function GroupCard({ group }: { group: GroupSummary }) {
  const state = balanceState(group.myBalance)
  const label = state === 'receive' ? 'you get back' : state === 'owe' ? 'you owe' : 'all settled'
  return (
    <li>
      <Link
        to={`/groups/${group.id}`}
        className="block rounded-2xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Card className="flex items-center gap-4 p-4 transition-colors hover:bg-accent/60 sm:p-5">
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold">{group.name}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'} ·{' '}
              <span className="tabular">{formatMoney(group.totalSpent, group.currency)}</span> spent
            </p>
          </div>
          <div className="text-right">
            <BalanceAmount net={group.myBalance} currency={group.currency} className="text-base" />
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
          <ChevronRight aria-hidden className="size-5 text-muted-foreground" />
        </Card>
      </Link>
    </li>
  )
}

export function DashboardPage() {
  const { profile } = useAuth()
  const groups = useMyGroups()
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const firstName = profile?.name.split(' ')[0]

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{firstName ? `Welcome, ${firstName}` : 'Welcome'}</h1>
          <p className="mt-1 text-muted-foreground">Your groups</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setJoinOpen(true)}>
            <KeyRound /> Join with code
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus /> Create group
          </Button>
        </div>
      </div>

      {groups.isPending ? (
        <ListSkeleton rows={3} />
      ) : groups.isError ? (
        <ErrorState title="We couldn't load your groups" error={groups.error} onRetry={() => void groups.refetch()} />
      ) : groups.data.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No groups yet"
          description="Create a group for your next trip, flat or event — then invite friends with a link."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus /> Create your first group
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3" aria-label="Your groups">
          {groups.data.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </ul>
      )}

      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
      <JoinByCodeDialog open={joinOpen} onOpenChange={setJoinOpen} />
    </AppShell>
  )
}
