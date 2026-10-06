import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { BalanceHero } from '@/components/balances/BalanceViews'
import { BalanceAmount } from '@/components/common/Money'
import { SplitEditor } from '@/components/expenses/SplitEditor'
import { computeSplit, type SplitType } from '@/lib/settlement'
import { defaultValues, type SplitRows } from '@/lib/splitForm'
import { deriveGroupState } from '@/providers/GroupContext'
import type { GroupData, Member } from '@/types/app'

const member = (userId: string, name: string, isActive = true): Member => ({
  userId,
  name,
  role: userId === 'a' ? 'owner' : 'member',
  joinedAt: '2026-10-01T00:00:00Z',
  removedAt: isActive ? null : '2026-10-02T00:00:00Z',
  isActive,
  nickname: null,
  profileName: name,
  avatarUrl: null,
})

describe('BalanceHero', () => {
  it('tells you plainly when you should receive money', () => {
    render(<BalanceHero net={245000} currency="INR" />)
    expect(screen.getByTestId('my-balance')).toHaveTextContent('+₹2,450')
    expect(screen.getByText('You should receive')).toBeInTheDocument()
  })

  it('tells you plainly when you need to pay', () => {
    render(<BalanceHero net={-150000} currency="INR" />)
    expect(screen.getByTestId('my-balance')).toHaveTextContent('-₹1,500')
    expect(screen.getByText('You need to pay')).toBeInTheDocument()
  })

  it('shows settled at zero', () => {
    render(<BalanceHero net={0} currency="INR" />)
    expect(screen.getByText("You're all settled up")).toBeInTheDocument()
  })
})

describe('BalanceAmount', () => {
  it('does not rely on colour alone (has screen-reader text)', () => {
    render(<BalanceAmount net={-5000} currency="INR" />)
    expect(screen.getByText('(owes)')).toBeInTheDocument()
  })
})

function SplitHarness({ type: initialType = 'equal' as SplitType, amount = 120000 }) {
  const members = [member('a', 'Indhu'), member('b', 'Nandha'), member('c', 'Karthik'), member('d', 'Arun')]
  const [type, setType] = useState<SplitType>(initialType)
  const [rows, setRows] = useState<SplitRows>(() =>
    Object.fromEntries(members.map((m) => [m.userId, { included: m.userId !== 'd', value: '' }])),
  )
  const included = members.filter((m) => rows[m.userId]?.included).map((m) => m.userId)
  const result = computeSplit({ type, total: amount, participants: included.map((id) => ({ userId: id, value: rows[id]?.value })) })
  return (
    <SplitEditor
      members={members}
      rows={rows}
      onRowsChange={setRows}
      splitType={type}
      onSplitTypeChange={(t) => {
        setType(t)
        const values = defaultValues(t, included, amount)
        setRows(Object.fromEntries(members.map((m) => [m.userId, { included: rows[m.userId]!.included, value: values[m.userId] ?? '' }])))
      }}
      amount={amount}
      currency="INR"
      result={result}
      currentUserId="a"
    />
  )
}

describe('SplitEditor', () => {
  it('splits equally between selected people only; excluded people owe ₹0', () => {
    render(<SplitHarness />)
    expect(screen.getByText('₹400 each · 3 people')).toBeInTheDocument()
    expect(screen.getByLabelText('Arun not included')).toHaveTextContent('₹0')
    expect(screen.getByLabelText('Indhu owes')).toHaveTextContent('₹400')
  })

  it('including someone re-splits the amount', async () => {
    const user = userEvent.setup()
    render(<SplitHarness />)
    await user.click(screen.getByRole('checkbox', { name: /Arun/ }))
    expect(screen.getByText('₹300 each · 4 people')).toBeInTheDocument()
  })

  it('custom mode shows what is left to assign', async () => {
    const user = userEvent.setup()
    render(<SplitHarness />)
    await user.click(screen.getByRole('radio', { name: 'Custom' }))
    // Pre-filled with an equal split that already adds up.
    expect(screen.getByText('₹1,200 of ₹1,200 assigned')).toBeInTheDocument()
    const input = screen.getByLabelText('Amount for Indhu')
    await user.clear(input)
    await user.type(input, '100')
    expect(screen.getByText('₹300 left to assign')).toBeInTheDocument()
  })

  it('percentage mode starts at 100% and flags mismatches', async () => {
    const user = userEvent.setup()
    render(<SplitHarness />)
    await user.click(screen.getByRole('radio', { name: 'Percent' }))
    expect(screen.getByText('100% assigned')).toBeInTheDocument()
    const input = screen.getByLabelText('Percentage for Nandha')
    await user.clear(input)
    await user.type(input, '10')
    expect(screen.getByText(/% left to assign/)).toBeInTheDocument()
  })
})

describe('deriveGroupState', () => {
  const data: GroupData = {
    group: {
      id: 'g',
      name: 'Delhi Trip 2026',
      description: null,
      currency: 'INR',
      createdBy: 'a',
      inviteToken: 't',
      inviteCode: 'ABCDEF',
      createdAt: '',
      updatedAt: '',
    },
    members: [member('a', 'Indhu'), member('b', 'Nandha'), member('z', 'Zed', false)],
    expenses: [
      {
        id: 'e1',
        groupId: 'g',
        title: 'Dinner',
        description: null,
        amount: 1000,
        currency: 'INR',
        paidBy: 'a',
        category: 'food',
        splitType: 'equal',
        expenseDate: '',
        createdBy: 'b',
        createdAt: '',
        updatedAt: '',
        splits: [
          { userId: 'a', amount: 500, weight: null },
          { userId: 'b', amount: 500, weight: null },
        ],
      },
      {
        id: 'e2',
        groupId: 'g',
        title: 'Old',
        description: null,
        amount: 200,
        currency: 'INR',
        paidBy: 'a',
        category: 'other',
        splitType: 'equal',
        expenseDate: '',
        createdBy: 'a',
        createdAt: '',
        updatedAt: '',
        splits: [{ userId: 'z', amount: 200, weight: null }],
      },
    ],
    settlements: [
      { id: 's', groupId: 'g', fromUser: 'z', toUser: 'a', amount: 200, status: 'paid', note: null, createdBy: 'z', paidAt: '', cancelledAt: null, createdAt: '' },
    ],
  }

  it('computes balances, the plan and permissions', () => {
    const asNandha = deriveGroupState(data, 'b')
    expect(asNandha.mine).toEqual({ net: -500, owes: [{ from: 'b', to: 'a', amount: 500 }], receives: [] })
    expect(asNandha.totalSpent).toBe(1200)
    expect(asNandha.isAdmin).toBe(false)
    // Nandha created e1, so can edit it; e2 involves a former member and is locked.
    expect(asNandha.canEditExpense(data.expenses[0]!)).toBe(true)
    expect(asNandha.canEditExpense(data.expenses[1]!)).toBe(false)
    expect(asNandha.isExpenseLocked(data.expenses[1]!)).toBe(true)
    expect(asNandha.balanceOf('z').net).toBe(0)
    expect(asNandha.nameOf('z')).toBe('Zed')

    const asOwner = deriveGroupState(data, 'a')
    expect(asOwner.isAdmin).toBe(true)
    expect(asOwner.canSettle('b', 'a')).toBe(true)
    // Indhu received the former member's payment, so she can still dispute it…
    expect(asOwner.canCancelSettlement(data.settlements[0]!)).toBe(true)
    // …but nobody else can change a former member's payment.
    expect(asNandha.canCancelSettlement(data.settlements[0]!)).toBe(false)
  })
})
