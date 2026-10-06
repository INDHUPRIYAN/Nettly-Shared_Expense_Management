import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import * as React from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-brand text-white shadow-md shadow-rose-500/25 hover:shadow-lg hover:shadow-rose-500/35 hover:brightness-105 active:brightness-95',
        destructive: 'bg-red-600 text-white shadow-md shadow-red-600/25 hover:bg-red-700',
        outline: 'border border-rose-200/80 bg-white/70 backdrop-blur hover:bg-rose-50 hover:text-rose-700',
        secondary: 'bg-rose-100/80 text-rose-700 hover:bg-rose-100',
        ghost: 'hover:bg-rose-50 hover:text-rose-700',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 rounded-xl px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-12 rounded-xl px-6 text-base',
        icon: 'size-10',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps extends React.ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button'
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
