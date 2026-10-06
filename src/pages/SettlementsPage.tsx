import { ArrowRight, CheckCircle2, Clock, PartyPopper, RotateCcw, XCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { MemberAvatar } from '@/components/common/MemberAvatar'
import { TransferActions } from '@/components/settlements/TransferActions'
import { EmptyState } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/primitives'
import { Segmented } from '@/components/ui/menu'
import { useUpdateSettlementStatus } from '@/hooks/useGroupMutations'
import { getErrorMessage } from '@/lib/errors'
import { formatMoney, type Transfer } from '@/lib/settlement'
import { cn, formatDate } from '@/lib/utils'
import { useGroupContext } from '@/providers/GroupContext'
import type { Settlement } from '@/types/app'

type Filter = 'all' | 'pending' | 'paid'

function Parties({ from, to }: { from: string; to: string }) {
  const { memberById, displayName } = useGroupContext()
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex -space-x-2">
        <MemberAvatar name={memberById.get(from)?.name ?? '?'} seed={from} size="sm" className="ring-2 ring-card" />
        <MemberAvatar name={memberById.get(to)?.name ?? '?'} seed={to} size="sm" className="ring-2 ring-card" />
      </div>
      <span className="flex min-w-0 items-center gap-1 truncate text-sm font-medium">
        {displayName(from)} <ArrowRight aria-label="pays" className="size-3.5 shrink-0 text-muted-foreground" /> {displayName(to)}
      </span>
    </div>
  )
}

function SuggestedRow({ transfer }: { transfer: Transfer }) {
  const { group } = useGroupContext()
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <Parties from={transfer.from} to={transfer.to} />
      </div>
      <span className="font-semibold tabular">{formatMoney(transfer.amount, group.currency)}</span>
      <TransferActions transfer={transfer} />
    </li>
  )
}

function HistoryRow({ settlement, onCancel }: { settlement: Settlement; onCancel: (s: Settlement) => void }) {
  const { group, displayName, canCancelSettlement, userId } = useGroupContext()
  const cancelLabel =
    settlement.status === 'paid' ? 'Undo' : settlement.fromUser === userId ? 'Cancel request' : 'Not received'
  const cancelled = settlement.status === 'cancelled'
  const pending = settlement.status === 'pending'
  const Icon = cancelled ? XCircle : pending ? Clock : CheckCircle2
  return (
    <li className="flex items-center gap-3 py-3">
      <Icon
        aria-hidden
        className={cn('size-5 shrink-0', cancelled ? 'text-muted-foreground' : pending ? 'text-pending' : 'text-positive')}
      />
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm', cancelled && 'text-muted-foreground line-through')}>
          <span className="font-medium">{displayName(settlement.fromUser)}</span> {pending ? 'says they paid' : 'paid'}{' '}
          <span className="font-medium">{displayName(settlement.toUser)}</span>{' '}
          <span className="font-semibold tabular">{formatMoney(settlement.amount, group.currency)}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {cancelled ? 'Cancelled' : pending ? `Waiting for ${displayName(settlement.toUser)} to confirm` : 'Paid · confirmed by receiver'} ·{' '}
          {formatDate(settlement.paidAt ?? settlement.createdAt)}
          {settlement.note && ` · ${settlement.note}`}
        </p>
      </div>
      {canCancelSettlement(settlement) && (
        <Button variant="ghost" size="sm" onClick={() => onCancel(settlement)}>
          <RotateCcw /> {cancelLabel}
        </Button>
      )}
    </li>
  )
}

export function SettlementsPage() {
  const { group, settlements, transfers, expenses } = useGroupContext()
  const updateStatus = useUpdateSettlementStatus(group.id)
  const [filter, setFilter] = useState<Filter>('all')
  const [cancelling, setCancelling] = useState<Settlement | null>(null)

  // Requests that match a suggested payment are shown on that row; list any others separately.
  const recordedPending = settlements.filter(
    (s) => s.status === 'pending' && !transfers.some((t) => t.from === s.fromUser && t.to === s.toUser),
  )
  const history = settlements.filter((s) =>
    filter === 'all' ? s.status !== 'pending' : filter === 'paid' ? s.status === 'paid' : false,
  )
  const showSuggestions = filter !== 'paid'

  return (
    <div className="space-y-4 sm:space-y-6">
      <Segmented
        label="Filter payments"
        value={filter}
        onValueChange={setFilter}
        options={[
          { value: 'all', label: 'All' },
          { value: 'pending', label: 'Pending' },
          { value: 'paid', label: 'Paid' },
        ]}
        className="max-w-sm"
      />

      {showSuggestions && (
        <Card>
          <CardHeader>
            <CardTitle>Pending payments</CardTitle>
            <CardDescription>The fewest payments that settle everyone up.</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {transfers.length === 0 && recordedPending.length === 0 ? (
              <EmptyState
                icon={PartyPopper}
                title="You're all settled!"
                description={expenses.length === 0 ? 'Add expenses and payments will appear here.' : 'No pending payments.'}
                className="border-0 bg-transparent py-6"
              />
            ) : (
              <ul className="divide-y" aria-label="Pending payments">
                {transfers.map((t) => (
                  <SuggestedRow key={`${t.from}-${t.to}`} transfer={t} />
                ))}
                {recordedPending.map((s) => (
                  <HistoryRow key={s.id} settlement={s} onCancel={setCancelling} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {filter !== 'pending' && (
        <Card>
          <CardHeader>
            <CardTitle>Settlement history</CardTitle>
            <CardDescription>Payments are recorded separately — original expenses never change.</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {history.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No payments recorded yet.</p>
            ) : (
              <ul className="divide-y" aria-label="Settlement history">
                {history.map((s) => (
                  <HistoryRow key={s.id} settlement={s} onCancel={setCancelling} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(cancelling)}
        onOpenChange={(open) => !open && setCancelling(null)}
        title={cancelling?.status === 'paid' ? 'Undo this payment?' : 'Cancel this payment request?'}
        description={
          cancelling && (
            <p>
              {cancelling.status === 'paid'
                ? `${formatMoney(cancelling.amount, group.currency)} will no longer count as received and balances will be recalculated.`
                : `The ${formatMoney(cancelling.amount, group.currency)} request will be closed without counting as paid.`}{' '}
              The record stays in the history as cancelled.
            </p>
          )
        }
        confirmLabel={cancelling?.status === 'paid' ? 'Undo payment' : 'Cancel request'}
        destructive
        pending={updateStatus.isPending}
        onConfirm={() =>
          cancelling &&
          updateStatus.mutate(
            { settlementId: cancelling.id, status: 'cancelled' },
            {
              onSuccess: () => {
                toast.success('Payment cancelled')
                setCancelling(null)
              },
              onError: (error) => toast.error(getErrorMessage(error)),
            },
          )
        }
      />
    </div>
  )
}
