import { isCategoryId } from '@/lib/categories'
import { AppError, throwIfError } from '@/lib/errors'
import { isCurrencyCode, type CurrencyCode, type SettlementStatus, type SplitType } from '@/lib/settlement'
import { supabase } from '@/lib/supabase/client'
import type { GroupInput } from '@/lib/validation'
import type { Tables } from '@/types/database'
import type { Expense, Group, GroupData, GroupRole, GroupSummary, Member, Settlement } from '@/types/app'

const toCurrency = (value: string): CurrencyCode => (isCurrencyCode(value) ? value : 'INR')
const SPLIT_TYPES: readonly SplitType[] = ['equal', 'custom', 'percentage', 'shares']
const SETTLEMENT_STATUSES: readonly SettlementStatus[] = ['pending', 'paid', 'cancelled']
const ROLES: readonly GroupRole[] = ['owner', 'admin', 'member']

export function mapGroup(row: Tables<'groups'>): Group {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    currency: toCurrency(row.currency),
    createdBy: row.created_by,
    inviteToken: row.invite_token,
    inviteCode: row.invite_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapSettlement(row: Tables<'settlements'>): Settlement {
  return {
    id: row.id,
    groupId: row.group_id,
    fromUser: row.from_user,
    toUser: row.to_user,
    amount: row.amount,
    status: SETTLEMENT_STATUSES.includes(row.status as SettlementStatus) ? (row.status as SettlementStatus) : 'pending',
    note: row.note,
    createdBy: row.created_by,
    paidAt: row.paid_at,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
  }
}

type ExpenseRow = Tables<'expenses'> & {
  expense_splits: Pick<Tables<'expense_splits'>, 'user_id' | 'amount' | 'weight'>[]
}

export function mapExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    groupId: row.group_id,
    title: row.title,
    description: row.description,
    amount: row.amount,
    currency: toCurrency(row.currency),
    paidBy: row.paid_by,
    category: isCategoryId(row.category) ? row.category : 'other',
    splitType: SPLIT_TYPES.includes(row.split_type as SplitType) ? (row.split_type as SplitType) : 'custom',
    expenseDate: row.expense_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    splits: row.expense_splits.map((s) => ({ userId: s.user_id, amount: s.amount, weight: s.weight })),
  }
}

/** PostgREST returns at most this many rows per request (Supabase `max_rows`). */
export const PAGE_SIZE = 1000

/**
 * Fetch every row of a query page by page. Balances must be computed from ALL
 * records — a silently truncated list would show wrong numbers.
 */
export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  errorMessage: string,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    throwIfError(error, errorMessage)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}

/** Load everything a group screen needs in parallel. Returns null if the group is missing or not accessible. */
export async function fetchGroupData(groupId: string): Promise<GroupData | null> {
  const [groupRes, memberRows, expenseRows, settlementRows] = await Promise.all([
    supabase.from('groups').select('*').eq('id', groupId).maybeSingle(),
    fetchAllPages(
      (from, to) =>
        supabase
          .from('group_members')
          .select('user_id, role, joined_at, removed_at, display_name, profile:profiles(name, avatar_url)')
          .eq('group_id', groupId)
          .order('joined_at', { ascending: true })
          .order('user_id', { ascending: true })
          .range(from, to),
      "We couldn't load the members.",
    ),
    fetchAllPages(
      (from, to) =>
        supabase
          .from('expenses')
          .select('*, expense_splits(user_id, amount, weight)')
          .eq('group_id', groupId)
          .order('expense_date', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to),
      "We couldn't load the expenses.",
    ),
    fetchAllPages(
      (from, to) =>
        supabase
          .from('settlements')
          .select('*')
          .eq('group_id', groupId)
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to),
      "We couldn't load the payments.",
    ),
  ])

  throwIfError(groupRes.error, "We couldn't load this group.")
  if (!groupRes.data) return null

  const members: Member[] = memberRows.map((m) => ({
    userId: m.user_id,
    role: ROLES.includes(m.role as GroupRole) ? (m.role as GroupRole) : 'member',
    joinedAt: m.joined_at,
    removedAt: m.removed_at,
    isActive: m.removed_at === null,
    name: m.display_name ?? m.profile?.name ?? 'Former member',
    nickname: m.display_name,
    profileName: m.profile?.name ?? 'Former member',
    avatarUrl: m.profile?.avatar_url ?? null,
  }))

  return {
    group: mapGroup(groupRes.data),
    members,
    expenses: expenseRows.map(mapExpense),
    settlements: settlementRows.map(mapSettlement),
  }
}

export async function fetchMyGroups(): Promise<GroupSummary[]> {
  const { data, error } = await supabase.rpc('get_my_groups')
  throwIfError(error, "We couldn't load your groups.")
  return (data ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    currency: toCurrency(g.currency),
    role: ROLES.includes(g.role as GroupRole) ? (g.role as GroupRole) : 'member',
    memberCount: g.member_count,
    totalSpent: g.total_spent,
    myBalance: g.my_balance,
    lastActivityAt: g.last_activity_at,
  }))
}

export async function createGroup(input: GroupInput): Promise<Group> {
  const { data, error } = await supabase.rpc('create_group', {
    p_name: input.name,
    p_description: input.description ?? undefined,
    p_currency: input.currency,
  })
  throwIfError(error, "We couldn't create the group.")
  if (!data) throw new AppError("We couldn't create the group.")
  return mapGroup(data)
}

export async function updateGroup(groupId: string, input: GroupInput): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .update({ name: input.name, description: input.description, currency: input.currency })
    .eq('id', groupId)
    .select()
    .maybeSingle()
  throwIfError(error, "We couldn't save the group settings.")
  if (!data) throw new AppError("You don't have permission to change these settings.")
  return mapGroup(data)
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { data, error } = await supabase.from('groups').delete().eq('id', groupId).select('id')
  throwIfError(error, "We couldn't delete the group.")
  if (!data || data.length === 0) throw new AppError('Only the group owner can delete this group.')
}

export async function regenerateInvite(groupId: string): Promise<Group> {
  const { data, error } = await supabase.rpc('regenerate_invite', { p_group_id: groupId })
  throwIfError(error, "We couldn't create a new invite link.")
  if (!data) throw new AppError("We couldn't create a new invite link.")
  return mapGroup(data)
}
