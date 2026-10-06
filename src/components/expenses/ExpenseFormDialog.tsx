import { Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { Field, NativeSelect } from '@/components/ui/primitives'
import { useCreateExpense, useUpdateExpense } from '@/hooks/useGroupMutations'
import { CATEGORIES } from '@/lib/categories'
import { getErrorMessage } from '@/lib/errors'
import { computeSplit, currencySymbol, formatMoney, parseMoney, toInputString, type SplitType } from '@/lib/settlement'
import { dateInputToIso, toDateInputValue } from '@/lib/utils'
import { expenseDetailsSchema, fieldErrors } from '@/lib/validation'
import { useGroupContext } from '@/providers/GroupContext'
import type { Expense, ExpenseInput, Member } from '@/types/app'
import { defaultValues, type SplitRows } from '@/lib/splitForm'
import { SplitEditor } from './SplitEditor'

function initialRows(members: Member[], expense: Expense | undefined): SplitRows {
  const rows: SplitRows = {}
  for (const m of members) {
    const split = expense?.splits.find((s) => s.userId === m.userId)
    let value = ''
    if (split && expense) {
      if (expense.splitType === 'custom') value = toInputString(split.amount)
      else if (expense.splitType === 'percentage' || expense.splitType === 'shares') value = split.weight != null ? String(split.weight) : ''
    }
    rows[m.userId] = { included: expense ? Boolean(split) : true, value }
  }
  return rows
}

/** Add or edit an expense. Mount with a `key` so state resets for each expense. */
export function ExpenseFormDialog({
  open,
  onOpenChange,
  expense,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  expense?: Expense
}) {
  const { group, activeMembers, userId } = useGroupContext()
  const createMutation = useCreateExpense(group.id)
  const updateMutation = useUpdateExpense(group.id)
  const pending = createMutation.isPending || updateMutation.isPending
  const isEdit = Boolean(expense)

  const [title, setTitle] = useState(expense?.title ?? '')
  const [description, setDescription] = useState(expense?.description ?? '')
  const [amountInput, setAmountInput] = useState(expense ? toInputString(expense.amount) : '')
  const [paidBy, setPaidBy] = useState(expense?.paidBy ?? userId)
  const [category, setCategory] = useState<string>(expense?.category ?? 'food')
  const [date, setDate] = useState(toDateInputValue(expense?.expenseDate ?? new Date()))
  const [splitType, setSplitType] = useState<SplitType>(expense?.splitType ?? 'equal')
  const [rows, setRows] = useState<SplitRows>(() => initialRows(activeMembers, expense))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showSplitError, setShowSplitError] = useState(false)

  const amount = parseMoney(amountInput)
  const includedIds = activeMembers.filter((m) => rows[m.userId]?.included).map((m) => m.userId)

  const splitResult =
    amount && amount > 0
      ? computeSplit({
          type: splitType,
          total: amount,
          participants: includedIds.map((id) => ({ userId: id, value: rows[id]?.value })),
        })
      : null

  const changeSplitType = (type: SplitType) => {
    setSplitType(type)
    const values = defaultValues(type, includedIds, amount)
    const next: SplitRows = {}
    for (const m of activeMembers) {
      next[m.userId] = { included: rows[m.userId]?.included ?? false, value: values[m.userId] ?? '' }
    }
    setRows(next)
  }

  const splitError =
    includedIds.length === 0
      ? 'Select at least one person to split with.'
      : showSplitError && splitResult && !splitResult.ok
        ? splitResult.error.message
        : null

  const payerName = activeMembers.find((m) => m.userId === paidBy)?.name ?? 'Someone'
  const preview = (() => {
    if (!amount || !splitResult?.ok) return null
    const payerShare = splitResult.splits.find((s) => s.userId === paidBy)?.amount ?? 0
    const others = splitResult.splits.filter((s) => s.userId !== paidBy && s.amount > 0).length
    return {
      payer: paidBy === userId ? 'You' : payerName,
      total: formatMoney(amount, group.currency),
      payerShare: formatMoney(payerShare, group.currency),
      getsBack: amount - payerShare > 0 ? formatMoney(amount - payerShare, group.currency) : null,
      others: `${others} ${others === 1 ? 'person' : 'people'}`,
    }
  })()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const details = expenseDetailsSchema.safeParse({
      title,
      description,
      amount: amountInput,
      paidBy,
      category,
      splitType,
      expenseDate: date,
    })
    const nextErrors = details.success ? {} : fieldErrors(details.error)
    if (!activeMembers.some((m) => m.userId === paidBy)) nextErrors.paidBy = 'The payer must be a current group member.'
    setErrors(nextErrors)
    setShowSplitError(true)
    if (!details.success || Object.keys(nextErrors).length > 0) return

    const split = computeSplit({
      type: splitType,
      total: details.data.amount,
      participants: includedIds.map((id) => ({ userId: id, value: rows[id]?.value })),
    })
    if (!split.ok) return

    const keepOriginalDate = expense && toDateInputValue(expense.expenseDate) === date
    const input: ExpenseInput = {
      title: details.data.title,
      description: details.data.description,
      amount: details.data.amount,
      paidBy: details.data.paidBy,
      category: details.data.category,
      splitType,
      expenseDate: keepOriginalDate ? expense.expenseDate : dateInputToIso(date),
      splits: split.splits.map((s) => ({ userId: s.userId, amount: s.amount, weight: s.weight ?? null })),
    }

    const onError = (error: unknown) => toast.error(getErrorMessage(error))
    if (expense) {
      updateMutation.mutate(
        { expenseId: expense.id, input },
        {
          onSuccess: () => {
            toast.success('Expense updated')
            onOpenChange(false)
          },
          onError,
        },
      )
    } else {
      createMutation.mutate(input, {
        onSuccess: () => {
          toast.success(`${input.title} added`)
          onOpenChange(false)
        },
        onError,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit expense' : 'Add expense'}</DialogTitle>
          <DialogDescription>{isEdit ? 'Balances update for everyone as soon as you save.' : `Added to ${group.name}.`}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="space-y-4">
          <Field id="expense-title" label="Title" error={errors.title}>
            {(aria) => (
              <Input
                {...aria}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Dinner"
                maxLength={100}
                autoComplete="off"
                autoFocus={!isEdit}
              />
            )}
          </Field>

          <Field id="expense-description" label="Description" optional error={errors.description}>
            {(aria) => (
              <Textarea
                {...aria}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Dinner near Connaught Place"
                maxLength={500}
                rows={2}
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="expense-amount" label="Amount" error={errors.amount}>
              {(aria) => (
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                    {currencySymbol(group.currency)}
                  </span>
                  <Input
                    {...aria}
                    inputMode="decimal"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="0.00"
                    className="pl-10 text-lg font-semibold tabular"
                    autoComplete="off"
                  />
                </div>
              )}
            </Field>
            <Field id="expense-paid-by" label="Paid by (owner)" error={errors.paidBy}>
              {(aria) => (
                <NativeSelect {...aria} value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
                  {activeMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.userId === userId ? `${m.name} (you)` : m.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
          </div>

          <SplitEditor
            members={activeMembers}
            rows={rows}
            onRowsChange={setRows}
            splitType={splitType}
            onSplitTypeChange={changeSplitType}
            amount={amount}
            currency={group.currency}
            result={splitResult}
            currentUserId={userId}
            error={splitError}
          />

          {preview && (
            <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-3 text-sm" data-testid="calc-preview">
              <p className="font-medium">Calculation</p>
              <p className="mt-1 text-muted-foreground">
                <span className="font-medium text-foreground">{preview.payer}</span> paid{' '}
                <span className="font-medium text-foreground tabular">{preview.total}</span> · own share{' '}
                <span className="tabular">{preview.payerShare}</span> ·{' '}
                {preview.getsBack ? (
                  <>
                    gets back <span className="font-semibold text-positive tabular">{preview.getsBack}</span> from {preview.others}
                  </>
                ) : (
                  'nobody owes anything for this'
                )}
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="expense-category" label="Category" error={errors.category}>
              {(aria) => (
                <NativeSelect {...aria} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field id="expense-date" label="Date" error={errors.expenseDate}>
              {(aria) => <Input {...aria} type="date" value={date} onChange={(e) => setDate(e.target.value)} max="2100-12-31" />}
            </Field>
          </div>

          <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-col-reverse gap-2 border-t border-rose-100 bg-white/90 px-5 py-4 backdrop-blur sm:static sm:mx-0 sm:mb-0 sm:flex-row sm:justify-end sm:border-0 sm:p-0">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {isEdit ? 'Save changes' : 'Add expense'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
