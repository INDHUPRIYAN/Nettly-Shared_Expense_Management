import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/primitives'
import { useRecordSettlement } from '@/hooks/useGroupMutations'
import { getErrorMessage } from '@/lib/errors'
import { currencySymbol, formatMoney, parseMoney, toInputString, type Transfer } from '@/lib/settlement'
import { fieldErrors, settlementSchema } from '@/lib/validation'
import { useGroupContext, type SettleMode } from '@/providers/GroupContext'

/**
 * 'receive': the RECEIVER confirms they got the money -> recorded as paid.
 * 'request': the PAYER says "I've paid" -> pending until the receiver confirms.
 * Supports partial amounts. Mount with a key per transfer.
 */
export function MarkPaidDialog({
  transfer,
  mode,
  onOpenChange,
}: {
  transfer: Transfer
  mode: SettleMode
  onOpenChange: (open: boolean) => void
}) {
  const { group, nameOf } = useGroupContext()
  const record = useRecordSettlement(group.id)
  const [partial, setPartial] = useState(false)
  const [amountInput, setAmountInput] = useState(toInputString(transfer.amount))
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const amount = partial ? parseMoney(amountInput) : transfer.amount
  const shown = formatMoney(amount && amount > 0 ? amount : transfer.amount, group.currency)
  const receiving = mode === 'receive'
  const title = receiving ? 'Confirm payment received' : "Tell them you've paid"
  const sentence = receiving
    ? `You are confirming you received ${shown} from ${nameOf(transfer.from)}.`
    : `${nameOf(transfer.to)} will be asked to confirm they received ${shown}. It counts as paid only after they confirm.`

  const confirm = () => {
    if (partial && (amount === null || amount > transfer.amount)) {
      setErrors({
        amount: amount === null ? 'Enter a valid amount.' : `That's more than the ${formatMoney(transfer.amount, group.currency)} owed.`,
      })
      return
    }
    const parsed = settlementSchema.safeParse({ fromUser: transfer.from, toUser: transfer.to, amount: amount ?? 0, note })
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error))
      return
    }
    record.mutate(
      { ...parsed.data, status: receiving ? 'paid' : 'pending' },
      {
        onSuccess: () => {
          toast.success(receiving ? 'Payment marked as received' : `Request sent to ${nameOf(transfer.to)}`)
          onOpenChange(false)
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(next) => !record.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{sentence}</DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            {nameOf(transfer.from)} → {nameOf(transfer.to)}
          </p>
          <p className="mt-1 text-3xl font-bold tabular">{shown}</p>
        </div>

        {partial ? (
          <Field
            id="settle-amount"
            label={receiving ? 'Amount received' : 'Amount paid'}
            error={errors.amount}
            hint={`Up to ${formatMoney(transfer.amount, group.currency)}`}
          >
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
                  className="pl-10 tabular"
                  autoFocus
                />
              </div>
            )}
          </Field>
        ) : (
          <button type="button" className="text-sm font-medium text-rose-600 hover:underline" onClick={() => setPartial(true)}>
            {receiving ? 'Received a different (partial) amount?' : 'Paid a different (partial) amount?'}
          </button>
        )}

        <Field id="settle-note" label="Note" optional error={errors.note}>
          {(aria) => <Input {...aria} value={note} onChange={(e) => setNote(e.target.value)} placeholder="UPI, cash…" maxLength={200} />}
        </Field>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={record.isPending}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={record.isPending}>
            {record.isPending && <Loader2 className="animate-spin" />}
            {receiving ? 'Confirm received' : 'Send request'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
