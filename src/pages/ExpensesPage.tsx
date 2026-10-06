import { Plus, ReceiptText, Search } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '@/components/common/States'
import { ExpenseList } from '@/components/expenses/ExpenseList'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, NativeSelect } from '@/components/ui/primitives'
import { CATEGORIES } from '@/lib/categories'
import { formatMoney } from '@/lib/settlement'
import { useGroupContext } from '@/providers/GroupContext'
import type { Expense } from '@/types/app'

const monthFormatter = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' })

function groupByMonth(expenses: Expense[]) {
  const groups: { label: string; items: Expense[]; total: number }[] = []
  for (const expense of expenses) {
    const label = monthFormatter.format(new Date(expense.expenseDate))
    const last = groups[groups.length - 1]
    if (last && last.label === label) {
      last.items.push(expense)
      last.total += expense.amount
    } else {
      groups.push({ label, items: [expense], total: expense.amount })
    }
  }
  return groups
}

export function ExpensesPage() {
  const { expenses, group, openExpenseForm } = useGroupContext()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')

  const needle = query.trim().toLowerCase()
  const filtered = expenses.filter(
    (e) =>
      (category === 'all' || e.category === category) &&
      (!needle || e.title.toLowerCase().includes(needle) || e.description?.toLowerCase().includes(needle)),
  )

  if (expenses.length === 0) {
    return (
      <EmptyState
        icon={ReceiptText}
        title="No expenses yet"
        description="Add your first expense to start tracking the trip."
        action={
          <Button onClick={() => openExpenseForm()}>
            <Plus /> Add expense
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search expenses"
            placeholder="Search expenses"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="sm:w-52">
          <NativeSelect aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Search} title="No matching expenses" description="Try a different search or category." />
      ) : (
        groupByMonth(filtered).map((month) => (
          <Card key={month.label} className="p-2 sm:p-3">
            <div className="flex items-center justify-between px-3 pt-2 pb-1">
              <h2 className="text-sm font-semibold text-muted-foreground">{month.label}</h2>
              <span className="text-sm text-muted-foreground tabular">{formatMoney(month.total, group.currency)}</span>
            </div>
            <ExpenseList expenses={month.items} />
          </Card>
        ))
      )}
    </div>
  )
}
