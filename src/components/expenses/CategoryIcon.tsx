import { getCategory } from '@/lib/categories'
import { cn } from '@/lib/utils'

export function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const { icon: Icon, tone, label } = getCategory(category)
  return (
    <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', tone, className)} title={label}>
      <Icon aria-hidden className="size-5" />
      <span className="sr-only">{label}</span>
    </span>
  )
}
