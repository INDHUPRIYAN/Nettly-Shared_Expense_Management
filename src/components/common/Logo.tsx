import { useId } from 'react'
import { Link } from 'react-router'
import { APP_NAME } from '@/config/app'
import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn('size-8 shrink-0 drop-shadow-[0_4px_10px_rgb(225_29_72/0.35)]', className)}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fb7185" />
          <stop offset="0.5" stopColor="#e11d48" />
          <stop offset="1" stopColor="#dc2626" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#${id})`} />
      <path d="M18 46V18h6l16 18V18h6v28h-6L24 28v18z" fill="#fff" />
    </svg>
  )
}

export function Logo({ to = '/', className }: { to?: string; className?: string }) {
  return (
    <Link
      to={to}
      className={cn('inline-flex items-center gap-2 rounded-lg font-semibold tracking-tight focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none', className)}
    >
      <LogoMark />
      <span className="text-lg">{APP_NAME}</span>
    </Link>
  )
}
