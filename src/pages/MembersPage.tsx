import { Crown, LogOut, MoreVertical, Pencil, Shield, ShieldOff, UserMinus, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { MemberTotalsTable } from '@/components/balances/BalanceViews'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { MemberAvatar } from '@/components/common/MemberAvatar'
import { EmptyState } from '@/components/common/States'
import { InvitePanel } from '@/components/groups/InvitePanel'
import { EditMemberNameDialog } from '@/components/members/EditMemberNameDialog'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/menu'
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/primitives'
import { useRemoveMember, useSetMemberRole } from '@/hooks/useGroupMutations'
import { getErrorMessage } from '@/lib/errors'
import { formatDate } from '@/lib/utils'
import { useGroupContext } from '@/providers/GroupContext'
import type { Member } from '@/types/app'

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', member: 'Member' } as const

export function MembersPage() {
  const { group, activeMembers, formerMembers, userId, me, isOwner, isAdmin, displayName } = useGroupContext()
  const navigate = useNavigate()
  const remove = useRemoveMember(group.id)
  const setRole = useSetMemberRole(group.id)
  const [removing, setRemoving] = useState<Member | null>(null)
  const [renaming, setRenaming] = useState<Member | null>(null)
  const canRename = (m: Member) => m.userId === userId || isAdmin

  const canRemove = (m: Member) =>
    m.role !== 'owner' && m.userId !== userId && (isOwner || (isAdmin && m.role === 'member'))
  const leaving = removing?.userId === userId

  const confirmRemove = () => {
    if (!removing) return
    remove.mutate(removing.userId, {
      onSuccess: (result) => {
        setRemoving(null)
        if (leaving) {
          toast.success(`You left ${group.name}`)
          navigate('/dashboard', { replace: true })
          return
        }
        toast.success(
          result === 'deactivated'
            ? `${removing.name} was removed. Their past expenses are kept.`
            : `${removing.name} was removed from the group.`,
        )
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    })
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardContent>
          <InvitePanel groupName={group.name} inviteToken={group.inviteToken} inviteCode={group.inviteCode} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            {activeMembers.length} {activeMembers.length === 1 ? 'person' : 'people'} in this group
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {activeMembers.length <= 1 && (
            <EmptyState
              icon={UserPlus}
              title="No members yet"
              description="Invite your friends to join — share the link above."
              className="mb-3 border-0 bg-transparent py-4"
            />
          )}
          <ul className="divide-y divide-rose-100" aria-label="Group members">
            {activeMembers.map((m) => (
              <li key={m.userId} className="flex items-center gap-3 py-3">
                <MemberAvatar name={m.name} avatarUrl={m.avatarUrl} seed={m.userId} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {m.name}
                    {m.userId === userId && <span className="font-normal text-muted-foreground"> (you)</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.nickname && m.nickname !== m.profileName ? `${m.profileName} · ` : ''}Joined {formatDate(m.joinedAt)}
                  </p>
                </div>
                <Badge variant={m.role === 'member' ? 'outline' : 'default'}>
                  {m.role === 'owner' && <Crown />}
                  {m.role === 'admin' && <Shield />}
                  {ROLE_LABEL[m.role]}
                </Badge>
                {(canRename(m) || canRemove(m) || (isOwner && m.role !== 'owner')) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${m.name}`}>
                        <MoreVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {canRename(m) && (
                        <DropdownMenuItem onSelect={() => setRenaming(m)}>
                          <Pencil /> Edit name
                        </DropdownMenuItem>
                      )}
                      {isOwner && m.role === 'member' && (
                        <DropdownMenuItem
                          onSelect={() =>
                            setRole.mutate(
                              { userId: m.userId, role: 'admin' },
                              { onSuccess: () => toast.success(`${m.name} is now an admin`), onError: (e) => toast.error(getErrorMessage(e)) },
                            )
                          }
                        >
                          <Shield /> Make admin
                        </DropdownMenuItem>
                      )}
                      {isOwner && m.role === 'admin' && (
                        <DropdownMenuItem
                          onSelect={() =>
                            setRole.mutate(
                              { userId: m.userId, role: 'member' },
                              { onSuccess: () => toast.success(`${m.name} is no longer an admin`), onError: (e) => toast.error(getErrorMessage(e)) },
                            )
                          }
                        >
                          <ShieldOff /> Remove admin role
                        </DropdownMenuItem>
                      )}
                      {canRemove(m) && (
                        <DropdownMenuItem destructive onSelect={() => setRemoving(m)}>
                          <UserMinus /> Remove from group
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            ))}
          </ul>
          {me && me.role !== 'owner' && (
            <Button variant="ghost" className="mt-2 text-destructive" onClick={() => setRemoving(me)}>
              <LogOut /> Leave group
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Member-wise totals</CardTitle>
          <CardDescription>Positive balance means they should receive money; negative means they owe.</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <MemberTotalsTable />
        </CardContent>
      </Card>

      {formerMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Former members</CardTitle>
            <CardDescription>Their past expenses and payments are kept in the history.</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <ul className="divide-y">
              {formerMembers.map((m) => (
                <li key={m.userId} className="flex items-center gap-3 py-3 text-muted-foreground">
                  <MemberAvatar name={m.name} seed={m.userId} size="sm" />
                  <span className="flex-1 truncate text-sm">{displayName(m.userId)}</span>
                  <span className="text-xs">Left {m.removedAt ? formatDate(m.removedAt) : ''}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {renaming && <EditMemberNameDialog key={renaming.userId} member={renaming} onOpenChange={(open) => !open && setRenaming(null)} />}

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={leaving ? `Leave ${group.name}?` : `Remove ${removing?.name ?? ''}?`}
        description={
          <p>
            {leaving ? 'You' : 'They'} can only leave with a settled balance. Past expenses stay in the group history.
            {leaving ? ' You can rejoin later with an invite link.' : ''}
          </p>
        }
        confirmLabel={leaving ? 'Leave group' : 'Remove'}
        destructive
        pending={remove.isPending}
        onConfirm={confirmRemove}
      />
    </div>
  )
}
