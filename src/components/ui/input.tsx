import * as React from 'react'
import { cn } from '@/lib/utils'

const fieldClasses =
  'w-full min-w-0 rounded-xl border border-rose-200/80 bg-white/80 text-base shadow-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return <input type={type} data-slot="input" className={cn('flex h-10 px-3 py-2', fieldClasses, className)} {...props} />
}

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={cn('flex min-h-20 px-3 py-2', fieldClasses, className)} {...props} />
}

export { Input, Textarea, fieldClasses }
