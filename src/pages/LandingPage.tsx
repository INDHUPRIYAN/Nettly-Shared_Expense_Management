import { ArrowDownLeft, ArrowRight, HandCoins, ReceiptText, ShieldCheck, Users, Zap } from 'lucide-react'
import { Link } from 'react-router'
import { Logo } from '@/components/common/Logo'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/primitives'
import { APP_NAME, APP_TAGLINE } from '@/config/app'
import { useAuth } from '@/hooks/useAuth'

const STEPS = [
  { icon: Users, title: 'Create a group', text: 'Start a group for a trip, a flat or an event and share the invite link on WhatsApp.' },
  { icon: ReceiptText, title: 'Add expenses', text: 'Record who paid and who took part. Split equally, by amount, percentage or shares.' },
  { icon: HandCoins, title: 'Settle up', text: `${APP_NAME} works out the fewest payments needed. Mark them paid as you go.` },
]

const POINTS = [
  { icon: Zap, text: 'Live updates for everyone in the group' },
  { icon: ShieldCheck, text: 'Only members can see a group' },
  { icon: ArrowDownLeft, text: 'Exact to the paisa — nothing gets lost in rounding' },
]

export function LandingPage() {
  const { user } = useAuth()
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Logo />
        <nav className="flex items-center gap-2">
          {user ? (
            <Button asChild>
              <Link to="/dashboard">Open dashboard</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link to="/login">Log in</Link>
              </Button>
              <Button asChild>
                <Link to="/signup">Sign up</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-4 pt-12 pb-16 sm:pt-20">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-6xl">
              Split anything. <span className="text-brand">Settle everything.</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground text-pretty">
              Who paid? Who took part? Who owes whom? {APP_NAME} keeps track of shared expenses and tells everyone exactly
              what they owe or should get back.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link to={user ? '/dashboard' : '/signup'}>
                  {user ? 'Go to your groups' : 'Get started — it’s free'} <ArrowRight />
                </Link>
              </Button>
              {!user && (
                <Button size="lg" variant="outline" asChild>
                  <Link to="/login">I already have an account</Link>
                </Button>
              )}
            </div>
            <ul className="mt-8 space-y-2">
              {POINTS.map((p) => (
                <li key={p.text} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <p.icon aria-hidden className="size-4 text-rose-500" /> {p.text}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="how-it-works" className="border-t border-white/70 bg-white/35 backdrop-blur">
          <div className="mx-auto max-w-5xl px-4 py-14">
            <h2 id="how-it-works" className="text-2xl font-bold tracking-tight">
              How it works
            </h2>
            <ol className="mt-6 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title}>
                  <Card className="h-full p-5">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-brand text-white shadow-md shadow-rose-500/25">
                        <step.icon aria-hidden className="size-5" />
                      </span>
                      <span className="text-sm font-medium text-muted-foreground">Step {i + 1}</span>
                    </div>
                    <h3 className="mt-4 font-semibold">{step.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-4 py-8 text-sm text-muted-foreground">
        © {new Date().getFullYear()} {APP_NAME} · {APP_TAGLINE}
      </footer>
    </div>
  )
}
