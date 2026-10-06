import { describe, expect, it } from 'vitest'
import {
  expenseDetailsSchema,
  fieldErrors,
  groupSchema,
  loginSchema,
  moneyInputSchema,
  settlementSchema,
  signupSchema,
} from './index'

describe('signupSchema', () => {
  it('accepts valid input and normalises email', () => {
    const result = signupSchema.parse({ name: '  Indhu ', email: ' Indhu@Example.COM ', password: 'longenough' })
    expect(result).toEqual({ name: 'Indhu', email: 'indhu@example.com', password: 'longenough' })
  })

  it('reports each invalid field', () => {
    const result = signupSchema.safeParse({ name: ' ', email: 'nope', password: 'short' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(Object.keys(fieldErrors(result.error)).sort()).toEqual(['email', 'name', 'password'])
    }
  })
})

describe('loginSchema', () => {
  it('requires a password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false)
  })
})

describe('groupSchema', () => {
  it('trims and converts empty description to null', () => {
    expect(groupSchema.parse({ name: ' Delhi Trip 2026 ', description: '  ', currency: 'INR' })).toEqual({
      name: 'Delhi Trip 2026',
      description: null,
      currency: 'INR',
    })
  })

  it('rejects empty names and unsupported currencies', () => {
    expect(groupSchema.safeParse({ name: '', description: '', currency: 'INR' }).success).toBe(false)
    expect(groupSchema.safeParse({ name: 'x', description: '', currency: 'JPY' }).success).toBe(false)
  })
})

describe('moneyInputSchema', () => {
  it('parses to integer minor units', () => {
    expect(moneyInputSchema.parse('1,200.50')).toBe(120050)
  })

  it.each(['', '0', '-5', '1.234', 'abc', '99999999999'])('rejects %j', (value) => {
    expect(moneyInputSchema.safeParse(value).success).toBe(false)
  })
})

describe('expenseDetailsSchema', () => {
  const valid = {
    title: 'Dinner',
    description: '',
    amount: '1200',
    paidBy: 'user-1',
    category: 'food',
    splitType: 'equal',
    expenseDate: '2026-10-08',
  }

  it('accepts a valid expense', () => {
    expect(expenseDetailsSchema.parse(valid)).toMatchObject({ title: 'Dinner', amount: 120000, description: null })
  })

  it('requires a title, a positive amount, a payer and a valid category', () => {
    const result = expenseDetailsSchema.safeParse({ ...valid, title: ' ', amount: '0', paidBy: '', category: 'x' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(Object.keys(fieldErrors(result.error)).sort()).toEqual(['amount', 'category', 'paidBy', 'title'])
    }
  })
})

describe('settlementSchema', () => {
  it('rejects self payments and non-positive amounts', () => {
    expect(settlementSchema.safeParse({ fromUser: 'a', toUser: 'a', amount: 100, note: '' }).success).toBe(false)
    expect(settlementSchema.safeParse({ fromUser: 'a', toUser: 'b', amount: 0, note: '' }).success).toBe(false)
    expect(settlementSchema.safeParse({ fromUser: 'a', toUser: 'b', amount: 10.5, note: '' }).success).toBe(false)
    expect(settlementSchema.parse({ fromUser: 'a', toUser: 'b', amount: 100, note: ' ' })).toMatchObject({ note: null })
  })
})
