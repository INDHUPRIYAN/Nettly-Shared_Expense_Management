import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { MemberAvatar } from '@/components/common/MemberAvatar'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/menu'
import { Checkbox } from '@/components/ui/primitives'
import {
  FULL_PERCENT_BP,
  currencySymbol,
  formatMoney,
  parseMoney,
  parsePercentage,
  parseShares,
  toInputString,
  type Money,
  type SplitResult,
  type SplitType,
  type UserId,
} from '@/lib/settlement'
import { SPLIT_TYPE_OPTIONS, type SplitRow, type SplitRows } from '@/lib/splitForm'
import { cn } from '@/lib/utils'
import type { Member } from '@/types/app'

function summary(type: SplitType, rows: SplitRows, includedIds: UserId[], amount: Money | null, currency: string) {
  const total = amount ?? 0
  switch (type) {
    case 'equal': {
      if (!includedIds.length || !total) return { ok: includedIds.length > 0, text: 'Split equally between selected people' }
      const each = Math.floor(total / includedIds.length)
      const uneven = total % includedIds.length !== 0
      return {
        ok: true,
        text: `${formatMoney(each, currency)}${uneven ? '–' + formatMoney(each + 1, currency) : ''} each · ${includedIds.length} ${includedIds.length === 1 ? 'person' : 'people'}`,
      }
    }
    case 'custom': {
      const assigned = includedIds.reduce((s, id) => s + (parseMoney(rows[id]?.value ?? '') ?? 0), 0)
      const left = total - assigned
      if (left === 0) return { ok: total > 0, text: `${formatMoney(assigned, currency)} of ${formatMoney(total, currency)} assigned` }
      return {
        ok: false,
        text: left > 0 ? `${formatMoney(left, currency)} left to assign` : `${formatMoney(-left, currency)} over the total`,
      }
    }
    case 'percentage': {
      const bp = includedIds.reduce((s, id) => s + (parsePercentage(rows[id]?.value ?? '') ?? 0), 0)
      const left = FULL_PERCENT_BP - bp
      if (left === 0) return { ok: true, text: '100% assigned' }
      return { ok: false, text: left > 0 ? `${toInputString(left)}% left to assign` : `${toInputString(-left)}% over 100%` }
    }
    case 'shares': {
      const shares = includedIds.reduce((s, id) => s + (parseShares(rows[id]?.value ?? '') ?? 0), 0)
      return { ok: shares > 0, text: `${toInputString(shares)} total shares` }
    }
  }
}

export function SplitEditor({
  members,
  rows,
  onRowsChange,
  splitType,
  onSplitTypeChange,
  amount,
  currency,
  result,
  currentUserId,
  error,
}: {
  members: Member[]
  rows: SplitRows
  onRowsChange: (rows: SplitRows) => void
  splitType: SplitType
  onSplitTypeChange: (type: SplitType) => void
  amount: Money | null
  currency: string
  result: SplitResult | null
  currentUserId: UserId
  error?: string | null
}) {
  const includedIds = members.filter((m) => rows[m.userId]?.included).map((m) => m.userId)
  const computed = new Map(result?.ok ? result.splits.map((s) => [s.userId, s.amount]) : [])
  const status = summary(splitType, rows, includedIds, amount, currency)
  const rowError = result && !result.ok ? result.error.userId : undefined

  const setRow = (userId: UserId, patch: Partial<SplitRow>) =>
    onRowsChange({ ...rows, [userId]: { included: false, value: '', ...rows[userId], ...patch } })

  const setAll = (included: boolean) => {
    const next: SplitRows = {}
    for (const m of members) {
      next[m.userId] = { value: rows[m.userId]?.value ?? (splitType === 'shares' ? '1' : ''), included }
    }
    onRowsChange(next)
  }

  const suffix = splitType === 'percentage' ? '%' : splitType === 'shares' ? 'shares' : null

  return (
    <fieldset className="space-y-3">
      <legend className="sr-only">Members included and split</legend>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">
          Members included{' '}
          <span className="font-normal text-muted-foreground">
            ({includedIds.length} of {members.length})
          </span>
        </div>
        <div className="flex gap-1 text-xs">
          <button type="button" className="rounded px-1.5 py-0.5 font-medium text-rose-600 hover:underline" onClick={() => setAll(true)}>
            Select all
          </button>
          <button type="button" className="rounded px-1.5 py-0.5 text-muted-foreground hover:underline" onClick={() => setAll(false)}>
            Clear
          </button>
        </div>
      </div>

      <ul className="divide-y divide-rose-100 rounded-2xl border border-rose-100 bg-white/70">
        {members.map((member) => {
          const row = rows[member.userId] ?? { included: false, value: '' }
          const name = member.userId === currentUserId ? `${member.name} (you)` : member.name
          const checkboxId = `split-include-${member.userId}`
          const share = computed.get(member.userId)
          return (
            <li
              key={member.userId}
              className={cn('flex min-h-14 items-center gap-3 px-3 py-2', rowError === member.userId && 'bg-negative-soft/60')}
            >
              <Checkbox
                id={checkboxId}
                checked={row.included}
                onCheckedChange={(checked) =>
                  setRow(member.userId, {
                    included: checked === true,
                    value: row.value || (splitType === 'shares' && checked === true ? '1' : row.value),
                  })
                }
              />
              <label htmlFor={checkboxId} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                <MemberAvatar name={member.name} avatarUrl={member.avatarUrl} seed={member.userId} size="sm" />
                <span className={cn('truncate text-sm', !row.included && 'text-muted-foreground')}>{name}</span>
              </label>

              {row.included && splitType !== 'equal' && (
                <div className="relative w-28 shrink-0">
                  {splitType === 'custom' && (
                    <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
                      {currencySymbol(currency)}
                    </span>
                  )}
                  <Input
                    inputMode="decimal"
                    aria-label={`${splitType === 'custom' ? 'Amount' : splitType === 'percentage' ? 'Percentage' : 'Shares'} for ${member.name}`}
                    value={row.value}
                    onChange={(e) => setRow(member.userId, { value: e.target.value })}
                    placeholder="0"
                    className={cn('h-9 text-right tabular', splitType === 'custom' ? 'pl-7' : 'pr-14')}
                  />
                  {suffix && (
                    <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                      {suffix}
                    </span>
                  )}
                </div>
              )}

              <span
                className={cn('w-20 shrink-0 text-right text-sm tabular', row.included ? 'font-medium' : 'text-muted-foreground')}
                aria-label={row.included ? `${member.name} owes` : `${member.name} not included`}
              >
                {row.included ? (share !== undefined ? formatMoney(share, currency) : '—') : formatMoney(0, currency)}
              </span>
            </li>
          )
        })}
      </ul>

      <div className="space-y-2 pt-1">
        <div className="text-sm font-medium">Split method</div>
        <Segmented label="Split type" value={splitType} onValueChange={onSplitTypeChange} options={SPLIT_TYPE_OPTIONS} />
      </div>

      <div
        aria-live="polite"
        className={cn(
          'flex items-center gap-2 rounded-xl px-3 py-2 text-sm',
          error ? 'bg-negative-soft text-negative' : status.ok ? 'bg-positive-soft text-positive' : 'bg-pending-soft text-pending',
        )}
      >
        {error || !status.ok ? <AlertCircle aria-hidden className="size-4" /> : <CheckCircle2 aria-hidden className="size-4" />}
        <span>{error ?? status.text}</span>
      </div>
    </fieldset>
  )
}
