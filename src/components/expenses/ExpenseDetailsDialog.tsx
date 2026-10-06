import { Lock, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { MemberAvatar } from '@/components/common/MemberAvatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/primitives'
import { getCategory } from '@/lib/categories'
import { formatMoney } from '@/lib/settlement'
import { formatDate } from '@/lib/utils'
import { useGroupContext } from '@/providers/GroupContext'
import type { Expense } from '@/types/app'
import { CategoryIcon } from './CategoryIcon'
import { DeleteExpenseDialog } from './DeleteExpenseDialog'

const SPLIT_LABEL = { equal: 'Split equally', custom: 'Custom amounts', percentage: 'By percentage', shares: 'By shares' } as const

export function ExpenseDetailsDialog({
  expense,
  onOpenChange,
}: {
  expense: Expense | null
  onOpenChange: (open: boolean) => void
}) {
  const { group, members, memberById, displayName, canEditExpense, isExpenseLocked, openExpenseForm } = useGroupContext()
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!expense) return null
  const editable = canEditExpense(expense)
  const locked = isExpenseLocked(expense)
  const included = new Set(expense.splits.map((s) => s.userId))
  const excluded = members.filter((m) => m.isActive && !included.has(m.userId))

  const weightLabel = (weight: number | null) => {
    if (weight == null) return null
    if (expense.splitType === 'percentage') return `${weight}%`
    if (expense.splitType === 'shares') return `${weight} ${weight === 1 ? 'share' : 'shares'}`
    return null
  }

  return (
    <>
      <Dialog open={Boolean(expense)} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <CategoryIcon category={expense.category} />
              <div className="min-w-0">
                <DialogTitle className="truncate">{expense.title}</DialogTitle>
                <DialogDescription>
                  {getCategory(expense.category).label} · {formatDate(expense.expenseDate)}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4">
            <p className="text-3xl font-bold tracking-tight tabular">{formatMoney(expense.amount, group.currency)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Paid by <span className="font-medium text-foreground">{displayName(expense.paidBy)}</span> ·{' '}
              {SPLIT_LABEL[expense.splitType]}
            </p>
            {expense.description && <p className="mt-3 text-sm">{expense.description}</p>}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium">Who owes what</h3>
            <ul className="divide-y divide-rose-100 rounded-2xl border border-rose-100 bg-white/70">
              {expense.splits.map((split) => {
                const member = memberById.get(split.userId)
                const name = displayName(split.userId)
                return (
                  <li key={split.userId} className="flex items-center gap-3 px-3 py-2.5">
                    <MemberAvatar name={member?.name ?? name} avatarUrl={member?.avatarUrl} seed={split.userId} size="sm" />
                    <span className="flex-1 truncate text-sm">
                      {name}
                      {member && !member.isActive && <span className="text-muted-foreground"> (left)</span>}
                    </span>
                    {weightLabel(split.weight) && (
                      <span className="text-xs text-muted-foreground">{weightLabel(split.weight)}</span>
                    )}
                    <span className="text-sm font-medium tabular">{formatMoney(split.amount, group.currency)}</span>
                  </li>
                )
              })}
            </ul>
            {excluded.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Not included: {excluded.map((m) => displayName(m.userId)).join(', ')} (owe {formatMoney(0, group.currency)})
              </p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Added by {displayName(expense.createdBy)} on {formatDate(expense.createdAt)}
            {expense.updatedAt !== expense.createdAt && ` · edited ${formatDate(expense.updatedAt)}`}
          </p>

          {locked ? (
            <Badge variant="outline" className="w-fit gap-1.5 py-1">
              <Lock /> Involves someone who left the group — can&apos;t be changed
            </Badge>
          ) : editable ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" className="text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 /> Delete
              </Button>
              <Button
                onClick={() => {
                  onOpenChange(false)
                  openExpenseForm(expense)
                }}
              >
                <Pencil /> Edit
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Only {displayName(expense.createdBy)} (who added this expense) can edit or delete it.
            </p>
          )}
        </DialogContent>
      </Dialog>

      <DeleteExpenseDialog
        expense={expense}
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onDeleted={() => onOpenChange(false)}
      />
    </>
  )
}
