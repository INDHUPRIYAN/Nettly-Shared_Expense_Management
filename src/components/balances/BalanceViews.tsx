import { ArrowDownLeft, ArrowUpRight, PartyPopper } from 'lucide-react'
import { BalanceAmount } from '@/components/common/Money'
import { MemberAvatar } from '@/components/common/MemberAvatar'
import { TransferActions } from '@/components/settlements/TransferActions'
import { Card } from '@/components/ui/primitives'
import { balanceState, formatMoney, type Money, type Transfer } from '@/lib/settlement'
import { cn } from '@/lib/utils'
import { useGroupContext } from '@/providers/GroupContext'

/** The 5-second answer: do I owe money, or do people owe me? */
export function BalanceHero({ net, currency }: { net: Money; currency: string }) {
  const state = balanceState(net)
  const { label, Icon } = {
    receive: { label: 'You should receive', Icon: ArrowDownLeft },
    owe: { label: 'You need to pay', Icon: ArrowUpRight },
    settled: { label: "You're all settled up", Icon: PartyPopper },
  }[state]

  return (
    <section
      aria-label="Your balance"
      className="relative overflow-hidden rounded-3xl bg-brand p-6 text-white shadow-xl shadow-rose-500/30 sm:p-7"
    >
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-white/20 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 left-1/3 size-56 rounded-full bg-orange-300/30 blur-3xl" />
      <div className="relative">
        <p className="text-xs font-semibold tracking-wider text-white/80 uppercase">Your balance</p>
        <p className="mt-1 text-4xl font-bold tracking-tight tabular sm:text-5xl" data-testid="my-balance">
          {state === 'settled' ? formatMoney(0, currency) : formatMoney(net, currency, { signed: true })}
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/20 px-3 py-1 text-sm font-medium backdrop-blur">
          <Icon aria-hidden className="size-4" />
          {label}
        </p>
      </div>
    </section>
  )
}

export function SummaryCards({ paid, share, net, currency }: { paid: Money; share: Money; net: Money; currency: string }) {
  const state = balanceState(net)
  const items = [
    { label: 'You paid', value: formatMoney(paid, currency), tone: '' },
    { label: 'Your share', value: formatMoney(share, currency), tone: '' },
    state === 'owe'
      ? { label: 'You owe', value: formatMoney(-net, currency), tone: 'text-negative' }
      : { label: 'You get', value: formatMoney(Math.max(net, 0), currency), tone: state === 'receive' ? 'text-positive' : '' },
  ]
  return (
    <dl className="grid grid-cols-3 gap-2 sm:gap-3">
      {items.map((item) => (
        <Card key={item.label} className="p-3 sm:p-4">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className={cn('mt-1 truncate text-base font-semibold tabular sm:text-lg', item.tone)}>{item.value}</dd>
        </Card>
      ))}
    </dl>
  )
}

function TransferLine({ transfer, direction }: { transfer: Transfer; direction: 'owe' | 'receive' }) {
  const { memberById, group, nameOf } = useGroupContext()
  const otherId = direction === 'owe' ? transfer.to : transfer.from
  const other = memberById.get(otherId)
  return (
    <li className="flex items-center gap-3 py-2.5">
      <MemberAvatar name={nameOf(otherId)} avatarUrl={other?.avatarUrl} seed={otherId} size="sm" />
      <span className="flex-1 truncate text-sm">{nameOf(otherId)}</span>
      <span className={cn('text-sm font-semibold tabular', direction === 'owe' ? 'text-negative' : 'text-positive')}>
        {formatMoney(transfer.amount, group.currency)}
      </span>
      <TransferActions transfer={transfer} compact />
    </li>
  )
}

/** "You owe" / "You should receive" breakdown built from the simplified plan. */
export function PersonalBreakdown() {
  const { mine } = useGroupContext()
  if (mine.owes.length === 0 && mine.receives.length === 0) return null
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {mine.owes.length > 0 && (
        <Card className="p-4">
          <h2 className="text-xs font-semibold tracking-wider text-negative uppercase">You owe</h2>
          <ul className="mt-1 divide-y divide-rose-100">
            {mine.owes.map((t) => (
              <TransferLine key={`${t.from}-${t.to}`} transfer={t} direction="owe" />
            ))}
          </ul>
        </Card>
      )}
      {mine.receives.length > 0 && (
        <Card className="p-4">
          <h2 className="text-xs font-semibold tracking-wider text-positive uppercase">You should receive</h2>
          <ul className="mt-1 divide-y divide-rose-100">
            {mine.receives.map((t) => (
              <TransferLine key={`${t.from}-${t.to}`} transfer={t} direction="receive" />
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

/**
 * Member-wise totals: what each person paid, their share of all expenses, and
 * their balance (after recorded payments). The totals row always reconciles:
 * total paid = total share = total spent, and balances sum to zero.
 */
export function MemberTotalsTable() {
  const { members, balanceOf, group, displayName, totalSpent } = useGroupContext()
  const rows = members
    .map((m) => ({ member: m, b: balanceOf(m.userId) }))
    .filter(({ member, b }) => member.isActive || b.paid > 0 || b.share > 0 || b.net !== 0)
  const totalShare = rows.reduce((s, r) => s + r.b.share, 0)
  const totalPaid = rows.reduce((s, r) => s + r.b.paid, 0)
  const money = (v: Money) => formatMoney(v, group.currency)

  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full text-sm" aria-label="Member-wise totals">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th scope="col" className="px-1 py-2 text-left font-medium">
              Member
            </th>
            <th scope="col" className="px-1 py-2 text-right font-medium">
              Paid
            </th>
            <th scope="col" className="px-1 py-2 text-right font-medium">
              Share
            </th>
            <th scope="col" className="px-1 py-2 text-right font-medium">
              Balance
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rose-100">
          {rows.map(({ member, b }) => (
            <tr key={member.userId}>
              <th scope="row" className="px-1 py-3 text-left font-normal">
                <div className="flex min-w-0 items-center gap-2">
                  <MemberAvatar name={member.name} avatarUrl={member.avatarUrl} seed={member.userId} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {displayName(member.userId)}
                      {!member.isActive && <span className="font-normal text-muted-foreground"> (left)</span>}
                    </p>
                    {(b.sent > 0 || b.received > 0) && (
                      <p className="truncate text-xs text-muted-foreground">
                        {b.sent > 0 && `Settled ${money(b.sent)}`}
                        {b.sent > 0 && b.received > 0 && ' · '}
                        {b.received > 0 && `Received ${money(b.received)}`}
                      </p>
                    )}
                  </div>
                </div>
              </th>
              <td className="px-1 py-3 text-right tabular">{money(b.paid)}</td>
              <td className="px-1 py-3 text-right tabular">{money(b.share)}</td>
              <td className="px-1 py-3 text-right">
                <BalanceAmount net={b.net} currency={group.currency} showIcon={false} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-rose-200 font-semibold">
            <th scope="row" className="px-1 py-3 text-left">
              Total
            </th>
            <td className="px-1 py-3 text-right tabular" data-testid="totals-paid">
              {money(totalPaid)}
            </td>
            <td className="px-1 py-3 text-right tabular" data-testid="totals-share">
              {money(totalShare)}
            </td>
            <td className="px-1 py-3 text-right text-xs font-medium text-muted-foreground">
              {totalPaid === totalSpent && totalShare === totalSpent ? 'Balanced ✓' : ''}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
