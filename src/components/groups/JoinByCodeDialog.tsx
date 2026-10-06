import { Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/primitives'
import { useFindInviteByCode } from '@/hooks/useGroupMutations'
import { getErrorMessage } from '@/lib/errors'

export function JoinByCodeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const find = useFindInviteByCode()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const normalised = code.replace(/\s/g, '').toUpperCase()
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(normalised)) {
      setError('Invite codes are 6 letters and numbers, like AB72KQ.')
      return
    }
    setError(null)
    find.mutate(normalised, {
      onSuccess: (token) => {
        if (!token) {
          setError("We couldn't find a group with that code.")
          return
        }
        onOpenChange(false)
        navigate(`/join/${token}`)
      },
      onError: (e) => setError(getErrorMessage(e)),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join with a code</DialogTitle>
          <DialogDescription>Ask a group member for their 6-character invite code.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field id="invite-code" label="Invite code" error={error}>
            {(aria) => (
              <Input
                {...aria}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="AB72KQ"
                maxLength={8}
                autoComplete="off"
                autoCapitalize="characters"
                className="font-mono text-lg tracking-[0.25em] uppercase"
                autoFocus
              />
            )}
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={find.isPending}>
              {find.isPending && <Loader2 className="animate-spin" />}
              Find group
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
