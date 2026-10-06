import { CheckCircle2, Clock, FileDown, FileText, History, Loader2, XCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/common/States'
import { CategoryIcon } from '@/components/expenses/CategoryIcon'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/menu'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/primitives'
import { formatMoney } from '@/lib/settlement'
import { cn, formatDate } from '@/lib/utils'
import { useGroupContext } from '@/providers/GroupContext'
import type { Expense, Settlement } from '@/types/app'

type Filter = 'all' | 'expenses' | 'payments'
type Entry = { kind: 'expense'; at: string; item: Expense } | { kind: 'payment'; at: string; item: Settlement }

/** The PDF library (~400 kB) is only downloaded when someone asks for a PDF. */
const loadPdf = () => import('@/lib/pdf/receipts')

export function HistoryPage() {
  const ctx = useGroupContext()
  const { group, expenses, settlements, displayName, nameOf } = ctx
  const [filter, setFilter] = useState<Filter>('all')
  const [busy, setBusy] = useState<string | null>(null)

  const entries: Entry[] = [
    ...expenses.map((e) => ({ kind: 'expense' as const, at: e.expenseDate, item: e })),
    ...settlements.map((s) => ({ kind: 'payment' as const, at: s.paidAt ?? s.createdAt, item: s })),
  ]
    .filter((e) => filter === 'all' || (filter === 'expenses' ? e.kind === 'expense' : e.kind === 'payment'))
    .sort((a, b) => b.at.localeCompare(a.at))

  const pdfContext = { group, members: ctx.members, nameOf }

  const run = async (key: string, job: (pdf: Awaited<ReturnType<typeof loadPdf>>) => void) => {
    setBusy(key)
    try {
      job(await loadPdf())
    } catch {
      toast.error("We couldn't create the PDF. Please try again.")
    } finally {
      setBusy(null)
    }
  }

  const downloadReport = () =>
    run('report', (pdf) =>
      pdf
        .buildGroupReport({
          ...pdfContext,
          expenses,
          settlements,
          balances: ctx.balances,
          transfers: ctx.transfers,
          totalSpent: ctx.totalSpent,
        })
        .save(pdf.groupReportFilename(group)),
    )

  const downloadReceipt = (entry: Entry) =>
    run(entry.item.id, (pdf) => {
      if (entry.kind === 'expense') {
        pdf.buildExpenseReceipt(pdfContext, entry.item).save(pdf.expenseReceiptFilename(group, entry.item))
      } else {
        pdf.buildSettlementReceipt(pdfContext, entry.item).save(pdf.settlementReceiptFilename(group, entry.item, nameOf))
      }
    })

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-brand text-white shadow-md shadow-rose-500/25">
              <FileText aria-hidden className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold">Group report</h2>
              <p className="text-sm text-muted-foreground">Member-wise totals, pending payments, every expense and payment.</p>
            </div>
          </div>
          <Button onClick={downloadReport} disabled={busy === 'report' || (expenses.length === 0 && settlements.length === 0)}>
            {busy === 'report' ? <Loader2 className="animate-spin" /> : <FileDown />}
            Download PDF report
          </Button>
        </CardContent>
      </Card>

      <Segmented
        label="Filter history"
        value={filter}
        onValueChange={setFilter}
        options={[
          { value: 'all', label: 'All' },
          { value: 'expenses', label: 'Expenses' },
          { value: 'payments', label: 'Payments' },
        ]}
        className="max-w-sm"
      />

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>Everything that happened in {group.name}, newest first. Download a receipt for any item.</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {entries.length === 0 ? (
            <EmptyState icon={History} title="Nothing here yet" description="Expenses and payments will appear here." className="border-0 bg-transparent py-6" />
          ) : (
            <ul className="divide-y divide-rose-100" aria-label="History">
              {entries.map((entry) => {
                const amount = formatMoney(entry.item.amount, group.currency)
                return (
                  <li key={`${entry.kind}-${entry.item.id}`} className="flex items-center gap-3 py-3">
                    {entry.kind === 'expense' ? (
                      <CategoryIcon category={entry.item.category} />
                    ) : (
                      <PaymentIcon status={entry.item.status} />
                    )}
                    <div className="min-w-0 flex-1">
                      {entry.kind === 'expense' ? (
                        <>
                          <p className="truncate font-medium">{entry.item.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            Expense · paid by {displayName(entry.item.paidBy)} · split {entry.item.splits.length} ways ·{' '}
                            {formatDate(entry.at)}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className={cn('truncate font-medium', entry.item.status === 'cancelled' && 'text-muted-foreground line-through')}>
                            {displayName(entry.item.fromUser)} → {displayName(entry.item.toUser)}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            Payment ·{' '}
                            {entry.item.status === 'paid'
                              ? 'confirmed by receiver'
                              : entry.item.status === 'pending'
                                ? 'waiting for receiver'
                                : 'cancelled'}{' '}
                            · {formatDate(entry.at)}
                          </p>
                        </>
                      )}
                    </div>
                    <span className="shrink-0 font-semibold tabular">{amount}</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => downloadReceipt(entry)}
                      disabled={busy === entry.item.id}
                      aria-label={`Download receipt for ${entry.kind === 'expense' ? entry.item.title : `payment of ${amount}`}`}
                    >
                      {busy === entry.item.id ? <Loader2 className="animate-spin" /> : <FileDown />}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PaymentIcon({ status }: { status: Settlement['status'] }) {
  const Icon = status === 'paid' ? CheckCircle2 : status === 'pending' ? Clock : XCircle
  const tone =
    status === 'paid' ? 'bg-positive-soft text-positive' : status === 'pending' ? 'bg-pending-soft text-pending' : 'bg-muted text-muted-foreground'
  return (
    <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', tone)}>
      <Icon aria-hidden className="size-5" />
    </span>
  )
}
