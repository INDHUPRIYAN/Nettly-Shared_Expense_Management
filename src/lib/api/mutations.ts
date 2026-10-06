import { AppError, throwIfError } from '@/lib/errors'
import { isCurrencyCode, type Money, type UserId } from '@/lib/settlement'
import { supabase } from '@/lib/supabase/client'
import type { ExpenseInput, InvitePreview, Profile } from '@/types/app'

const PROFILE_COLUMNS = 'id, name, avatar_url, created_at, updated_at'
import { mapSettlement } from './groups'

/* ----------------------------------------------------------------------------
 * Expenses
 * ------------------------------------------------------------------------- */

function expenseArgs(input: ExpenseInput) {
  return {
    p_title: input.title,
    p_description: input.description ?? undefined,
    p_amount: input.amount,
    p_paid_by: input.paidBy,
    p_category: input.category,
    p_split_type: input.splitType,
    p_expense_date: input.expenseDate,
    p_splits: input.splits.map((s) => ({ user_id: s.userId, amount: s.amount, weight: s.weight })),
  }
}

export async function createExpense(groupId: string, input: ExpenseInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_expense', { p_group_id: groupId, ...expenseArgs(input) })
  throwIfError(error, "We couldn't add the expense.")
  if (!data) throw new AppError("We couldn't add the expense.")
  return data
}

export async function updateExpense(expenseId: string, input: ExpenseInput): Promise<void> {
  const { error } = await supabase.rpc('update_expense', { p_expense_id: expenseId, ...expenseArgs(input) })
  throwIfError(error, "We couldn't save the expense.")
}

export async function deleteExpense(expenseId: string): Promise<void> {
  const { data, error } = await supabase.from('expenses').delete().eq('id', expenseId).select('id')
  throwIfError(error, "We couldn't delete the expense.")
  if (!data || data.length === 0) throw new AppError('Only the person who added it or a group admin can delete this expense.')
}

/* ----------------------------------------------------------------------------
 * Settlements
 * ------------------------------------------------------------------------- */

export async function recordSettlement(input: {
  groupId: string
  fromUser: UserId
  toUser: UserId
  amount: Money
  note: string | null
}) {
  const { data, error } = await supabase
    .from('settlements')
    .insert({
      group_id: input.groupId,
      from_user: input.fromUser,
      to_user: input.toUser,
      amount: input.amount,
      note: input.note,
      status: 'paid',
    })
    .select()
    .single()
  throwIfError(error, "We couldn't record the payment.")
  return mapSettlement(data!)
}

export async function updateSettlementStatus(settlementId: string, status: 'paid' | 'cancelled') {
  const { data, error } = await supabase.from('settlements').update({ status }).eq('id', settlementId).select().maybeSingle()
  throwIfError(error, "We couldn't update the payment.")
  if (!data) throw new AppError("You don't have permission to change this payment.")
  return mapSettlement(data)
}

/* ----------------------------------------------------------------------------
 * Members & invites
 * ------------------------------------------------------------------------- */

export async function removeMember(groupId: string, userId: UserId): Promise<'removed' | 'deactivated'> {
  const { data, error } = await supabase.rpc('remove_member', { p_group_id: groupId, p_user_id: userId })
  throwIfError(error, "We couldn't remove this member.")
  return data === 'deactivated' ? 'deactivated' : 'removed'
}

export async function setMemberRole(groupId: string, userId: UserId, role: 'admin' | 'member'): Promise<void> {
  const { error } = await supabase.rpc('set_member_role', { p_group_id: groupId, p_user_id: userId, p_role: role })
  throwIfError(error, "We couldn't change this member's role.")
}

export async function setMemberDisplayName(groupId: string, userId: UserId, name: string | null): Promise<void> {
  const { error } = await supabase.rpc('set_member_display_name', {
    p_group_id: groupId,
    p_user_id: userId,
    p_name: name ?? '',
  })
  throwIfError(error, "We couldn't change this name.")
}

export async function fetchInvitePreview(token: string): Promise<InvitePreview | null> {
  const { data, error } = await supabase.rpc('get_invite_preview', { p_token: token })
  throwIfError(error, "We couldn't load this invite.")
  const row = data?.[0]
  if (!row) return null
  return {
    groupId: row.group_id,
    name: row.name,
    description: row.description,
    currency: isCurrencyCode(row.currency) ? row.currency : 'INR',
    creatorName: row.creator_name,
    memberCount: row.member_count,
    isMember: row.is_member,
  }
}

export async function joinGroup(token: string): Promise<{ groupId: string; status: 'joined' | 'rejoined' | 'already_member' }> {
  const { data, error } = await supabase.rpc('join_group', { p_token: token })
  throwIfError(error, "We couldn't join this group.")
  const row = data?.[0]
  if (!row) throw new AppError("We couldn't join this group.")
  const status = row.status === 'already_member' || row.status === 'rejoined' ? row.status : 'joined'
  return { groupId: row.group_id, status }
}

export async function findInviteByCode(code: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('find_invite_by_code', { p_code: code })
  throwIfError(error, "We couldn't look up that code.")
  return data ?? null
}

/* ----------------------------------------------------------------------------
 * Profile
 * ------------------------------------------------------------------------- */

export async function fetchProfile(userId: UserId): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle()
  throwIfError(error, "We couldn't load your profile.")
  return data
}

export async function updateProfile(userId: UserId, input: { name: string }): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').update({ name: input.name }).eq('id', userId).select(PROFILE_COLUMNS).single()
  throwIfError(error, "We couldn't save your profile.")
  return data!
}
