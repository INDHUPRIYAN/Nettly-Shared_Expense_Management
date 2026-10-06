import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createExpense,
  deleteExpense,
  findInviteByCode,
  joinGroup,
  recordSettlement,
  removeMember,
  setMemberDisplayName,
  setMemberRole,
  updateExpense,
  updateProfile,
  updateSettlementStatus,
} from '@/lib/api/mutations'
import { queryKeys } from '@/lib/queryKeys'
import type { Money, UserId } from '@/lib/settlement'
import type { ExpenseInput } from '@/types/app'

/** Invalidate a group and the dashboard after any change to it. */
function useInvalidateGroup(groupId: string) {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.myGroups() }),
    ])
}

/* Expenses -------------------------------------------------------------- */

export function useCreateExpense(groupId: string) {
  const invalidate = useInvalidateGroup(groupId)
  return useMutation({ mutationFn: (input: ExpenseInput) => createExpense(groupId, input), onSuccess: invalidate })
}

export function useUpdateExpense(groupId: string) {
  const invalidate = useInvalidateGroup(groupId)
  return useMutation({
    mutationFn: ({ expenseId, input }: { expenseId: string; input: ExpenseInput }) => updateExpense(expenseId, input),
    onSuccess: invalidate,
  })
}

export function useDeleteExpense(groupId: string) {
  const invalidate = useInvalidateGroup(groupId)
  return useMutation({ mutationFn: (expenseId: string) => deleteExpense(expenseId), onSuccess: invalidate })
}

/* Settlements ----------------------------------------------------------- */

export function useRecordSettlement(groupId: string) {
  const invalidate = useInvalidateGroup(groupId)
  return useMutation({
    mutationFn: (input: { fromUser: UserId; toUser: UserId; amount: Money; note: string | null; status: 'paid' | 'pending' }) =>
      recordSettlement({ groupId, ...input }),
    onSuccess: invalidate,
  })
}

export function useUpdateSettlementStatus(groupId: string) {
  const invalidate = useInvalidateGroup(groupId)
  return useMutation({
    mutationFn: ({ settlementId, status }: { settlementId: string; status: 'paid' | 'cancelled' }) =>
      updateSettlementStatus(settlementId, status),
    onSuccess: invalidate,
  })
}

/* Members --------------------------------------------------------------- */

export function useRemoveMember(groupId: string) {
  const invalidate = useInvalidateGroup(groupId)
  return useMutation({ mutationFn: (userId: UserId) => removeMember(groupId, userId), onSuccess: invalidate })
}

export function useSetMemberRole(groupId: string) {
  const invalidate = useInvalidateGroup(groupId)
  return useMutation({
    mutationFn: ({ userId, role }: { userId: UserId; role: 'admin' | 'member' }) => setMemberRole(groupId, userId, role),
    onSuccess: invalidate,
  })
}

export function useSetMemberName(groupId: string) {
  const invalidate = useInvalidateGroup(groupId)
  return useMutation({
    mutationFn: ({ userId, name }: { userId: UserId; name: string | null }) => setMemberDisplayName(groupId, userId, name),
    onSuccess: invalidate,
  })
}

/* Invites --------------------------------------------------------------- */

export function useJoinGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (token: string) => joinGroup(token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.myGroups() }),
  })
}

export function useFindInviteByCode() {
  return useMutation({ mutationFn: (code: string) => findInviteByCode(code) })
}

/* Profile --------------------------------------------------------------- */

export function useUpdateProfile(userId: UserId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string }) => updateProfile(userId, input),
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.profile(userId), profile)
      // Names appear inside every group view.
      void queryClient.invalidateQueries({ queryKey: ['group'] })
    },
  })
}
