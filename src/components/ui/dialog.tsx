import { XIcon } from 'lucide-react'
import { AlertDialog as AlertPrimitive, Dialog as DialogPrimitive } from 'radix-ui'
import * as React from 'react'
import { cn } from '@/lib/utils'
import { buttonVariants } from './button'

/* Dialogs render as a bottom sheet on phones and a centred modal from `sm` up. */

const overlayClasses =
  'fixed inset-0 z-50 bg-rose-950/25 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0'

const contentClasses =
  'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col gap-4 overflow-y-auto rounded-t-3xl glass-strong p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-8 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:p-6 sm:data-[state=open]:zoom-in-95 sm:data-[state=open]:slide-in-from-bottom-0'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export function DialogContent({
  className,
  children,
  hideClose,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { hideClose?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlayClasses} />
      <DialogPrimitive.Content data-slot="dialog-content" className={cn(contentClasses, className)} {...props}>
        {children}
        {!hideClose && (
          <DialogPrimitive.Close
            className="absolute top-4 right-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            aria-label="Close"
          >
            <XIcon className="size-5" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1.5 pr-8', className)} {...props} />
}

export function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
}

export function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('text-lg leading-tight font-semibold', className)} {...props} />
}

export function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('text-sm text-muted-foreground', className)} {...props} />
}

/* Alert dialog: for confirmations. Focus starts on Cancel. */

export const AlertDialog = AlertPrimitive.Root

export function AlertDialogContent({ className, ...props }: React.ComponentProps<typeof AlertPrimitive.Content>) {
  return (
    <AlertPrimitive.Portal>
      <AlertPrimitive.Overlay className={overlayClasses} />
      <AlertPrimitive.Content className={cn(contentClasses, 'sm:max-w-md', className)} {...props} />
    </AlertPrimitive.Portal>
  )
}

export function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof AlertPrimitive.Title>) {
  return <AlertPrimitive.Title className={cn('text-lg font-semibold', className)} {...props} />
}

export function AlertDialogDescription({ className, ...props }: React.ComponentProps<typeof AlertPrimitive.Description>) {
  return <AlertPrimitive.Description className={cn('text-sm text-muted-foreground', className)} {...props} />
}

export function AlertDialogCancel({ className, ...props }: React.ComponentProps<typeof AlertPrimitive.Cancel>) {
  return <AlertPrimitive.Cancel className={cn(buttonVariants({ variant: 'outline' }), className)} {...props} />
}
