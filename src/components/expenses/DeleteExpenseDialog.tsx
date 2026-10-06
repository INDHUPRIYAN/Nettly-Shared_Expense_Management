import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useDeleteExpense } from '@/hooks/useGroupMutations'
import { getErrorMessage } from '@/lib/errors'
import { formatMoney } from '@/lib/settlement'
import { useGroupContext } from '@/providers/GroupContext'
import type { Expense } from '@/types/app'

/** "Delete expense?" confirmation, shared by the list and the details view. */
export function DeleteExpenseDialog({
  expense,
  open,
  onOpenChange,
  onDeleted,
}: {
  expense: Expense
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}) {
  const { group } = useGroupContext()
  const deleteMutation = useDeleteExpense(group.id)
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete expense?"
      destructive
      confirmLabel="Delete"
      pending={deleteMutation.isPending}
      description={
        <>
          <p className="font-medium text-foreground">
            {expense.title} · {formatMoney(expense.amount, group.currency)}
          </p>
          <p className="mt-1">This will affect group balances.</p>
        </>
      }
      onConfirm={() =>
        deleteMutation.mutate(expense.id, {
          onSuccess: () => {
            toast.success('Expense deleted')
            onOpenChange(false)
            onDeleted?.()
          },
          onError: (error) => toast.error(getErrorMessage(error)),
        })
      }
    />
  )
}
