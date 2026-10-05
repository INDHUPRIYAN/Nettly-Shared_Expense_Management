import { assertMoney } from './money'
import type { MemberBalance, Money, Transfer, UserId } from './types'

interface Party {
  userId: UserId
  amount: Money
}

/** Larger amount first; ties broken by user id so output is deterministic. */
const byAmountDesc = (a: Party, b: Party) =>
  b.amount - a.amount || (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0)

/**
 * Turn net balances into a short list of payments that settles everyone.
 *
 * 1. Split members into creditors (net > 0) and debtors (net < 0).
 * 2. Pair any debtor and creditor whose amounts match exactly (one payment
 *    clears both people).
 * 3. Repeatedly match the largest remaining debtor with the largest remaining
 *    creditor for min(debt, credit), until everyone is at zero.
 *
 * Guarantees: amounts are positive integers; total paid by each debtor equals
 * their debt and total received by each creditor equals their credit (no
 * money is created or lost); at most (n - 1) payments; same input -> same
 * output. Input balances must sum to zero.
 */
export function simplifyDebts(balances: ReadonlyArray<Pick<MemberBalance, 'userId' | 'net'>>): Transfer[] {
  let sum = 0
  const creditors: Party[] = []
  const debtors: Party[] = []
  for (const { userId, net } of balances) {
    assertMoney(net, 'net balance')
    sum += net
    if (net > 0) creditors.push({ userId, amount: net })
    else if (net < 0) debtors.push({ userId, amount: -net })
  }
  if (sum !== 0) {
    throw new RangeError(`Balances must sum to zero to be settled (got ${sum})`)
  }

  creditors.sort(byAmountDesc)
  debtors.sort(byAmountDesc)

  const transfers: Transfer[] = []

  // Pass 1: exact matches.
  for (const debtor of debtors) {
    const match = creditors.find((c) => c.amount > 0 && c.amount === debtor.amount)
    if (match) {
      transfers.push({ from: debtor.userId, to: match.userId, amount: debtor.amount })
      match.amount = 0
      debtor.amount = 0
    }
  }

  // Pass 2: greedy largest-with-largest.
  const openDebtors = debtors.filter((d) => d.amount > 0)
  const openCreditors = creditors.filter((c) => c.amount > 0)
  while (openDebtors.length > 0 && openCreditors.length > 0) {
    openDebtors.sort(byAmountDesc)
    openCreditors.sort(byAmountDesc)
    const debtor = openDebtors[0] as Party
    const creditor = openCreditors[0] as Party
    const amount = Math.min(debtor.amount, creditor.amount)
    transfers.push({ from: debtor.userId, to: creditor.userId, amount })
    debtor.amount -= amount
    creditor.amount -= amount
    if (debtor.amount === 0) openDebtors.shift()
    if (creditor.amount === 0) openCreditors.shift()
  }

  return transfers
}

export interface PersonalSummary {
  net: Money
  /** Payments this user should make. */
  owes: Transfer[]
  /** Payments this user should receive. */
  receives: Transfer[]
}

/** The current user's view of the suggested settlement plan. */
export function personalSummary(
  userId: UserId,
  balances: ReadonlyArray<Pick<MemberBalance, 'userId' | 'net'>>,
  transfers: readonly Transfer[],
): PersonalSummary {
  return {
    net: balances.find((b) => b.userId === userId)?.net ?? 0,
    owes: transfers.filter((t) => t.from === userId),
    receives: transfers.filter((t) => t.to === userId),
  }
}
