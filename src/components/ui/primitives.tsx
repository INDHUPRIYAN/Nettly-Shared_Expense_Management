import { cva, type VariantProps } from 'class-variance-authority'
import { CheckIcon, ChevronDown } from 'lucide-react'
import { Avatar as AvatarPrimitive, Checkbox as CheckboxPrimitive, Label as LabelPrimitive } from 'radix-ui'
import * as React from 'react'
import { cn } from '@/lib/utils'
import { fieldClasses } from './input'

/* ----------------------------------------------------------------------------
 * Small shadcn/ui-style primitives grouped in one module.
 * ------------------------------------------------------------------------- */

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn('flex items-center gap-2 text-sm leading-none font-medium select-none', className)}
      {...props}
    />
  )
}

/** Native <select> styled like inputs — the best behaviour on mobile and for screen readers. */
export function NativeSelect({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select data-slot="select" className={cn('flex h-10 appearance-none py-2 pr-9 pl-3', fieldClasses, className)} {...props}>
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  )
}

export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card" className={cn('glass rounded-3xl text-card-foreground', className)} {...props} />
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-header" className={cn('flex flex-col gap-1 p-5 pb-0', className)} {...props} />
}

export function CardTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <h2 data-slot="card-title" className={cn('text-base leading-tight font-semibold', className)} {...props} />
}

export function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p data-slot="card-description" className={cn('text-sm text-muted-foreground', className)} {...props} />
}

export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('p-5', className)} {...props} />
}

export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="skeleton" aria-hidden className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
}

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-rose-100 text-rose-700',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'text-muted-foreground',
        positive: 'border-transparent bg-positive-soft text-positive',
        negative: 'border-transparent bg-negative-soft text-negative',
        pending: 'border-transparent bg-pending-soft text-pending',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer size-5 shrink-0 cursor-pointer rounded-md border border-rose-300 bg-white shadow-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-transparent data-[state=checked]:bg-brand data-[state=checked]:text-white',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <CheckIcon className="size-3.5" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export function Avatar({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root data-slot="avatar" className={cn('relative flex size-9 shrink-0 overflow-hidden rounded-full', className)} {...props} />
  )
}

export function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return <AvatarPrimitive.Image className={cn('aspect-square size-full object-cover', className)} {...props} />
}

export function AvatarFallback({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      className={cn('flex size-full items-center justify-center rounded-full text-xs font-semibold', className)}
      {...props}
    />
  )
}

/** Label + control + hint/error wiring with correct aria attributes. */
export function Field({
  id,
  label,
  hint,
  error,
  optional,
  className,
  children,
}: {
  id: string
  label: React.ReactNode
  hint?: React.ReactNode
  error?: string | null
  optional?: boolean
  className?: string
  children: (aria: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => React.ReactNode
}) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('grid gap-2', className)}>
      <Label htmlFor={id}>
        {label}
        {optional && <span className="font-normal text-muted-foreground">(optional)</span>}
      </Label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
