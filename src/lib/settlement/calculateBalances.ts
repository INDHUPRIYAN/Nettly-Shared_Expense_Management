import { assertMoney } from './money'
import type { LedgerExpense, LedgerSettlement, MemberBalance, Money, UserId } from './types'

export class LedgerIntegrityError extends Error {
  override name = 'LedgerIntegrityError'
}

/**
 * Compute every member's position from the raw expense and settlement records.
 *
 *   net = paid - share + sent - received
 *
 * Only settlements with status `paid` count. Users who appear in the records
 * but are not in `memberIds` (e.g. former members) are included after the
 * listed members, sorted by id, so the output order is always deterministic.
 *
 * Throws LedgerIntegrityError if an expense's splits do not add up to its
 * amount — the database prevents this, so it indicates corrupted input.
 */
export function calculateBalances(
  memberIds: readonly UserId[],
  expenses: readonly LedgerExpense[],
  settlements: readonly LedgerSettlement[] = [],
): MemberBalance[] {
  const balances = new Map<UserId, MemberBalance>()
  const ensure = (userId: UserId): MemberBalance => {
    let entry = balances.get(userId)
    if (!entry) {
      entry = { userId, paid: 0, share: 0, sent: 0, received: 0, net: 0 }
      balances.set(userId, entry)
    }
    return entry
  }

  for (const id of memberIds) ensure(id)

  for (const expense of expenses) {
    assertMoney(expense.amount, 'expense amount')
    let splitTotal: Money = 0
    for (const split of expense.splits) {
      assertMoney(split.amount, 'split amount')
      splitTotal += split.amount
      ensure(split.userId).share += split.amount
    }
    if (splitTotal !== expense.amount) {
      throw new LedgerIntegrityError(
        `Expense ${expense.id ?? '(unsaved)'} splits total ${splitTotal} but amount is ${expense.amount}`,
      )
    }
    ensure(expense.paidBy).paid += expense.amount
  }

  for (const settlement of settlements) {
    if (settlement.status !== 'paid') continue
    assertMoney(settlement.amount, 'settlement amount')
    ensure(settlement.fromUser).sent += settlement.amount
    ensure(settlement.toUser).received += settlement.amount
  }

  const memberSet = new Set(memberIds)
  const extras = [...balances.keys()].filter((id) => !memberSet.has(id)).sort()
  const ordered = [...memberIds.filter((id, i) => memberIds.indexOf(id) === i), ...extras]

  let netSum = 0
  const result = ordered.map((id) => {
    const b = balances.get(id) as MemberBalance
    b.net = b.paid - b.share + b.sent - b.received
    assertMoney(b.net, 'net balance')
    netSum += b.net
    return b
  })

  if (netSum !== 0) {
    // Mathematically impossible when every expense balances; kept as a guard.
    throw new LedgerIntegrityError(`Balances do not sum to zero (${netSum})`)
  }
  return result
}

/** Total of all expense amounts. */
export function totalSpent(expenses: readonly Pick<LedgerExpense, 'amount'>[]): Money {
  let total = 0
  for (const e of expenses) {
    assertMoney(e.amount)
    total += e.amount
  }
  return total
}

export type BalanceState = 'receive' | 'owe' | 'settled'

export function balanceState(net: Money): BalanceState {
  if (net > 0) return 'receive'
  if (net < 0) return 'owe'
  return 'settled'
}
