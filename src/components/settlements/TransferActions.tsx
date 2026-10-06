import { Check, Clock, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/primitives'
import { useUpdateSettlementStatus } from '@/hooks/useGroupMutations'
import { getErrorMessage } from '@/lib/errors'
import { formatMoney, type Transfer } from '@/lib/settlement'
import { useGroupContext } from '@/providers/GroupContext'

/**
 * The right action for the current user on a suggested payment:
 *  - receiver: "Mark received", or Confirm / Not received for an "I've paid" request
 *  - payer:    "I've paid" (sends a request), or "Waiting…" + cancel
 *  - others:   status only — nobody can mark someone else's money as paid
 */
export function TransferActions({ transfer, compact = false }: { transfer: Transfer; compact?: boolean }) {
  const { group, nameOf, canMarkReceived, canRequestPaid, pendingRequest, openSettle } = useGroupContext()
  const update = useUpdateSettlementStatus(group.id)
  const request = pendingRequest(transfer.from, transfer.to)

  const setStatus = (status: 'paid' | 'cancelled', success: string) =>
    request &&
    update.mutate(
      { settlementId: request.id, status },
      { onSuccess: () => toast.success(success), onError: (e) => toast.error(getErrorMessage(e)) },
    )

  if (canMarkReceived(transfer.from, transfer.to)) {
    if (request) {
      return (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button
            size="sm"
            disabled={update.isPending}
            onClick={() => setStatus('paid', `Received ${formatMoney(request.amount, group.currency)} from ${nameOf(request.fromUser)}`)}
          >
            <Check /> Confirm {formatMoney(request.amount, group.currency)}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={update.isPending}
            onClick={() => setStatus('cancelled', 'Marked as not received')}
            aria-label={`Not received from ${nameOf(request.fromUser)}`}
          >
            <X /> {compact ? '' : 'Not received'}
          </Button>
        </div>
      )
    }
    return (
      <Button size="sm" variant={compact ? 'outline' : 'default'} onClick={() => openSettle(transfer, 'receive')}>
        Mark received
      </Button>
    )
  }

  if (canRequestPaid(transfer.from, transfer.to)) {
    if (request) {
      return (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Badge variant="pending">
            <Clock /> Waiting for {nameOf(transfer.to)}
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            disabled={update.isPending}
            onClick={() => setStatus('cancelled', 'Request withdrawn')}
            aria-label="Cancel request"
          >
            <X />
          </Button>
        </div>
      )
    }
    return (
      <Button size="sm" onClick={() => openSettle(transfer, 'request')}>
        I&apos;ve paid
      </Button>
    )
  }

  return (
    <Badge variant="pending">
      <Clock /> {request ? 'Awaiting confirmation' : 'Pending'}
    </Badge>
  )
}
