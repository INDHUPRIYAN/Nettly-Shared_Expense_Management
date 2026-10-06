import { ArrowDownLeft, ArrowUpRight, Check } from 'lucide-react'
import { balanceState, formatMoney, type Money as MoneyValue } from '@/lib/settlement'
import { cn } from '@/lib/utils'

/** Plain formatted amount with tabular digits. */
export function Money({ amount, currency, className }: { amount: MoneyValue; currency: string; className?: string }) {
  return <span className={cn('tabular', className)}>{formatMoney(amount, currency)}</span>
}

const STATE_STYLES = {
  receive: 'text-positive',
  owe: 'text-negative',
  settled: 'text-muted-foreground',
} as const

/**
 * A net balance with sign, colour AND an icon/label, so meaning never depends
 * on colour alone.
 */
export function BalanceAmount({
  net,
  currency,
  className,
  showIcon = true,
  label = 'short',
}: {
  net: MoneyValue
  currency: string
  className?: string
  showIcon?: boolean
  label?: 'none' | 'short'
}) {
  const state = balanceState(net)
  const Icon = state === 'receive' ? ArrowDownLeft : state === 'owe' ? ArrowUpRight : Check
  const text = state === 'receive' ? 'gets back' : state === 'owe' ? 'owes' : 'settled'
  return (
    <span className={cn('inline-flex items-center gap-1 font-semibold tabular', STATE_STYLES[state], className)}>
      {showIcon && <Icon aria-hidden className="size-3.5" />}
      {state === 'settled' ? (
        <span>Settled</span>
      ) : (
        <span>{formatMoney(net, currency, { signed: true })}</span>
      )}
      {label === 'short' && state !== 'settled' && <span className="sr-only">({text})</span>}
    </span>
  )
}
