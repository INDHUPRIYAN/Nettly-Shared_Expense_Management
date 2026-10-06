import { HandCoins, History, Home, ReceiptText, Settings, Users } from 'lucide-react'
import { NavLink } from 'react-router'
import { cn } from '@/lib/utils'

const ITEMS = [
  { to: '', label: 'Overview', short: 'Home', icon: Home, end: true },
  { to: 'expenses', label: 'Expenses', short: 'Expenses', icon: ReceiptText, end: false },
  { to: 'settlements', label: 'Settle up', short: 'Settle', icon: HandCoins, end: false },
  { to: 'members', label: 'Members', short: 'Members', icon: Users, end: false },
  { to: 'history', label: 'History', short: 'History', icon: History, end: false },
] as const

/** Desktop/tablet tab bar. */
export function GroupTabs({ groupId }: { groupId: string }) {
  return (
    <nav aria-label="Group sections" className="hidden border-b border-rose-200/60 md:block">
      <ul className="-mb-px flex gap-1">
        {[...ITEMS, { to: 'settings', label: 'Settings', short: 'Settings', icon: Settings, end: false }].map((item) => (
          <li key={item.label}>
            <NavLink
              to={`/groups/${groupId}${item.to ? `/${item.to}` : ''}`}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                  isActive ? 'border-rose-500 text-rose-700' : 'border-transparent text-muted-foreground hover:text-rose-700',
                )
              }
            >
              <item.icon aria-hidden className="size-4" />
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Mobile bottom navigation. */
export function GroupBottomNav({ groupId }: { groupId: string }) {
  return (
    <nav
      aria-label="Group sections"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/70 bg-white/65 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-12px_rgb(225_29_72/0.25)] backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {ITEMS.map((item) => (
          <li key={item.label}>
            <NavLink
              to={`/groups/${groupId}${item.to ? `/${item.to}` : ''}`}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors focus-visible:bg-accent focus-visible:outline-none',
                  isActive ? 'text-rose-600' : 'text-muted-foreground',
                )
              }
            >
              <item.icon aria-hidden className="size-5" />
              {item.short}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
