import { LayoutGrid, LogOut, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { Logo } from '@/components/common/Logo'
import { MemberAvatar } from '@/components/common/MemberAvatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/menu'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

export function UserMenu() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  if (!user) return null
  const name = profile?.name ?? user.email ?? 'You'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
          <MemberAvatar name={name} avatarUrl={profile?.avatar_url} seed={user.id} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          <span className="block truncate font-medium text-foreground">{name}</span>
          <span className="block truncate">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/dashboard')}>
          <LayoutGrid /> Your groups
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/profile')}>
          <UserRound /> Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            // Leave protected pages first so the auth guard can't race the redirect.
            navigate('/', { replace: true })
            void signOut()
          }}
        >
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Authenticated page chrome: sticky header + centred content column. */
export function AppShell({
  children,
  bottomNav,
  className,
}: {
  children: ReactNode
  bottomNav?: ReactNode
  className?: string
}) {
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-white/70 bg-white/55 shadow-[0_4px_24px_-12px_rgb(225_29_72/0.25)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Logo to="/dashboard" />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
              <Link to="/dashboard">Groups</Link>
            </Button>
            <UserMenu />
          </div>
        </div>
      </header>
      <main id="main" className={cn('mx-auto max-w-5xl px-4 py-5 sm:py-8', bottomNav ? 'pb-28 md:pb-10' : 'pb-12', className)}>
        {children}
      </main>
      {bottomNav}
    </div>
  )
}
