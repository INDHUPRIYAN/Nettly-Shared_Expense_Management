import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { createGroup, deleteGroup, fetchGroupData, fetchMyGroups, regenerateInvite, updateGroup } from '@/lib/api/groups'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase/client'
import type { GroupInput } from '@/lib/validation'
import { useAuth } from './useAuth'

export type RealtimeStatus = 'connecting' | 'live' | 'offline'

/** All data for one group. */
export function useGroupData(groupId: string) {
  return useQuery({
    queryKey: queryKeys.group(groupId),
    queryFn: () => fetchGroupData(groupId),
    staleTime: 30_000,
  })
}

/**
 * Keep a group's data live. The database bumps groups.last_activity_at on any
 * change to expenses, settlements or membership; we listen for that single
 * RLS-protected event and refetch (debounced, so bursts cause one refetch).
 */
export function useGroupRealtime(groupId: string): RealtimeStatus {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const accessToken = session?.access_token
  const [status, setStatus] = useState<RealtimeStatus>('connecting')
  const wasOffline = useRef(false)

  useEffect(() => {
    if (!accessToken) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) })
        void queryClient.invalidateQueries({ queryKey: queryKeys.myGroups() })
      }, 250)
    }

    const channel = supabase.channel(`group-activity:${groupId}`)
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'groups', filter: `id=eq.${groupId}` }, refresh)

    void supabase.realtime.setAuth(accessToken).then(() => {
      if (cancelled) return
      channel.subscribe((state) => {
        if (state === 'SUBSCRIBED') {
          setStatus('live')
          // Catch up on anything missed while disconnected.
          if (wasOffline.current) refresh()
          wasOffline.current = false
        } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
          if (!cancelled) setStatus('offline')
          wasOffline.current = true
        }
      })
    })

    return () => {
      cancelled = true
      clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [groupId, accessToken, queryClient])

  return status
}

export function useMyGroups() {
  return useQuery({ queryKey: queryKeys.myGroups(), queryFn: fetchMyGroups, staleTime: 15_000 })
}

export function useCreateGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: GroupInput) => createGroup(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.myGroups() }),
  })
}

export function useUpdateGroup(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: GroupInput) => updateGroup(groupId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.myGroups() })
    },
  })
}

export function useDeleteGroup(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => deleteGroup(groupId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.group(groupId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.myGroups() })
    },
  })
}

export function useRegenerateInvite(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => regenerateInvite(groupId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) }),
  })
}
