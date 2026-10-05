import { describe, expect, it } from 'vitest'
import { LedgerIntegrityError, balanceState, calculateBalances, totalSpent } from './calculateBalances'
import { splitEqual } from './splitAmount'
import type { LedgerExpense } from './types'

const equalExpense = (paidBy: string, amount: number, participants: string[]): LedgerExpense => {
  const result = splitEqual(amount, participants)
  if (!result.ok) throw new Error(result.error.message)
  return { paidBy, amount, splits: result.splits }
}
const byUser = (balances: ReturnType<typeof calculateBalances>) =>
  Object.fromEntries(balances.map((b) => [b.userId, b]))

describe('calculateBalances', () => {
  it('net = paid - share for a single expense', () => {
    const balances = byUser(calculateBalances(['a', 'b'], [equalExpense('a', 5000, ['a', 'b'])]))
    expect(balances.a).toMatchObject({ paid: 5000, share: 2500, net: 2500 })
    expect(balances.b).toMatchObject({ paid: 0, share: 2500, net: -2500 })
  })

  it('a person who pays but is not included gets the full amount back', () => {
    const balances = byUser(calculateBalances(['a', 'b', 'c'], [equalExpense('a', 900, ['b', 'c'])]))
    expect(balances.a).toMatchObject({ paid: 900, share: 0, net: 900 })
    expect(balances.b?.net).toBe(-450)
    expect(balances.c?.net).toBe(-450)
  })

  it('a person included who paid nothing owes their share', () => {
    const balances = byUser(calculateBalances(['a', 'b'], [equalExpense('a', 1000, ['a', 'b'])]))
    expect(balances.b).toMatchObject({ paid: 0, share: 500, net: -500 })
  })

  it('an excluded member owes nothing for that expense', () => {
    const balances = byUser(
      calculateBalances(['a', 'b', 'c', 'd'], [equalExpense('a', 1200, ['a', 'b', 'c'])]),
    )
    expect(balances.d).toMatchObject({ paid: 0, share: 0, net: 0 })
    expect(balanceState(balances.d!.net)).toBe('settled')
  })

  it('handles zero, positive and negative balances', () => {
    const balances = byUser(
      calculateBalances(
        ['a', 'b', 'c'],
        [equalExpense('a', 300, ['a', 'b', 'c']), equalExpense('b', 300, ['a', 'b', 'c'])],
      ),
    )
    expect(balances.a?.net).toBe(100)
    expect(balances.b?.net).toBe(100)
    expect(balances.c?.net).toBe(-200)
    expect(balanceState(100)).toBe('receive')
    expect(balanceState(-200)).toBe('owe')
  })

  it('a paid settlement moves both balances toward zero (complete settlement)', () => {
    const balances = byUser(
      calculateBalances(
        ['a', 'b'],
        [equalExpense('a', 1000, ['a', 'b'])],
        [{ fromUser: 'b', toUser: 'a', amount: 500, status: 'paid' }],
      ),
    )
    expect(balances.a).toMatchObject({ received: 500, net: 0 })
    expect(balances.b).toMatchObject({ sent: 500, net: 0 })
  })

  it('a partial settlement leaves the remainder outstanding', () => {
    const balances = byUser(
      calculateBalances(
        ['a', 'b'],
        [equalExpense('a', 1000, ['a', 'b'])],
        [{ fromUser: 'b', toUser: 'a', amount: 200, status: 'paid' }],
      ),
    )
    expect(balances.a?.net).toBe(300)
    expect(balances.b?.net).toBe(-300)
  })

  it('ignores pending and cancelled settlements', () => {
    const balances = byUser(
      calculateBalances(
        ['a', 'b'],
        [equalExpense('a', 1000, ['a', 'b'])],
        [
          { fromUser: 'b', toUser: 'a', amount: 500, status: 'pending' },
          { fromUser: 'b', toUser: 'a', amount: 500, status: 'cancelled' },
        ],
      ),
    )
    expect(balances.b?.net).toBe(-500)
  })

  it('includes people found in records but not in the member list (former members), after members', () => {
    const balances = calculateBalances(['b', 'a'], [equalExpense('z', 300, ['a', 'z', 'y'])])
    expect(balances.map((b) => b.userId)).toEqual(['b', 'a', 'y', 'z'])
  })

  it('throws when splits do not add up (corrupted data)', () => {
    expect(() =>
      calculateBalances(['a'], [{ paidBy: 'a', amount: 100, splits: [{ userId: 'a', amount: 99 }] }]),
    ).toThrow(LedgerIntegrityError)
  })

  it('totalSpent sums expense amounts', () => {
    expect(totalSpent([{ amount: 100 }, { amount: 250 }])).toBe(350)
    expect(totalSpent([])).toBe(0)
  })

  it('net balances always sum to zero for random ledgers', () => {
    let seed = 42
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }
    const members = ['a', 'b', 'c', 'd', 'e', 'f']
    for (let run = 0; run < 200; run++) {
      const expenses: LedgerExpense[] = []
      for (let i = 0; i < 15; i++) {
        const participants = members.filter(() => random() > 0.4)
        if (participants.length === 0) continue
        const payer = members[Math.floor(random() * members.length)] as string
        expenses.push(equalExpense(payer, 1 + Math.floor(random() * 1_000_000), participants))
      }
      const balances = calculateBalances(members, expenses)
      expect(balances.reduce((sum, b) => sum + b.net, 0)).toBe(0)
      expect(balances.reduce((sum, b) => sum + b.share, 0)).toBe(totalSpent(expenses))
    }
  })
})
