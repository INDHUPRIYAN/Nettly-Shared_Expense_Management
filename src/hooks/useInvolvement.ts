import { formatMoney } from '@/lib/settlement'
import { useGroupContext } from '@/providers/GroupContext'
import type { Expense } from '@/types/app'

/** How the current user is involved in an expense, in plain words. */
export function useInvolvement() {
  const { userId, group } = useGroupContext()
  return (expense: Expense) => {
    const myShare = expense.splits.find((s) => s.userId === userId)?.amount ?? 0
    if (expense.paidBy === userId) {
      const lent = expense.amount - myShare
      return lent > 0
        ? { text: `you lent ${formatMoney(lent, group.currency)}`, tone: 'text-positive' }
        : { text: 'you paid for yourself', tone: 'text-muted-foreground' }
    }
    if (myShare > 0) return { text: `you owe ${formatMoney(myShare, group.currency)}`, tone: 'text-negative' }
    return { text: 'not involved', tone: 'text-muted-foreground' }
  }
}
