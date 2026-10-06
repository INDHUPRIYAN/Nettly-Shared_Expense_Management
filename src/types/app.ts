import type { CurrencyCode, Money, SettlementStatus, SplitType, UserId } from '@/lib/settlement'
import type { CategoryId } from '@/lib/categories'
import type { Tables } from './database'

export type GroupRole = 'owner' | 'admin' | 'member'

/** Profile columns readable by clients (emails are private). */
export type Profile = Pick<Tables<'profiles'>, 'id' | 'name' | 'avatar_url' | 'created_at' | 'updated_at'>

export interface Group {
  id: string
  name: string
  description: string | null
  currency: CurrencyCode
  createdBy: UserId | null
  inviteToken: string
  inviteCode: string
  createdAt: string
  updatedAt: string
}

export interface Member {
  userId: UserId
  role: GroupRole
  joinedAt: string
  removedAt: string | null
  /** False for former members (left or removed with history kept). */
  isActive: boolean
  /** Name shown in this group: the group nickname if set, otherwise the profile name. */
  name: string
  /** Group-specific name set by the member or an admin (null = none). */
  nickname: string | null
  /** The person's own account/profile name. */
  profileName: string
  avatarUrl: string | null
}

export interface ExpenseSplit {
  userId: UserId
  amount: Money
  weight: number | null
}

export interface Expense {
  id: string
  groupId: string
  title: string
  description: string | null
  amount: Money
  currency: CurrencyCode
  paidBy: UserId
  category: CategoryId
  splitType: SplitType
  expenseDate: string
  createdBy: UserId | null
  createdAt: string
  updatedAt: string
  splits: ExpenseSplit[]
}

export interface Settlement {
  id: string
  groupId: string
  fromUser: UserId
  toUser: UserId
  amount: Money
  status: SettlementStatus
  note: string | null
  createdBy: UserId | null
  paidAt: string | null
  cancelledAt: string | null
  createdAt: string
}

/** Everything a group screen needs, fetched in one go. */
export interface GroupData {
  group: Group
  members: Member[]
  expenses: Expense[]
  settlements: Settlement[]
}

/** Dashboard row from get_my_groups(). */
export interface GroupSummary {
  id: string
  name: string
  description: string | null
  currency: CurrencyCode
  role: GroupRole
  memberCount: number
  totalSpent: Money
  myBalance: Money
  lastActivityAt: string
}

export interface InvitePreview {
  groupId: string
  name: string
  description: string | null
  currency: CurrencyCode
  creatorName: string | null
  memberCount: number
  isMember: boolean
}

/** Payload for creating or updating an expense. */
export interface ExpenseInput {
  title: string
  description: string | null
  amount: Money
  paidBy: UserId
  category: CategoryId
  splitType: SplitType
  expenseDate: string
  splits: ExpenseSplit[]
}
