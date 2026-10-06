import { Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/primitives'
import { useSetMemberName } from '@/hooks/useGroupMutations'
import { getErrorMessage } from '@/lib/errors'
import { fieldErrors, memberNameSchema } from '@/lib/validation'
import { useGroupContext } from '@/providers/GroupContext'
import type { Member } from '@/types/app'

/** Rename a member inside this group only. Mount with a key per member. */
export function EditMemberNameDialog({ member, onOpenChange }: { member: Member; onOpenChange: (open: boolean) => void }) {
  const { group, userId } = useGroupContext()
  const setName = useSetMemberName(group.id)
  const [name, setNameInput] = useState(member.nickname ?? member.name)
  const [error, setError] = useState<string | null>(null)
  const isSelf = member.userId === userId

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const result = memberNameSchema.safeParse({ name })
    if (!result.success) {
      setError(fieldErrors(result.error).name ?? null)
      return
    }
    // Typing the profile name again just clears the nickname.
    const nickname = result.data.name === member.profileName ? null : result.data.name
    setName.mutate(
      { userId: member.userId, name: nickname },
      {
        onSuccess: () => {
          toast.success(nickname ? `Name changed to ${nickname}` : `Name reset to ${member.profileName}`)
          onOpenChange(false)
        },
        onError: (e) => toast.error(getErrorMessage(e)),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(next) => !setName.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isSelf ? 'Edit your name' : `Edit ${member.name}'s name`}</DialogTitle>
          <DialogDescription>
            Shown to everyone in {group.name} only. Their account name ({member.profileName}) doesn&apos;t change.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field id="member-name" label="Name in this group" error={error} hint="Leave empty to use their account name.">
            {(aria) => (
              <Input
                {...aria}
                value={name}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={80}
                autoComplete="off"
                autoFocus
                placeholder={member.profileName}
              />
            )}
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={setName.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={setName.isPending}>
              {setName.isPending && <Loader2 className="animate-spin" />}
              Save name
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
