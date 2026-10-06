import { ArrowRight, Plus, ReceiptText, UserPlus } from 'lucide-react'
import { Link } from 'react-router'
import { BalanceHero, MemberTotalsTable, PersonalBreakdown, SummaryCards } from '@/components/balances/BalanceViews'
import { EmptyState } from '@/components/common/States'
import { ExpenseList } from '@/components/expenses/ExpenseList'
import { InvitePanel } from '@/components/groups/InvitePanel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/primitives'
import { useBalances } from '@/hooks/useBalances'
import { useGroupContext } from '@/providers/GroupContext'

export function GroupPage() {
  const { group, userId, expenses, activeMembers, openExpenseForm } = useGroupContext()
  const { mine, balanceOf } = useBalances()
  const myBalance = balanceOf(userId)
  const recent = expenses.slice(0, 5)

  return (
    <div className="space-y-4 sm:space-y-6">
      <BalanceHero net={mine.net} currency={group.currency} />
      <SummaryCards paid={myBalance.paid} share={myBalance.share} net={myBalance.net} currency={group.currency} />
      <PersonalBreakdown />

      {expenses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Member-wise totals</CardTitle>
            <CardDescription>Who paid what, everyone&apos;s share, and where each person stands.</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <MemberTotalsTable />
          </CardContent>
        </Card>
      )}

      {activeMembers.length === 1 && (
        <Card>
          <CardContent>
            <div className="mb-4 flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                <UserPlus aria-hidden className="size-5" />
              </span>
              <div>
                <h2 className="font-semibold">It&apos;s just you so far</h2>
                <p className="text-sm text-muted-foreground">Invite your friends so you can split expenses.</p>
              </div>
            </div>
            <InvitePanel compact groupName={group.name} inviteToken={group.inviteToken} inviteCode={group.inviteCode} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Recent expenses</CardTitle>
          {expenses.length > 0 && (
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/groups/${group.id}/expenses`}>
                See all <ArrowRight />
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent className="pt-2">
          {recent.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="No expenses yet"
              description="Add your first expense to start tracking the trip."
              action={
                <Button onClick={() => openExpenseForm()}>
                  <Plus /> Add expense
                </Button>
              }
              className="border-0 bg-transparent py-6"
            />
          ) : (
            <ExpenseList expenses={recent} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
