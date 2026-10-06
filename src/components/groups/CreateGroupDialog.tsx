import { ArrowRight, PartyPopper } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCreateGroup } from '@/hooks/useGroup'
import { getErrorMessage } from '@/lib/errors'
import type { Group } from '@/types/app'
import { toast } from 'sonner'
import { GroupForm } from './GroupForm'
import { InvitePanel } from './InvitePanel'

export function CreateGroupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const create = useCreateGroup()
  const [created, setCreated] = useState<Group | null>(null)

  const close = (next: boolean) => {
    if (create.isPending) return
    onOpenChange(next)
    if (!next) setTimeout(() => setCreated(null), 200)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        {created ? (
          <>
            <DialogHeader>
              <div className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-positive-soft text-positive">
                <PartyPopper aria-hidden className="size-5" />
              </div>
              <DialogTitle>Group created!</DialogTitle>
              <DialogDescription>Invite your friends to {created.name}.</DialogDescription>
            </DialogHeader>
            <InvitePanel compact groupName={created.name} inviteToken={created.inviteToken} inviteCode={created.inviteCode} />
            <Button
              size="lg"
              variant="secondary"
              onClick={() => {
                close(false)
                navigate(`/groups/${created.id}`)
              }}
            >
              Open group <ArrowRight />
            </Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Create group</DialogTitle>
              <DialogDescription>A trip, a flat, a team — anything you share costs with.</DialogDescription>
            </DialogHeader>
            <GroupForm
              submitLabel="Create group"
              pending={create.isPending}
              onCancel={() => close(false)}
              onSubmit={(input) =>
                create.mutate(input, {
                  onSuccess: (group) => setCreated(group),
                  onError: (error) => toast.error(getErrorMessage(error)),
                })
              }
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
