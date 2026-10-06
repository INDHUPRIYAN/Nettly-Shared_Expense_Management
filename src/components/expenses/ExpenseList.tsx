import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useInvolvement } from '@/hooks/useInvolvement'
import { formatMoney } from '@/lib/settlement'
import { cn, formatDate } from '@/lib/utils'
import { useGroupContext } from '@/providers/GroupContext'
import type { Expense } from '@/types/app'
import { CategoryIcon } from './CategoryIcon'
import { DeleteExpenseDialog } from './DeleteExpenseDialog'

export function ExpenseRow({ expense }: { expense: Expense }) {
  const { displayName, openExpenseDetails, openExpenseForm, canEditExpense, isExpenseLocked, group } = useGroupContext()
  const involvement = useInvolvement()(expense)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const locked = isExpenseLocked(expense)
  const allowed = canEditExpense(expense) && !locked
  const reason = locked
    ? 'Involves someone who left the group'
    : 'Only the person who added it or a group admin can change this'
  const amount = formatMoney(expense.amount, group.currency)

  return (
    <li className="flex items-center gap-1 rounded-2xl transition-colors hover:bg-white/70">
      <button
        type="button"
        onClick={() => openExpenseDetails(expense)}
        aria-label={`${expense.title} — ${amount}, paid by ${displayName(expense.paidBy)}`}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-2xl py-3 pl-3 text-left focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <CategoryIcon category={expense.category} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{expense.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            Paid by {displayName(expense.paidBy)} · {formatDate(expense.expenseDate)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-semibold tabular">{amount}</p>
          <p className={cn('text-xs', involvement.tone)}>{involvement.text}</p>
        </div>
      </button>
      <div className="flex shrink-0 items-center pr-1.5" title={allowed ? undefined : reason}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit ${expense.title}`}
          disabled={!allowed}
          onClick={() => openExpenseForm(expense)}
        >
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${expense.title}`}
          disabled={!allowed}
          onClick={() => setConfirmDelete(true)}
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 />
        </Button>
      </div>
      {allowed && <DeleteExpenseDialog expense={expense} open={confirmDelete} onOpenChange={setConfirmDelete} />}
    </li>
  )
}

export function ExpenseList({ expenses, className }: { expenses: Expense[]; className?: string }) {
  return (
    <ul className={cn('-mx-1 space-y-0.5', className)} aria-label="Expenses">
      {expenses.map((expense) => (
        <ExpenseRow key={expense.id} expense={expense} />
      ))}
    </ul>
  )
}
