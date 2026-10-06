import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { RealtimeStatus } from '@/hooks/useGroup'
import {
  calculateBalances,
  personalSummary,
  simplifyDebts,
  totalSpent,
  type MemberBalance,
  type PersonalSummary,
  type Transfer,
  type UserId,
} from '@/lib/settlement'
import type { Expense, GroupData, Member, Settlement } from '@/types/app'

export interface GroupActions {
  /** Open the add form (no argument) or the edit form for an expense. */
  openExpenseForm: (expense?: Expense) => void
  openExpenseDetails: (expense: Expense) => void
  /** Open the "mark as paid" confirmation for a suggested transfer. */
  openSettle: (transfer: Transfer) => void
}

export interface GroupContextValue extends GroupData, GroupActions {
  userId: UserId
  me: Member | undefined
  isAdmin: boolean
  isOwner: boolean
  activeMembers: Member[]
  formerMembers: Member[]
  memberById: Map<UserId, Member>
  nameOf: (userId: UserId | null | undefined) => string
  /** "You" for the current user, otherwise the member's name. */
  displayName: (userId: UserId | null | undefined) => string
  totalSpent: number
  balances: MemberBalance[]
  balanceOf: (userId: UserId) => MemberBalance
  transfers: Transfer[]
  mine: PersonalSummary
  canEditExpense: (expense: Expense) => boolean
  isExpenseLocked: (expense: Expense) => boolean
  canSettle: (from: UserId, to: UserId) => boolean
  canCancelSettlement: (settlement: Settlement) => boolean
  realtime: RealtimeStatus
}

const GroupContext = createContext<GroupContextValue | null>(null)

const EMPTY_BALANCE = (userId: UserId): MemberBalance => ({ userId, paid: 0, share: 0, sent: 0, received: 0, net: 0 })

/** Pure derivation of everything screens need, computed once per data change. */
export function deriveGroupState(data: GroupData, userId: UserId) {
  const memberById = new Map(data.members.map((m) => [m.userId, m]))
  const activeMembers = data.members.filter((m) => m.isActive)
  const formerMembers = data.members.filter((m) => !m.isActive)
  const me = memberById.get(userId)
  const isAdmin = me?.isActive === true && (me.role === 'owner' || me.role === 'admin')
  const isOwner = me?.role === 'owner'

  const balances = calculateBalances(
    data.members.map((m) => m.userId),
    data.expenses,
    data.settlements,
  )
  const balanceMap = new Map(balances.map((b) => [b.userId, b]))
  const transfers = simplifyDebts(balances)
  const isActive = (id: UserId) => memberById.get(id)?.isActive === true

  return {
    memberById,
    activeMembers,
    formerMembers,
    me,
    isAdmin,
    isOwner,
    balances,
    transfers,
    mine: personalSummary(userId, balances, transfers),
    totalSpent: totalSpent(data.expenses),
    balanceOf: (id: UserId) => balanceMap.get(id) ?? EMPTY_BALANCE(id),
    nameOf: (id: UserId | null | undefined) => (id ? (memberById.get(id)?.name ?? 'Former member') : 'Someone'),
    isExpenseLocked: (e: Expense) => !isActive(e.paidBy) || e.splits.some((s) => !isActive(s.userId)),
    canEditExpense: (e: Expense) => (me?.isActive ?? false) && (e.createdBy === userId || isAdmin),
    canSettle: (from: UserId, to: UserId) =>
      (me?.isActive ?? false) && isActive(from) && isActive(to) && (from === userId || to === userId || isAdmin),
    canCancelSettlement: (s: Settlement) => {
      if (s.status === 'cancelled' || !(me?.isActive ?? false)) return false
      // The receiver can always dispute a payment recorded to them.
      if (s.toUser === userId) return true
      return isActive(s.fromUser) && isActive(s.toUser) && (s.fromUser === userId || isAdmin)
    },
  }
}

export function GroupProvider({
  data,
  userId,
  actions,
  realtime,
  children,
}: {
  data: GroupData
  userId: UserId
  actions: GroupActions
  realtime: RealtimeStatus
  children: ReactNode
}) {
  const derived = useMemo(() => deriveGroupState(data, userId), [data, userId])

  const value = useMemo<GroupContextValue>(
    () => ({
      ...data,
      ...derived,
      ...actions,
      userId,
      realtime,
      displayName: (id) => (id === userId ? 'You' : derived.nameOf(id)),
    }),
    [data, derived, actions, userId, realtime],
  )

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>
}

export function useGroupContext(): GroupContextValue {
  const context = useContext(GroupContext)
  if (!context) throw new Error('useGroupContext must be used inside <GroupProvider>')
  return context
}
