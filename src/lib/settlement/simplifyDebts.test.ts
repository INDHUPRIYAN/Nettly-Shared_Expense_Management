import { describe, expect, it } from 'vitest'
import { calculateBalances } from './calculateBalances'
import { personalSummary, simplifyDebts } from './simplifyDebts'
import type { LedgerSettlement, Transfer } from './types'

const nets = (entries: Record<string, number>) => Object.entries(entries).map(([userId, net]) => ({ userId, net }))

/** Apply transfers as paid settlements and return the resulting nets. */
function applyTransfers(balances: { userId: string; net: number }[], transfers: Transfer[]) {
  const result = new Map(balances.map((b) => [b.userId, b.net]))
  for (const t of transfers) {
    result.set(t.from, (result.get(t.from) ?? 0) + t.amount)
    result.set(t.to, (result.get(t.to) ?? 0) - t.amount)
  }
  return result
}

function expectFullySettles(balances: { userId: string; net: number }[], transfers: Transfer[]) {
  for (const t of transfers) {
    expect(Number.isSafeInteger(t.amount)).toBe(true)
    expect(t.amount).toBeGreaterThan(0)
    expect(t.from).not.toBe(t.to)
  }
  for (const [, net] of applyTransfers(balances, transfers)) expect(net).toBe(0)
}

describe('simplifyDebts', () => {
  it('returns no payments when everyone is settled', () => {
    expect(simplifyDebts(nets({ a: 0, b: 0, c: 0 }))).toEqual([])
    expect(simplifyDebts([])).toEqual([])
  })

  it('a circular debt (A→B→C→A ₹500) needs no payment', () => {
    // A owes B 500, B owes C 500, C owes A 500: every net is zero.
    const balances = calculateBalances(
      ['A', 'B', 'C'],
      [
        { paidBy: 'B', amount: 500, splits: [{ userId: 'A', amount: 500 }] },
        { paidBy: 'C', amount: 500, splits: [{ userId: 'B', amount: 500 }] },
        { paidBy: 'A', amount: 500, splits: [{ userId: 'C', amount: 500 }] },
      ],
    )
    expect(balances.map((b) => b.net)).toEqual([0, 0, 0])
    expect(simplifyDebts(balances)).toEqual([])
  })

  it('matches the documented example: A +2500, B -1500, C +500, D -1500', () => {
    const balances = nets({ A: 2500, B: -1500, C: 500, D: -1500 })
    const transfers = simplifyDebts(balances)
    expect(transfers).toEqual([
      { from: 'B', to: 'A', amount: 1500 },
      { from: 'D', to: 'A', amount: 1000 },
      { from: 'D', to: 'C', amount: 500 },
    ])
    expectFullySettles(balances, transfers)
  })

  it('pairs exact matches first to avoid extra payments', () => {
    const balances = nets({ a: 700, b: 300, c: -300, d: -700 })
    const transfers = simplifyDebts(balances)
    expect(transfers).toEqual([
      { from: 'd', to: 'a', amount: 700 },
      { from: 'c', to: 'b', amount: 300 },
    ])
  })

  it('one creditor, many debtors', () => {
    const balances = nets({ a: 3000, b: -1000, c: -1000, d: -1000 })
    const transfers = simplifyDebts(balances)
    expect(transfers).toHaveLength(3)
    expect(transfers.every((t) => t.to === 'a' && t.amount === 1000)).toBe(true)
  })

  it('is deterministic regardless of input order', () => {
    const a = simplifyDebts(nets({ a: 2500, b: -1500, c: 500, d: -1500 }))
    const b = simplifyDebts(nets({ d: -1500, c: 500, b: -1500, a: 2500 }))
    expect(a).toEqual(b)
  })

  it('rejects balances that do not sum to zero', () => {
    expect(() => simplifyDebts(nets({ a: 100, b: -50 }))).toThrow(RangeError)
  })

  it('never creates or loses money and uses at most n-1 payments (randomised)', () => {
    let seed = 7
    const random = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    for (let run = 0; run < 500; run++) {
      const n = 2 + Math.floor(random() * 18)
      const values = Array.from({ length: n - 1 }, () => Math.floor(random() * 2_000_001) - 1_000_000)
      values.push(-values.reduce((s, v) => s + v, 0))
      const balances = values.map((net, i) => ({ userId: `u${String(i).padStart(2, '0')}`, net }))
      const transfers = simplifyDebts(balances)
      expectFullySettles(balances, transfers)
      const nonZero = balances.filter((b) => b.net !== 0).length
      expect(transfers.length).toBeLessThanOrEqual(Math.max(0, nonZero - 1))
      // Debtors only pay, creditors only receive.
      for (const t of transfers) {
        expect(balances.find((b) => b.userId === t.from)!.net).toBeLessThan(0)
        expect(balances.find((b) => b.userId === t.to)!.net).toBeGreaterThan(0)
      }
    }
  })

  it('suggestions after a partial settlement cover only what is left', () => {
    const expenses = [{ paidBy: 'a', amount: 1000, splits: [{ userId: 'a', amount: 500 }, { userId: 'b', amount: 500 }] }]
    const settlements: LedgerSettlement[] = [{ fromUser: 'b', toUser: 'a', amount: 200, status: 'paid' }]
    const transfers = simplifyDebts(calculateBalances(['a', 'b'], expenses, settlements))
    expect(transfers).toEqual([{ from: 'b', to: 'a', amount: 300 }])
  })
})

describe('personalSummary', () => {
  it('splits transfers into what I owe and what I receive', () => {
    const balances = nets({ A: 2500, B: -1500, C: 500, D: -1500 })
    const transfers = simplifyDebts(balances)
    expect(personalSummary('D', balances, transfers)).toEqual({
      net: -1500,
      owes: [
        { from: 'D', to: 'A', amount: 1000 },
        { from: 'D', to: 'C', amount: 500 },
      ],
      receives: [],
    })
    expect(personalSummary('A', balances, transfers).receives).toHaveLength(2)
    expect(personalSummary('nobody', balances, transfers)).toEqual({ net: 0, owes: [], receives: [] })
  })
})
