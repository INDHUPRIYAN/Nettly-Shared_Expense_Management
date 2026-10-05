import { describe, expect, it } from 'vitest'
import {
  MoneyError,
  addMoney,
  formatMoney,
  parseMoney,
  parseScaledDecimal,
  splitMoney,
  subtractMoney,
  toDecimalString,
  toInputString,
} from './money'

describe('parseMoney', () => {
  it.each([
    ['100', 10000],
    ['100.5', 10050],
    ['100.50', 10050],
    ['0.01', 1],
    ['.5', 50],
    ['1,200', 120000],
    ['1,00,000.75', 10000075],
    ['₹1200', 120000],
    ['  42  ', 4200],
    ['0', 0],
  ])('parses %s -> %d', (input, expected) => {
    expect(parseMoney(input)).toBe(expected)
  })

  it.each(['', ' ', 'abc', '-5', '1.234', '1e5', '1.2.3', '12a', '.', 'NaN', 'Infinity'])('rejects %j', (input) => {
    expect(parseMoney(input)).toBeNull()
  })

  it('avoids floating point drift (0.1 + 0.2 style inputs)', () => {
    expect(parseMoney('0.29')).toBe(29) // 0.29 * 100 = 28.999999999999996 in floats
    expect(parseMoney('1.15')).toBe(115)
    expect(addMoney(parseMoney('0.1')!, parseMoney('0.2')!)).toBe(30)
  })

  it('rejects amounts beyond safe integer range', () => {
    expect(parseMoney('999999999999999999')).toBeNull()
  })
})

describe('parseScaledDecimal', () => {
  it('scales by the requested precision', () => {
    expect(parseScaledDecimal('33.33', 2)).toBe(3333)
    expect(parseScaledDecimal('2', 2)).toBe(200)
    expect(parseScaledDecimal('1.5', 2)).toBe(150)
    expect(parseScaledDecimal('1.555', 2)).toBeNull()
  })
})

describe('formatMoney', () => {
  it('formats INR with Indian grouping and hides .00', () => {
    expect(formatMoney(120000, 'INR')).toBe('₹1,200')
    expect(formatMoney(10050, 'INR')).toBe('₹100.50')
    expect(formatMoney(10000000, 'INR')).toBe('₹1,00,000')
    expect(formatMoney(1, 'INR')).toBe('₹0.01')
    expect(formatMoney(0, 'INR')).toBe('₹0')
  })

  it('can always show decimals', () => {
    expect(formatMoney(120000, 'INR', { trimZeroDecimals: false })).toBe('₹1,200.00')
  })

  it('formats signed balances', () => {
    expect(formatMoney(245000, 'INR', { signed: true })).toBe('+₹2,450')
    expect(formatMoney(-150000, 'INR', { signed: true })).toBe('-₹1,500')
    expect(formatMoney(0, 'INR', { signed: true })).toBe('₹0')
    expect(formatMoney(-5, 'INR')).toBe('-₹0.05')
  })

  it('formats other currencies', () => {
    expect(formatMoney(123456, 'USD')).toBe('$1,234.56')
    expect(formatMoney(100, 'EUR')).toBe('€1')
  })

  it('formats huge values exactly', () => {
    expect(formatMoney(100_000_000_000 - 1, 'INR')).toBe('₹99,99,99,999.99')
  })

  it('refuses non-integer amounts', () => {
    expect(() => formatMoney(10.5, 'INR')).toThrow(MoneyError)
  })
})

describe('arithmetic helpers', () => {
  it('adds and subtracts integers', () => {
    expect(addMoney(100, 250, 1)).toBe(351)
    expect(subtractMoney(100, 250)).toBe(-150)
  })

  it('rejects floats', () => {
    expect(() => addMoney(0.1, 0.2)).toThrow(MoneyError)
  })

  it('splitMoney never loses minor units', () => {
    expect(splitMoney(100, 3)).toEqual([33, 33, 34])
    expect(splitMoney(1000, 4)).toEqual([250, 250, 250, 250])
    expect(splitMoney(-100, 3)).toEqual([-33, -33, -34])
    expect(splitMoney(2, 3)).toEqual([0, 1, 1])
  })

  it('converts to decimal / input strings', () => {
    expect(toDecimalString(10050)).toBe('100.50')
    expect(toDecimalString(-7)).toBe('-0.07')
    expect(toInputString(120000)).toBe('1200')
    expect(toInputString(120050)).toBe('1200.50')
  })
})
