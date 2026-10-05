/**
 * Acceptance scenarios for the settlement engine.
 *
 * Scenario 1 is the specification's acceptance test (A/B/C/D: Hotel, Dinner,
 * Taxi). Note: the spec lists "A share = 1000 + 300 + 0", but A is one of the
 * three Taxi participants, so A's share is 1000 + 300 + 300 = 1600. With the
 * spec's figure the shares would sum to ₹5,500 instead of the ₹6,100 spent,
 * violating its own "sum(all shares) = total expenses" requirement.
 */
import { describe, expect, it } from 'vitest'
import { calculateBalances, totalSpent } from './calculateBalances'
import { personalSummary, simplifyDebts } from './simplifyDebts'
import { computeSplit, splitEqual } from './splitAmount'
import type { LedgerExpense, LedgerSettlement } from './types'

const R = (rupees: number) => rupees * 100

function expense(paidBy: string, amount: number, participants: string[]): LedgerExpense {
  const result = splitEqual(amount, participants)
  if (!result.ok) throw new Error(result.error.message)
  return { paidBy, amount, splits: result.splits }
}

describe('Acceptance: A, B, C, D', () => {
  const members = ['A', 'B', 'C', 'D']
  const expenses = [
    expense('A', R(4000), ['A', 'B', 'C', 'D']), // Hotel, split equally
    expense('B', R(1200), ['A', 'B', 'C', 'D']), // Dinner, split equally
    expense('C', R(900), ['A', 'C', 'D']), // Taxi, only A, C, D
  ]
  const balances = calculateBalances(members, expenses)
  const by = Object.fromEntries(balances.map((b) => [b.userId, b]))

  it('computes each share', () => {
    expect(by.A?.share).toBe(R(1000 + 300 + 300))
    expect(by.B?.share).toBe(R(1000 + 300))
    expect(by.C?.share).toBe(R(1000 + 300 + 300))
    expect(by.D?.share).toBe(R(1000 + 300 + 300))
  })

  it('sum of all shares equals total expenses', () => {
    expect(totalSpent(expenses)).toBe(R(6100))
    expect(balances.reduce((s, b) => s + b.share, 0)).toBe(R(6100))
  })

  it('computes balances', () => {
    expect(by.A).toMatchObject({ paid: R(4000), net: R(2400) })
    expect(by.B).toMatchObject({ paid: R(1200), net: R(-100) })
    expect(by.C).toMatchObject({ paid: R(900), net: R(-700) })
    expect(by.D).toMatchObject({ paid: 0, net: R(-1600) })
    expect(balances.reduce((s, b) => s + b.net, 0)).toBe(0)
  })

  it('suggests minimal settlements', () => {
    expect(simplifyDebts(balances)).toEqual([
      { from: 'D', to: 'A', amount: R(1600) },
      { from: 'C', to: 'A', amount: R(700) },
      { from: 'B', to: 'A', amount: R(100) },
    ])
  })

  it('everyone is settled after the suggested payments are marked paid', () => {
    const settlements: LedgerSettlement[] = simplifyDebts(balances).map((t) => ({
      fromUser: t.from,
      toUser: t.to,
      amount: t.amount,
      status: 'paid',
    }))
    const after = calculateBalances(members, expenses, settlements)
    expect(after.every((b) => b.net === 0)).toBe(true)
    expect(simplifyDebts(after)).toEqual([])
  })
})

describe('Acceptance: Delhi Trip 2026 (mixed split types)', () => {
  const [indhu, nandha, karthik, arun] = ['indhu', 'nandha', 'karthik', 'arun']
  const members = [indhu, nandha, karthik, arun]

  const build = (paidBy: string, amount: number, input: Parameters<typeof computeSplit>[0]): LedgerExpense => {
    const result = computeSplit(input)
    if (!result.ok) throw new Error(result.error.message)
    return { paidBy, amount, splits: result.splits }
  }

  const expenses: LedgerExpense[] = [
    // Train tickets ₹8,000 paid by Indhu, equal among all
    build(indhu, R(8000), { type: 'equal', total: R(8000), participants: members.map((userId) => ({ userId })) }),
    // Hotel ₹6,500 paid by Karthik, shares 2:1:1:1 (Indhu had a bigger room)
    build(karthik, R(6500), {
      type: 'shares',
      total: R(6500),
      participants: [
        { userId: indhu, value: '2' },
        { userId: nandha, value: '1' },
        { userId: karthik, value: '1' },
        { userId: arun, value: '1' },
      ],
    }),
    // Dinner ₹1,200 paid by Nandha, Arun skipped it
    build(nandha, R(1200), {
      type: 'equal',
      total: R(1200),
      participants: [indhu, nandha, karthik].map((userId) => ({ userId })),
    }),
    // Shopping ₹2,000.50 paid by Arun, custom amounts
    build(arun, 200050, {
      type: 'custom',
      total: 200050,
      participants: [
        { userId: arun, value: '1500.50' },
        { userId: indhu, value: '500' },
      ],
    }),
    // Metro ₹333 paid by Indhu, percentages
    build(indhu, R(333), {
      type: 'percentage',
      total: R(333),
      participants: [
        { userId: indhu, value: '25' },
        { userId: nandha, value: '25' },
        { userId: karthik, value: '25' },
        { userId: arun, value: '25' },
      ],
    }),
  ]

  it('balances, settles and conserves money end to end', () => {
    const balances = calculateBalances(members, expenses)
    expect(balances.reduce((s, b) => s + b.share, 0)).toBe(totalSpent(expenses))
    expect(balances.reduce((s, b) => s + b.net, 0)).toBe(0)

    const transfers = simplifyDebts(balances)
    expect(transfers.length).toBeLessThanOrEqual(3)

    // Indhu sees exactly what to collect or pay.
    const mine = personalSummary(indhu, balances, transfers)
    const collect = mine.receives.reduce((s, t) => s + t.amount, 0)
    const pay = mine.owes.reduce((s, t) => s + t.amount, 0)
    expect(collect - pay).toBe(mine.net)

    // Pay one suggestion partially, the rest fully; everyone ends at zero.
    const [first, ...rest] = transfers
    const settlements: LedgerSettlement[] = []
    if (first) {
      const part = Math.floor(first.amount / 2)
      settlements.push({ fromUser: first.from, toUser: first.to, amount: part, status: 'paid' })
      const next = simplifyDebts(calculateBalances(members, expenses, settlements))
      expect(next.find((t) => t.from === first.from && t.to === first.to)?.amount).toBe(first.amount - part)
      settlements.push({ fromUser: first.from, toUser: first.to, amount: first.amount - part, status: 'paid' })
    }
    for (const t of rest) settlements.push({ fromUser: t.from, toUser: t.to, amount: t.amount, status: 'paid' })
    expect(calculateBalances(members, expenses, settlements).every((b) => b.net === 0)).toBe(true)
  })
})
