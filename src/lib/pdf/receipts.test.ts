import { describe, expect, it } from 'vitest'
import { calculateBalances, simplifyDebts } from '@/lib/settlement'
import type { Expense, Group, Member, Settlement } from '@/types/app'
import {
  buildExpenseReceipt,
  buildGroupReport,
  buildSettlementReceipt,
  expenseReceiptFilename,
  pdfMoney,
} from './receipts'

const group: Group = {
  id: 'g1',
  name: 'Delhi Trip 2026',
  description: null,
  currency: 'INR',
  createdBy: 'a',
  inviteToken: 't',
  inviteCode: 'ABCDEF',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
}
const member = (userId: string, name: string): Member => ({
  userId,
  name,
  nickname: null,
  profileName: name,
  role: 'member',
  joinedAt: '2026-10-01T00:00:00Z',
  removedAt: null,
  isActive: true,
  avatarUrl: null,
})
const members = [member('a', 'Indhu'), member('b', 'Nandha'), member('c', 'Arun')]
const nameOf = (id: string | null | undefined) => members.find((m) => m.userId === id)?.name ?? 'Someone'
const expense: Expense = {
  id: 'e1234567-0000',
  groupId: 'g1',
  title: 'Dinner',
  description: 'Near Connaught Place',
  amount: 120000,
  currency: 'INR',
  paidBy: 'a',
  category: 'food',
  splitType: 'equal',
  expenseDate: '2026-10-02T12:00:00Z',
  createdBy: 'a',
  createdAt: '2026-10-02T12:00:00Z',
  updatedAt: '2026-10-02T12:00:00Z',
  splits: [
    { userId: 'a', amount: 60000, weight: null },
    { userId: 'b', amount: 60000, weight: null },
  ],
}
const settlement: Settlement = {
  id: 's7654321-0000',
  groupId: 'g1',
  fromUser: 'b',
  toUser: 'a',
  amount: 60000,
  status: 'paid',
  note: 'UPI',
  createdBy: 'a',
  paidAt: '2026-10-03T10:00:00Z',
  cancelledAt: null,
  createdAt: '2026-10-03T10:00:00Z',
}
const pdfText = (doc: { output: (type: 'arraybuffer') => ArrayBuffer }) =>
  new TextDecoder('latin1').decode(doc.output('arraybuffer'))

describe('PDF receipts', () => {
  it('writes rupees as "Rs." because PDF base fonts lack the ₹ glyph', () => {
    expect(pdfMoney(120000, 'INR')).toBe('Rs. 1,200.00')
    expect(pdfMoney(-5050, 'INR')).toBe('-Rs. 50.50')
  })

  it('builds an expense receipt with every share and who was left out', () => {
    const text = pdfText(buildExpenseReceipt({ group, members, nameOf }, expense))
    expect(text.startsWith('%PDF')).toBe(true)
    for (const s of ['EXPENSE RECEIPT', 'Delhi Trip 2026', 'Dinner', 'Rs. 1,200.00', 'Rs. 600.00', 'Nandha', 'Arun', 'E1234567']) {
      expect(text).toContain(s)
    }
  })

  it('builds a payment receipt', () => {
    const text = pdfText(buildSettlementReceipt({ group, members, nameOf }, settlement))
    expect(text).toContain('PAYMENT RECEIPT')
    expect(text).toContain('confirmed by receiver')
    expect(text).toContain('UPI')
  })

  it('builds a full group report with member-wise totals', () => {
    const balances = calculateBalances(['a', 'b', 'c'], [expense], [settlement])
    const doc = buildGroupReport({
      group,
      members,
      nameOf,
      expenses: [expense],
      settlements: [settlement],
      balances,
      transfers: simplifyDebts(balances),
      totalSpent: 120000,
    })
    const text = pdfText(doc)
    for (const s of ['GROUP REPORT', 'Member-wise totals', 'Everyone is settled up.', 'Payment history', 'Dinner']) {
      expect(text).toContain(s)
    }
  })

  it('makes safe file names', () => {
    expect(expenseReceiptFilename(group, expense)).toBe('delhi-trip-2026-dinner-receipt.pdf')
  })
})
