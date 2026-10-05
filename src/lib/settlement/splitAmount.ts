import { MAX_AMOUNT, assertMoney, isMoney, parseMoney, parseScaledDecimal } from './money'
import type { Money, SplitShare, SplitType, UserId } from './types'

/**
 * Split engine. Every function returns integer amounts that sum EXACTLY to the
 * total — money is never created or lost. Rounding is deterministic: leftover
 * minor units go to the participants with the largest fractional remainder;
 * ties go to the participants that appear LATER in the input order
 * (so ₹100 / 3 = 33, 33, 34).
 */

/** 100% expressed in basis points (1 bp = 0.01%). */
export const FULL_PERCENT_BP = 10_000
/** Share counts are accepted with up to 2 decimals and scaled by this factor. */
export const SHARE_SCALE = 100

export type SplitErrorCode =
  | 'NO_PARTICIPANTS'
  | 'DUPLICATE_PARTICIPANT'
  | 'INVALID_TOTAL'
  | 'INVALID_VALUE'
  | 'TOTAL_MISMATCH'
  | 'PERCENT_MISMATCH'
  | 'SHARES_NOT_POSITIVE'

export interface SplitError {
  code: SplitErrorCode
  message: string
  /** Participant the error refers to, when applicable. */
  userId?: UserId
}

export type SplitResult = { ok: true; splits: SplitShare[] } | { ok: false; error: SplitError }

const fail = (code: SplitErrorCode, message: string, userId?: UserId): SplitResult => ({
  ok: false,
  error: { code, message, ...(userId ? { userId } : {}) },
})

/**
 * Largest-remainder allocation of `total` proportionally to integer `weights`.
 * Uses BigInt internally so `total * weight` can never overflow.
 */
export function allocateByWeights(total: Money, weights: readonly number[]): Money[] {
  assertMoney(total)
  if (total < 0) throw new RangeError('total must be non-negative')
  if (weights.length === 0) throw new RangeError('at least one weight is required')
  for (const w of weights) {
    if (!Number.isSafeInteger(w) || w < 0) throw new RangeError('weights must be non-negative integers')
  }
  const weightSum = weights.reduce((a, b) => a + BigInt(b), 0n)
  if (weightSum === 0n) throw new RangeError('weights must not all be zero')

  const bigTotal = BigInt(total)
  const base: bigint[] = []
  const remainders: bigint[] = []
  for (const w of weights) {
    const product = bigTotal * BigInt(w)
    base.push(product / weightSum)
    remainders.push(product % weightSum)
  }

  let leftover = Number(bigTotal - base.reduce((a, b) => a + b, 0n))
  // Order: largest remainder first; ties -> later index first.
  const order = weights
    .map((_, i) => i)
    .sort((a, b) => {
      const ra = remainders[a] ?? 0n
      const rb = remainders[b] ?? 0n
      if (ra !== rb) return ra > rb ? -1 : 1
      return b - a
    })
    .filter((i) => (weights[i] ?? 0) > 0)

  const result = base.map(Number)
  for (let k = 0; leftover > 0; k = (k + 1) % order.length, leftover--) {
    const idx = order[k] as number
    result[idx] = (result[idx] ?? 0) + 1
  }
  return result
}

function checkCommon(total: Money, userIds: readonly UserId[]): SplitResult | null {
  if (!isMoney(total) || total <= 0 || total > MAX_AMOUNT) {
    return fail('INVALID_TOTAL', 'Enter an amount greater than zero.')
  }
  if (userIds.length === 0) {
    return fail('NO_PARTICIPANTS', 'Select at least one person to split with.')
  }
  const seen = new Set<UserId>()
  for (const id of userIds) {
    if (seen.has(id)) return fail('DUPLICATE_PARTICIPANT', 'A person can only be included once.', id)
    seen.add(id)
  }
  return null
}

/** Equal split: ₹1000 / 4 = 250 each; ₹100 / 3 = 33, 33, 34. */
export function splitEqual(total: Money, userIds: readonly UserId[]): SplitResult {
  const invalid = checkCommon(total, userIds)
  if (invalid) return invalid
  const amounts = allocateByWeights(total, userIds.map(() => 1))
  return { ok: true, splits: userIds.map((userId, i) => ({ userId, amount: amounts[i] ?? 0, weight: null })) }
}

/** Custom split: exact amounts per person that must add up to the total. */
export function splitCustom(total: Money, entries: ReadonlyArray<{ userId: UserId; amount: Money }>): SplitResult {
  const invalid = checkCommon(
    total,
    entries.map((e) => e.userId),
  )
  if (invalid) return invalid
  let sum = 0
  for (const entry of entries) {
    if (!isMoney(entry.amount) || entry.amount < 0) {
      return fail('INVALID_VALUE', 'Each amount must be zero or more.', entry.userId)
    }
    sum += entry.amount
  }
  if (sum !== total) {
    return fail('TOTAL_MISMATCH', 'The amounts must add up to the total.')
  }
  return { ok: true, splits: entries.map((e) => ({ userId: e.userId, amount: e.amount, weight: null })) }
}

/** Percentage split. `basisPoints` per person (50% = 5000) must sum to exactly 10000. */
export function splitByPercentage(
  total: Money,
  entries: ReadonlyArray<{ userId: UserId; basisPoints: number }>,
): SplitResult {
  const invalid = checkCommon(
    total,
    entries.map((e) => e.userId),
  )
  if (invalid) return invalid
  let sum = 0
  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.basisPoints) || entry.basisPoints < 0) {
      return fail('INVALID_VALUE', 'Each percentage must be zero or more.', entry.userId)
    }
    sum += entry.basisPoints
  }
  if (sum !== FULL_PERCENT_BP) {
    return fail('PERCENT_MISMATCH', 'Percentages must add up to 100%.')
  }
  const amounts = allocateByWeights(
    total,
    entries.map((e) => e.basisPoints),
  )
  return {
    ok: true,
    splits: entries.map((e, i) => ({ userId: e.userId, amount: amounts[i] ?? 0, weight: e.basisPoints / 100 })),
  }
}

/** Shares split. `scaledShares` = shares × 100 (so 1.5 shares = 150). Every share must be > 0. */
export function splitByShares(
  total: Money,
  entries: ReadonlyArray<{ userId: UserId; scaledShares: number }>,
): SplitResult {
  const invalid = checkCommon(
    total,
    entries.map((e) => e.userId),
  )
  if (invalid) return invalid
  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.scaledShares) || entry.scaledShares <= 0) {
      return fail('SHARES_NOT_POSITIVE', 'Each person needs at least some shares.', entry.userId)
    }
  }
  const amounts = allocateByWeights(
    total,
    entries.map((e) => e.scaledShares),
  )
  return {
    ok: true,
    splits: entries.map((e, i) => ({ userId: e.userId, amount: amounts[i] ?? 0, weight: e.scaledShares / SHARE_SCALE })),
  }
}

/** Parse "33.33" (percent) into basis points. */
export function parsePercentage(input: string): number | null {
  const value = parseScaledDecimal(input.replace(/%$/, ''), 2)
  return value !== null && value <= FULL_PERCENT_BP ? value : null
}

/** Parse "1.5" (shares) into scaled shares (150). */
export function parseShares(input: string): number | null {
  const value = parseScaledDecimal(input, 2)
  return value !== null && value <= 1_000_000 ? value : null
}

/** Form-level input: raw strings exactly as the user typed them. */
export interface SplitFormInput {
  type: SplitType
  total: Money
  participants: ReadonlyArray<{ userId: UserId; value?: string }>
}

/**
 * Compute splits from raw form values. This is the single entry point the UI
 * uses, so the preview the user sees is exactly what gets saved.
 */
export function computeSplit(input: SplitFormInput): SplitResult {
  const { type, total, participants } = input
  switch (type) {
    case 'equal':
      return splitEqual(
        total,
        participants.map((p) => p.userId),
      )
    case 'custom': {
      const entries: { userId: UserId; amount: Money }[] = []
      for (const p of participants) {
        const amount = p.value?.trim() ? parseMoney(p.value) : 0
        if (amount === null) return fail('INVALID_VALUE', 'Enter a valid amount.', p.userId)
        entries.push({ userId: p.userId, amount })
      }
      return splitCustom(total, entries)
    }
    case 'percentage': {
      const entries: { userId: UserId; basisPoints: number }[] = []
      for (const p of participants) {
        const bp = p.value?.trim() ? parsePercentage(p.value) : 0
        if (bp === null) return fail('INVALID_VALUE', 'Enter a percentage between 0 and 100.', p.userId)
        entries.push({ userId: p.userId, basisPoints: bp })
      }
      return splitByPercentage(total, entries)
    }
    case 'shares': {
      const entries: { userId: UserId; scaledShares: number }[] = []
      for (const p of participants) {
        const shares = p.value?.trim() ? parseShares(p.value) : null
        if (shares === null) return fail('SHARES_NOT_POSITIVE', 'Enter a number of shares.', p.userId)
        entries.push({ userId: p.userId, scaledShares: shares })
      }
      return splitByShares(total, entries)
    }
  }
}
