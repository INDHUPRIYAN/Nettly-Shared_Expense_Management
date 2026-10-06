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
import { useGroupContext } from '@/providers/GroupContext'

/** "Confirm payment" for a suggested transfer. Supports partial payments. Mount with a key per transfer. */
export function MarkPaidDialog({ transfer, onOpenChange }: { transfer: Transfer; onOpenChange: (open: boolean) => void }) {
  const { group, userId, nameOf } = useGroupContext()
  const record = useRecordSettlement(group.id)
  const [partial, setPartial] = useState(false)
  const [amountInput, setAmountInput] = useState(toInputString(transfer.amount))
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const amount = partial ? parseMoney(amountInput) : transfer.amount
  const shown = formatMoney(amount && amount > 0 ? amount : transfer.amount, group.currency)
  const sentence =
    transfer.from === userId
      ? `You are marking ${shown} paid to ${nameOf(transfer.to)}.`
      : transfer.to === userId
        ? `You are confirming ${nameOf(transfer.from)} paid you ${shown}.`
        : `You are marking ${shown} paid from ${nameOf(transfer.from)} to ${nameOf(transfer.to)}.`

  const confirm = () => {
    if (partial && (amount === null || amount > transfer.amount)) {
      setErrors({ amount: amount === null ? 'Enter a valid amount.' : `That's more than the ${formatMoney(transfer.amount, group.currency)} owed.` })
      return
    }
    const parsed = settlementSchema.safeParse({ fromUser: transfer.from, toUser: transfer.to, amount: amount ?? 0, note })
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error))
      return
    }
    record.mutate(parsed.data, {
      onSuccess: () => {
        toast.success('Payment recorded')
        onOpenChange(false)
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    })
  }

  return (
    <Dialog open onOpenChange={(next) => !record.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm payment</DialogTitle>
          <DialogDescription>{sentence}</DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl bg-muted/60 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            {nameOf(transfer.from)} → {nameOf(transfer.to)}
          </p>
          <p className="mt-1 text-3xl font-bold tabular">{shown}</p>
        </div>

        {partial ? (
          <Field id="settle-amount" label="Amount paid" error={errors.amount} hint={`Up to ${formatMoney(transfer.amount, group.currency)}`}>
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
          <button type="button" className="text-sm text-primary hover:underline" onClick={() => setPartial(true)}>
            Paid a different (partial) amount?
          </button>
        )}

        <Field id="settle-note" label="Note" optional error={errors.note}>
          {(aria) => (
            <Input {...aria} value={note} onChange={(e) => setNote(e.target.value)} placeholder="UPI, cash…" maxLength={200} />
          )}
        </Field>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={record.isPending}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={record.isPending}>
            {record.isPending && <Loader2 className="animate-spin" />}
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
