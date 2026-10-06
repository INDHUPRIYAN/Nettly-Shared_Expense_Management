import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/primitives'
import { cn, initials } from '@/lib/utils'

/* Deterministic, accessible avatar colours picked from the name. */
const TONES = [
  'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-100',
  'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-100',
  'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-100',
  'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-100',
  'bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-100',
  'bg-lime-100 text-lime-800 dark:bg-lime-900/60 dark:text-lime-100',
]

function toneFor(seed: string) {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return TONES[hash % TONES.length]
}

export function MemberAvatar({
  name,
  avatarUrl,
  seed,
  size = 'md',
  className,
}: {
  name: string
  avatarUrl?: string | null
  seed?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizeClass = size === 'sm' ? 'size-7 text-[10px]' : size === 'lg' ? 'size-12 text-sm' : 'size-9'
  return (
    <Avatar className={cn(sizeClass, className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
      <AvatarFallback className={toneFor(seed ?? name)} aria-hidden>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
