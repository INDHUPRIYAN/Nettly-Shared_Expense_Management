import { DropdownMenu as MenuPrimitive, RadioGroup as RadioPrimitive } from 'radix-ui'
import * as React from 'react'
import { cn } from '@/lib/utils'

export const DropdownMenu = MenuPrimitive.Root
export const DropdownMenuTrigger = MenuPrimitive.Trigger

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  align = 'end',
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          'z-50 min-w-48 overflow-hidden rounded-2xl glass-strong p-1 text-popover-foreground data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  )
}

export function DropdownMenuItem({
  className,
  destructive,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Item> & { destructive?: boolean }) {
  return (
    <MenuPrimitive.Item
      className={cn(
        "relative flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-rose-50 [&_svg:not([class*='size-'])]:size-4",
        destructive && 'text-destructive data-[highlighted]:bg-destructive/10',
        className,
      )}
      {...props}
    />
  )
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof MenuPrimitive.Label>) {
  return <MenuPrimitive.Label className={cn('px-2.5 py-1.5 text-xs text-muted-foreground', className)} {...props} />
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
}

/** Segmented control with radio-group semantics (arrow keys move between options). */
export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
}: {
  value: T
  onValueChange: (value: T) => void
  options: ReadonlyArray<{ value: T; label: React.ReactNode }>
  label: string
  className?: string
}) {
  return (
    <RadioPrimitive.Root
      aria-label={label}
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      className={cn('grid auto-cols-fr grid-flow-col gap-1 rounded-2xl bg-rose-100/60 p-1', className)}
    >
      {options.map((option) => (
        <RadioPrimitive.Item
          key={option.value}
          value={option.value}
          className="cursor-pointer rounded-xl px-2 py-2 text-sm font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=checked]:bg-white data-[state=checked]:text-rose-700 data-[state=checked]:shadow-sm"
        >
          {option.label}
        </RadioPrimitive.Item>
      ))}
    </RadioPrimitive.Root>
  )
}
