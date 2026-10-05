import type { Money } from './types'

/** Largest amount accepted for a single expense or settlement (1,000,000,000.00). Mirrors the DB check. */
export const MAX_AMOUNT: Money = 100_000_000_000

/** Minor units per major unit. All supported currencies use 2 decimal places. */
export const MINOR_UNITS = 100

export const CURRENCIES = {
  INR: { code: 'INR', symbol: '₹', label: 'Indian Rupee', locale: 'en-IN' },
  USD: { code: 'USD', symbol: '$', label: 'US Dollar', locale: 'en-US' },
  EUR: { code: 'EUR', symbol: '€', label: 'Euro', locale: 'en-IE' },
  GBP: { code: 'GBP', symbol: '£', label: 'British Pound', locale: 'en-GB' },
  AED: { code: 'AED', symbol: 'AED', label: 'UAE Dirham', locale: 'en-AE' },
  SGD: { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar', locale: 'en-SG' },
  AUD: { code: 'AUD', symbol: 'A$', label: 'Australian Dollar', locale: 'en-AU' },
  CAD: { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar', locale: 'en-CA' },
} as const

export type CurrencyCode = keyof typeof CURRENCIES

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[]

export function isCurrencyCode(value: string): value is CurrencyCode {
  return Object.hasOwn(CURRENCIES, value)
}

export class MoneyError extends Error {
  override name = 'MoneyError'
}

/** True when `value` is a valid integer minor-unit amount. */
export function isMoney(value: unknown): value is Money {
  return typeof value === 'number' && Number.isSafeInteger(value)
}

export function assertMoney(value: unknown, label = 'amount'): asserts value is Money {
  if (!isMoney(value)) {
    throw new MoneyError(`${label} must be an integer number of minor units, got ${String(value)}`)
  }
}

/** Sum integer amounts, guarding against unsafe integers. */
export function addMoney(...values: Money[]): Money {
  let total = 0
  for (const value of values) {
    assertMoney(value)
    total += value
  }
  assertMoney(total, 'sum')
  return total
}

export function subtractMoney(a: Money, b: Money): Money {
  assertMoney(a)
  assertMoney(b)
  const result = a - b
  assertMoney(result, 'difference')
  return result
}

export function sumMoney(values: Iterable<Money>): Money {
  return addMoney(...values)
}

/** Split `total` into `parts` integer amounts that sum exactly to `total`. Remainder goes to the last parts. */
export function splitMoney(total: Money, parts: number): Money[] {
  assertMoney(total)
  if (!Number.isSafeInteger(parts) || parts <= 0) {
    throw new MoneyError('parts must be a positive integer')
  }
  const sign = total < 0 ? -1 : 1
  const abs = Math.abs(total)
  const base = (abs - (abs % parts)) / parts
  const remainder = abs % parts
  return Array.from({ length: parts }, (_, i) => sign * (base + (i >= parts - remainder ? 1 : 0)))
}

const formatterCache = new Map<string, Intl.NumberFormat>()

function getFormatter(currency: CurrencyCode, fractionDigits: 0 | 2, signed: boolean): Intl.NumberFormat {
  const key = `${currency}:${fractionDigits}:${signed}`
  let formatter = formatterCache.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(CURRENCIES[currency].locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
      signDisplay: signed ? 'exceptZero' : 'auto',
    })
    formatterCache.set(key, formatter)
  }
  return formatter
}

/** Exact decimal string for an integer minor amount, e.g. 10050 -> "100.50", -5 -> "-0.05". */
export function toDecimalString(amount: Money): string {
  assertMoney(amount)
  const abs = Math.abs(amount)
  const minor = abs % MINOR_UNITS
  const major = (abs - minor) / MINOR_UNITS
  return `${amount < 0 ? '-' : ''}${major}.${String(minor).padStart(2, '0')}`
}

export interface FormatMoneyOptions {
  /** Show "+" for positive amounts (useful for balances). Default false. */
  signed?: boolean
  /** Hide ".00" for whole amounts (₹1,200 instead of ₹1,200.00). Default true. */
  trimZeroDecimals?: boolean
}

/**
 * Format integer minor units for display. 10050 -> "₹100.50", 120000 -> "₹1,200".
 * The value is passed to Intl as an exact decimal string, so no floating-point
 * rounding is involved.
 */
export function formatMoney(amount: Money, currency: string = 'INR', options: FormatMoneyOptions = {}): string {
  assertMoney(amount)
  const { signed = false, trimZeroDecimals = true } = options
  const code: CurrencyCode = isCurrencyCode(currency) ? currency : 'INR'
  const fractionDigits = trimZeroDecimals && amount % MINOR_UNITS === 0 ? 0 : 2
  const decimal = toDecimalString(amount) as Intl.StringNumericLiteral
  return getFormatter(code, fractionDigits, signed).format(decimal)
}

/** Currency symbol for labels and input adornments. */
export function currencySymbol(currency: string): string {
  return isCurrencyCode(currency) ? CURRENCIES[currency].symbol : currency
}

/**
 * Parse a user-entered decimal string into an integer scaled by 10^maxDecimals.
 * parseScaledDecimal("12.5", 2) -> 1250. Returns null for anything invalid
 * (negative, more than `maxDecimals` decimals, exponents, letters, empty).
 */
export function parseScaledDecimal(input: string, maxDecimals: number): number | null {
  const cleaned = input.trim().replace(/[\s,_]/g, '')
  const pattern = new RegExp(`^(\\d*)(?:\\.(\\d{0,${maxDecimals}}))?$`)
  const match = pattern.exec(cleaned)
  if (!match) return null
  const intPart = match[1] ?? ''
  const fracPart = match[2] ?? ''
  if (intPart === '' && fracPart === '') return null
  const scale = 10 ** maxDecimals
  const major = Number(intPart || '0')
  const minor = Number(fracPart.padEnd(maxDecimals, '0') || '0')
  const value = major * scale + minor
  return Number.isSafeInteger(value) ? value : null
}

/**
 * Parse a user-entered money string into minor units.
 * "1,200.50" -> 120050, "₹100" -> 10000, "0.5" -> 50. Returns null when invalid
 * (negative numbers, more than 2 decimals, non-numeric input).
 */
export function parseMoney(input: string): Money | null {
  const withoutCurrency = input.trim().replace(/^(?:[₹$€£]|INR|USD|EUR|GBP|AED|SGD|AUD|CAD|S\$|A\$|C\$)/i, '')
  return parseScaledDecimal(withoutCurrency, 2)
}

/** Convert minor units to an editable input string: 120050 -> "1200.50", 120000 -> "1200". */
export function toInputString(amount: Money): string {
  const decimal = toDecimalString(amount)
  return decimal.endsWith('.00') ? decimal.slice(0, -3) : decimal
}
