import { RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { GroupForm } from '@/components/groups/GroupForm'
import { InvitePanel } from '@/components/groups/InvitePanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Field } from '@/components/ui/primitives'
import { useDeleteGroup, useRegenerateInvite, useUpdateGroup } from '@/hooks/useGroup'
import { getErrorMessage } from '@/lib/errors'
import { useGroupContext } from '@/providers/GroupContext'

export function GroupSettingsPage() {
  const { group, isAdmin, isOwner, expenses, settlements } = useGroupContext()
  const navigate = useNavigate()
  const update = useUpdateGroup(group.id)
  const regenerate = useRegenerateInvite(group.id)
  const remove = useDeleteGroup(group.id)
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [typedName, setTypedName] = useState('')

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Group details</CardTitle>
          <CardDescription>{isAdmin ? 'Visible to everyone in the group.' : 'Only the owner or an admin can change these.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <GroupForm
            key={group.updatedAt}
            initial={group}
            readOnly={!isAdmin}
            currencyLocked={expenses.length > 0 || settlements.length > 0}
            submitLabel="Save changes"
            pending={update.isPending}
            onSubmit={(input) =>
              update.mutate(input, {
                onSuccess: () => toast.success('Group updated'),
                onError: (error) => toast.error(getErrorMessage(error)),
              })
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <InvitePanel groupName={group.name} inviteToken={group.inviteToken} inviteCode={group.inviteCode} />
          {isAdmin && (
            <Button variant="outline" onClick={() => setConfirmRegenerate(true)}>
              <RefreshCw /> Reset invite link
            </Button>
          )}
        </CardContent>
      </Card>

      {isOwner && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Danger zone</CardTitle>
            <CardDescription>Deleting the group permanently removes all of its expenses, splits and payments.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 /> Delete group
            </Button>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmRegenerate}
        onOpenChange={setConfirmRegenerate}
        title="Reset invite link?"
        description="The current link and code will stop working. Members who already joined are not affected."
        confirmLabel="Reset link"
        pending={regenerate.isPending}
        onConfirm={() =>
          regenerate.mutate(undefined, {
            onSuccess: () => {
              toast.success('New invite link created')
              setConfirmRegenerate(false)
            },
            onError: (error) => toast.error(getErrorMessage(error)),
          })
        }
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(open) => {
          setConfirmDelete(open)
          if (!open) setTypedName('')
        }}
        title={`Delete ${group.name}?`}
        description="This can't be undone. Everyone in the group loses access to its history."
        confirmLabel="Delete group"
        destructive
        pending={remove.isPending}
        confirmDisabled={typedName.trim() !== group.name}
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => {
              toast.success('Group deleted')
              navigate('/dashboard', { replace: true })
            },
            onError: (error) => toast.error(getErrorMessage(error)),
          })
        }
      >
        <Field id="confirm-group-name" label={`Type “${group.name}” to confirm`}>
          {(aria) => <Input {...aria} value={typedName} onChange={(e) => setTypedName(e.target.value)} autoComplete="off" />}
        </Field>
      </ConfirmDialog>
    </div>
  )
}
