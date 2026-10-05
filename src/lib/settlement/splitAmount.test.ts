import { describe, expect, it } from 'vitest'
import {
  allocateByWeights,
  computeSplit,
  parsePercentage,
  parseShares,
  splitByPercentage,
  splitByShares,
  splitCustom,
  splitEqual,
  type SplitResult,
} from './splitAmount'

const rupees = (n: number) => n * 100
const amounts = (result: SplitResult) => {
  if (!result.ok) throw new Error(`expected ok, got ${result.error.code}`)
  return result.splits.map((s) => s.amount)
}
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

describe('allocateByWeights', () => {
  it('distributes the remainder by largest fractional part, ties to later entries', () => {
    expect(allocateByWeights(100, [1, 1, 1])).toEqual([33, 33, 34])
    expect(allocateByWeights(101, [1, 1, 1])).toEqual([33, 34, 34])
    expect(allocateByWeights(10, [1, 2])).toEqual([3, 7])
  })

  it('gives nothing to zero weights', () => {
    expect(allocateByWeights(5, [0, 1, 0])).toEqual([0, 5, 0])
  })

  it('handles totals whose product with weights exceeds 2^53', () => {
    const total = 99_999_999_999
    const result = allocateByWeights(total, [3333, 3333, 3334])
    expect(sum(result)).toBe(total)
  })

  it('rejects invalid weights', () => {
    expect(() => allocateByWeights(100, [])).toThrow()
    expect(() => allocateByWeights(100, [0, 0])).toThrow()
    expect(() => allocateByWeights(100, [1.5])).toThrow()
    expect(() => allocateByWeights(100, [-1, 2])).toThrow()
  })
})

describe('splitEqual', () => {
  it('₹1000 / 4 = ₹250 each', () => {
    expect(amounts(splitEqual(rupees(1000), ['a', 'b', 'c', 'd']))).toEqual([25000, 25000, 25000, 25000])
  })

  it('₹100 / 3 (whole units) = 33, 33, 34', () => {
    expect(amounts(splitEqual(100, ['a', 'b', 'c']))).toEqual([33, 33, 34])
  })

  it('₹100 / 3 in paise = ₹33.33, ₹33.33, ₹33.34', () => {
    const result = amounts(splitEqual(rupees(100), ['a', 'b', 'c']))
    expect(result).toEqual([3333, 3333, 3334])
    expect(sum(result)).toBe(rupees(100))
  })

  it('splitting with one person gives them everything', () => {
    expect(amounts(splitEqual(999, ['a']))).toEqual([999])
  })

  it('validates input', () => {
    expect(splitEqual(0, ['a'])).toMatchObject({ ok: false, error: { code: 'INVALID_TOTAL' } })
    expect(splitEqual(-5, ['a'])).toMatchObject({ ok: false, error: { code: 'INVALID_TOTAL' } })
    expect(splitEqual(10.5, ['a'])).toMatchObject({ ok: false, error: { code: 'INVALID_TOTAL' } })
    expect(splitEqual(100, [])).toMatchObject({ ok: false, error: { code: 'NO_PARTICIPANTS' } })
    expect(splitEqual(100, ['a', 'a'])).toMatchObject({ ok: false, error: { code: 'DUPLICATE_PARTICIPANT' } })
  })

  it('never loses or creates money across many totals and group sizes', () => {
    for (let total = 1; total <= 2000; total += 7) {
      for (let n = 1; n <= 12; n++) {
        const ids = Array.from({ length: n }, (_, i) => `u${i}`)
        const result = amounts(splitEqual(total, ids))
        expect(sum(result)).toBe(total)
        expect(Math.max(...result) - Math.min(...result)).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('splitCustom', () => {
  it('accepts 400 + 300 + 200 + 100 = 1000', () => {
    const result = splitCustom(rupees(1000), [
      { userId: 'a', amount: rupees(400) },
      { userId: 'b', amount: rupees(300) },
      { userId: 'c', amount: rupees(200) },
      { userId: 'd', amount: rupees(100) },
    ])
    expect(amounts(result)).toEqual([40000, 30000, 20000, 10000])
  })

  it('rejects totals that do not match', () => {
    const result = splitCustom(rupees(1000), [
      { userId: 'a', amount: rupees(400) },
      { userId: 'b', amount: rupees(300) },
    ])
    expect(result).toMatchObject({ ok: false, error: { code: 'TOTAL_MISMATCH' } })
  })

  it('rejects negative or fractional amounts', () => {
    expect(splitCustom(100, [{ userId: 'a', amount: -1 }])).toMatchObject({ ok: false, error: { code: 'INVALID_VALUE' } })
    expect(splitCustom(100, [{ userId: 'a', amount: 99.5 }])).toMatchObject({ ok: false, error: { code: 'INVALID_VALUE' } })
  })
})

describe('splitByPercentage', () => {
  it('50 / 20 / 20 / 10 of ₹1000', () => {
    const result = splitByPercentage(rupees(1000), [
      { userId: 'a', basisPoints: 5000 },
      { userId: 'b', basisPoints: 2000 },
      { userId: 'c', basisPoints: 2000 },
      { userId: 'd', basisPoints: 1000 },
    ])
    expect(amounts(result)).toEqual([50000, 20000, 20000, 10000])
    if (result.ok) expect(result.splits.map((s) => s.weight)).toEqual([50, 20, 20, 10])
  })

  it('rounds safely: 33.33 / 33.33 / 33.34 of ₹100.01', () => {
    const result = amounts(
      splitByPercentage(10001, [
        { userId: 'a', basisPoints: 3333 },
        { userId: 'b', basisPoints: 3333 },
        { userId: 'c', basisPoints: 3334 },
      ]),
    )
    expect(sum(result)).toBe(10001)
    expect(result).toEqual([3333, 3333, 3335])
  })

  it('requires exactly 100%', () => {
    const under = splitByPercentage(1000, [
      { userId: 'a', basisPoints: 5000 },
      { userId: 'b', basisPoints: 4999 },
    ])
    expect(under).toMatchObject({ ok: false, error: { code: 'PERCENT_MISMATCH' } })
    const over = splitByPercentage(1000, [
      { userId: 'a', basisPoints: 6000 },
      { userId: 'b', basisPoints: 5000 },
    ])
    expect(over).toMatchObject({ ok: false, error: { code: 'PERCENT_MISMATCH' } })
  })
})

describe('splitByShares', () => {
  it('2 + 1 + 1 + 1 shares of ₹1000 = 400, 200, 200, 200', () => {
    const result = splitByShares(rupees(1000), [
      { userId: 'a', scaledShares: 200 },
      { userId: 'b', scaledShares: 100 },
      { userId: 'c', scaledShares: 100 },
      { userId: 'd', scaledShares: 100 },
    ])
    expect(amounts(result)).toEqual([40000, 20000, 20000, 20000])
  })

  it('supports fractional shares and never loses money', () => {
    const result = amounts(
      splitByShares(1000, [
        { userId: 'a', scaledShares: 150 },
        { userId: 'b', scaledShares: 100 },
        { userId: 'c', scaledShares: 100 },
      ]),
    )
    expect(sum(result)).toBe(1000)
  })

  it('requires positive shares', () => {
    expect(splitByShares(1000, [{ userId: 'a', scaledShares: 0 }])).toMatchObject({
      ok: false,
      error: { code: 'SHARES_NOT_POSITIVE', userId: 'a' },
    })
  })
})

describe('computeSplit (form entry point)', () => {
  it('equal split ignores values', () => {
    const result = computeSplit({ type: 'equal', total: 900, participants: [{ userId: 'a' }, { userId: 'b' }, { userId: 'c' }] })
    expect(amounts(result)).toEqual([300, 300, 300])
  })

  it('parses custom amounts typed by the user', () => {
    const result = computeSplit({
      type: 'custom',
      total: 120000,
      participants: [
        { userId: 'a', value: '700.50' },
        { userId: 'b', value: '499.50' },
      ],
    })
    expect(amounts(result)).toEqual([70050, 49950])
  })

  it('treats empty custom/percentage values as zero', () => {
    const result = computeSplit({
      type: 'percentage',
      total: 1000,
      participants: [
        { userId: 'a', value: '100' },
        { userId: 'b', value: '' },
      ],
    })
    expect(amounts(result)).toEqual([1000, 0])
  })

  it('reports invalid typed values with the participant', () => {
    expect(
      computeSplit({ type: 'custom', total: 1000, participants: [{ userId: 'a', value: 'abc' }] }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_VALUE', userId: 'a' } })
    expect(
      computeSplit({ type: 'shares', total: 1000, participants: [{ userId: 'a', value: '' }] }),
    ).toMatchObject({ ok: false, error: { code: 'SHARES_NOT_POSITIVE', userId: 'a' } })
  })
})

describe('parsers', () => {
  it('parsePercentage', () => {
    expect(parsePercentage('50')).toBe(5000)
    expect(parsePercentage('33.33%')).toBe(3333)
    expect(parsePercentage('100.01')).toBeNull()
    expect(parsePercentage('-1')).toBeNull()
  })

  it('parseShares', () => {
    expect(parseShares('2')).toBe(200)
    expect(parseShares('0.5')).toBe(50)
    expect(parseShares('x')).toBeNull()
  })
})
