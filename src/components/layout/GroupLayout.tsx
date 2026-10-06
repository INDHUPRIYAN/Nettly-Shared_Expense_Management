import { ArrowLeft, Plus, Settings, WifiOff } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Link, Outlet, useParams } from 'react-router'
import { ErrorState, GroupPageSkeleton } from '@/components/common/States'
import { ExpenseDetailsDialog } from '@/components/expenses/ExpenseDetailsDialog'
import { ExpenseFormDialog } from '@/components/expenses/ExpenseFormDialog'
import { MarkPaidDialog } from '@/components/settlements/MarkPaidDialog'
import { Button } from '@/components/ui/button'
import { useUserId } from '@/hooks/useAuth'
import { useGroupData, useGroupRealtime } from '@/hooks/useGroup'
import { formatMoney, type Transfer } from '@/lib/settlement'
import { GroupProvider, useGroupContext, type GroupActions } from '@/providers/GroupContext'
import type { Expense } from '@/types/app'
import { AppShell } from './AppShell'
import { GroupBottomNav, GroupTabs } from './GroupNav'

function GroupHeader() {
  const { group, activeMembers, realtime, openExpenseForm, totalSpent } = useGroupContext()
  return (
    <div className="mb-4 space-y-4 sm:mb-6">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1 rounded text-sm text-muted-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ArrowLeft aria-hidden className="size-4" /> All groups
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{group.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground tabular" data-testid="group-total">
              {formatMoney(totalSpent, group.currency)}
            </span>{' '}
            total spent · {activeMembers.length} {activeMembers.length === 1 ? 'member' : 'members'}
            {realtime === 'offline' && (
              <span className="ml-2 inline-flex items-center gap-1 text-pending" role="status">
                <WifiOff aria-hidden className="size-3.5" /> Live updates paused
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="icon" asChild className="md:hidden">
            <Link to={`/groups/${group.id}/settings`} aria-label="Group settings">
              <Settings />
            </Link>
          </Button>
          <Button onClick={() => openExpenseForm()} aria-label="Add expense" data-testid="header-add-expense">
            <Plus /> <span className="hidden sm:inline">Add expense</span>
            <span className="sm:hidden" aria-hidden>
              Add
            </span>
          </Button>
        </div>
      </div>
      <GroupTabs groupId={group.id} />
    </div>
  )
}

/** Loads a group, keeps it live, and provides data + shared dialogs to all group pages. */
export function GroupLayout() {
  const { groupId = '' } = useParams()
  const userId = useUserId()
  const query = useGroupData(groupId)
  const realtime = useGroupRealtime(groupId)

  const [form, setForm] = useState<{ open: boolean; expenseId?: string; key: number }>({ open: false, key: 0 })
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [settle, setSettle] = useState<{ transfer: Transfer; key: number } | null>(null)

  const openExpenseForm = useCallback(
    (expense?: Expense) => setForm((f) => ({ open: true, expenseId: expense?.id, key: f.key + 1 })),
    [],
  )
  const openExpenseDetails = useCallback((expense: Expense) => setDetailsId(expense.id), [])
  const openSettle = useCallback((transfer: Transfer) => setSettle({ transfer, key: Date.now() }), [])
  const actions = useMemo<GroupActions>(
    () => ({ openExpenseForm, openExpenseDetails, openSettle }),
    [openExpenseForm, openExpenseDetails, openSettle],
  )

  if (query.isPending) {
    return (
      <AppShell>
        <GroupPageSkeleton />
      </AppShell>
    )
  }

  if (query.isError) {
    return (
      <AppShell>
        <ErrorState title="We couldn't load this group" error={query.error} onRetry={() => void query.refetch()} />
      </AppShell>
    )
  }

  if (!query.data) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md py-10 text-center">
          <h1 className="text-xl font-semibold">Group not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This group doesn&apos;t exist, was deleted, or you&apos;re no longer a member.
          </p>
          <Button asChild className="mt-6">
            <Link to="/dashboard">Back to your groups</Link>
          </Button>
        </div>
      </AppShell>
    )
  }

  const data = query.data
  // Always show the freshest version of an open expense (realtime may update it).
  const editing = form.expenseId ? data.expenses.find((e) => e.id === form.expenseId) : undefined
  const details = detailsId ? (data.expenses.find((e) => e.id === detailsId) ?? null) : null

  return (
    <GroupProvider data={data} userId={userId} actions={actions} realtime={realtime}>
      <AppShell bottomNav={<GroupBottomNav groupId={data.group.id} />}>
        <GroupHeader />
        <Outlet />
      </AppShell>

      {form.open && (form.expenseId === undefined || editing) && (
        <ExpenseFormDialog
          key={form.key}
          open
          expense={editing}
          onOpenChange={(open) => !open && setForm((f) => ({ ...f, open: false }))}
        />
      )}
      <ExpenseDetailsDialog expense={details} onOpenChange={(open) => !open && setDetailsId(null)} />
      {settle && <MarkPaidDialog key={settle.key} transfer={settle.transfer} onOpenChange={(open) => !open && setSettle(null)} />}
    </GroupProvider>
  )
}
