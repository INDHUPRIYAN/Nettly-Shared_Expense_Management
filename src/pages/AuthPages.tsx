import { Loader2, MailCheck } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Logo } from '@/components/common/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, Field } from '@/components/ui/primitives'
import { APP_NAME } from '@/config/app'
import { useAuth } from '@/hooks/useAuth'
import { getErrorMessage } from '@/lib/errors'
import { authPath, safeNextPath } from '@/lib/navigation'
import { fieldErrors, loginSchema, signupSchema } from '@/lib/validation'

function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: ReactNode; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10 sm:justify-center">
      <Logo className="mb-8" />
      <Card className="w-full max-w-sm p-6 sm:p-8">
        <main>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">{subtitle}</p>
          {children}
        </main>
      </Card>
      <p className="mt-6 text-sm text-muted-foreground">{footer}</p>
    </div>
  )
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-lg bg-negative-soft px-3 py-2 text-sm text-negative">
      {message}
    </p>
  )
}

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNextPath(params.get('next'))
  const joining = next.startsWith('/join/')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const result = loginSchema.safeParse({ email, password })
    if (!result.success) {
      setErrors(fieldErrors(result.error))
      return
    }
    setErrors({})
    setFormError(null)
    setPending(true)
    try {
      await signIn(result.data)
      navigate(next, { replace: true })
    } catch (error) {
      setFormError(getErrorMessage(error))
      setPending(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle={joining ? 'Log in to join the group you were invited to.' : `Log in to ${APP_NAME}.`}
      footer={
        <>
          New here?{' '}
          <Link to={authPath('signup', params.get('next') ?? undefined)} className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={formError} />
        <Field id="login-email" label="Email" error={errors.email}>
          {(aria) => (
            <Input {...aria} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          )}
        </Field>
        <Field id="login-password" label="Password" error={errors.password}>
          {(aria) => (
            <Input
              {...aria}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Log in
        </Button>
      </form>
    </AuthLayout>
  )
}

export function SignupPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNextPath(params.get('next'))
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const result = signupSchema.safeParse({ name, email, password })
    if (!result.success) {
      setErrors(fieldErrors(result.error))
      return
    }
    setErrors({})
    setFormError(null)
    setPending(true)
    try {
      const { needsConfirmation } = await signUp(result.data, next)
      if (needsConfirmation) {
        setConfirmEmail(result.data.email)
        setPending(false)
      } else {
        navigate(next, { replace: true })
      }
    } catch (error) {
      setFormError(getErrorMessage(error))
      setPending(false)
    }
  }

  if (confirmEmail) {
    return (
      <AuthLayout
        title="Check your inbox"
        subtitle={`We sent a confirmation link to ${confirmEmail}.`}
        footer={
          <Link to={authPath('login', params.get('next') ?? undefined)} className="font-medium text-primary hover:underline">
            Back to log in
          </Link>
        }
      >
        <div className="flex items-start gap-3 rounded-xl bg-positive-soft p-4 text-sm text-positive">
          <MailCheck aria-hidden className="mt-0.5 size-5 shrink-0" />
          <p>Open the link in that email to activate your account, then log in.</p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Split costs with friends in seconds."
      footer={
        <>
          Already have an account?{' '}
          <Link to={authPath('login', params.get('next') ?? undefined)} className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={formError} />
        <Field id="signup-name" label="Full name" error={errors.name}>
          {(aria) => <Input {...aria} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />}
        </Field>
        <Field id="signup-email" label="Email" error={errors.email}>
          {(aria) => <Input {...aria} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field id="signup-password" label="Password" error={errors.password} hint="At least 8 characters.">
          {(aria) => (
            <Input
              {...aria}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Create account
        </Button>
      </form>
    </AuthLayout>
  )
}
