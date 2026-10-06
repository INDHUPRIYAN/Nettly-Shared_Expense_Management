import { Loader2, LogOut } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { MemberAvatar } from '@/components/common/MemberAvatar'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Field } from '@/components/ui/primitives'
import { useAuth, useUserId } from '@/hooks/useAuth'
import { useUpdateProfile } from '@/hooks/useGroupMutations'
import { getErrorMessage } from '@/lib/errors'
import { fieldErrors, profileSchema } from '@/lib/validation'

function ProfileForm({ initialName }: { initialName: string }) {
  const userId = useUserId()
  const update = useUpdateProfile(userId)
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const result = profileSchema.safeParse({ name })
    if (!result.success) {
      setError(fieldErrors(result.error).name ?? null)
      return
    }
    setError(null)
    update.mutate(result.data, {
      onSuccess: () => toast.success('Profile updated'),
      onError: (e) => toast.error(getErrorMessage(e)),
    })
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field id="profile-name" label="Name" error={error} hint="This is how you appear to your groups.">
        {(aria) => <Input {...aria} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} />}
      </Field>
      <Button type="submit" disabled={update.isPending || name.trim() === initialName}>
        {update.isPending && <Loader2 className="animate-spin" />}
        Save
      </Button>
    </form>
  )
}

export function ProfilePage() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const name = profile?.name ?? ''

  return (
    <AppShell>
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex items-center gap-4">
          <MemberAvatar name={name || user?.email || '?'} avatarUrl={profile?.avatar_url} seed={user?.id} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">{name || 'Your profile'}</h1>
            <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your email ({user?.email}) is used to log in.</CardDescription>
          </CardHeader>
          <CardContent>{profile ? <ProfileForm key={profile.updated_at} initialName={profile.name} /> : <Loader2 className="animate-spin" />}</CardContent>
        </Card>

        <Button
          variant="outline"
          onClick={() => {
            navigate('/', { replace: true })
            void signOut()
          }}
          className="w-full sm:w-auto"
        >
          <LogOut /> Log out
        </Button>
      </div>
    </AppShell>
  )
}
