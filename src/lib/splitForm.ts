import { FULL_PERCENT_BP, allocateByWeights, toInputString, type Money, type SplitType, type UserId } from '@/lib/settlement'

/* Form state helpers for the split editor. */

export interface SplitRow {
  included: boolean
  value: string
}
export type SplitRows = Record<UserId, SplitRow>

export const SPLIT_TYPE_OPTIONS: ReadonlyArray<{ value: SplitType; label: string }> = [
  { value: 'equal', label: 'Equal' },
  { value: 'custom', label: 'Custom' },
  { value: 'percentage', label: 'Percent' },
  { value: 'shares', label: 'Shares' },
]

/** Sensible starting values when switching split type, so the split is valid immediately. */
export function defaultValues(type: SplitType, includedIds: readonly UserId[], amount: Money | null): Record<UserId, string> {
  const result: Record<UserId, string> = {}
  if (includedIds.length === 0) return result
  if (type === 'percentage') {
    const bps = allocateByWeights(
      FULL_PERCENT_BP,
      includedIds.map(() => 1),
    )
    includedIds.forEach((id, i) => (result[id] = toInputString(bps[i] ?? 0)))
  } else if (type === 'shares') {
    includedIds.forEach((id) => (result[id] = '1'))
  } else if (type === 'custom') {
    const amounts = amount && amount > 0 ? allocateByWeights(amount, includedIds.map(() => 1)) : []
    includedIds.forEach((id, i) => (result[id] = amounts[i] !== undefined ? toInputString(amounts[i]) : ''))
  }
  return result
}
