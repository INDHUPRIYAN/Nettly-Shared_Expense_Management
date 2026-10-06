import { Check, Copy, Link2, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useClipboard } from '@/hooks/useClipboard'
import { inviteUrl, whatsappShareUrl } from '@/lib/navigation'
import { cn } from '@/lib/utils'

/** Invite friends: copy link, share to WhatsApp, show the short code. */
export function InvitePanel({
  groupName,
  inviteToken,
  inviteCode,
  className,
  compact = false,
}: {
  groupName: string
  inviteToken: string
  inviteCode: string
  className?: string
  compact?: boolean
}) {
  const link = inviteUrl(inviteToken)
  const linkCopy = useClipboard()
  const codeCopy = useClipboard()

  return (
    <div className={cn('space-y-4', className)}>
      {!compact && (
        <div>
          <h3 className="font-semibold">Invite friends</h3>
          <p className="text-sm text-muted-foreground">Anyone with this link can join after signing in.</p>
        </div>
      )}
      <div className="flex items-center gap-2 rounded-xl border bg-muted/50 px-3 py-2">
        <Link2 aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm text-muted-foreground" data-testid="invite-link">
          {link}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button onClick={() => void linkCopy.copy(link, 'Invite link copied')}>
          {linkCopy.copied ? <Check /> : <Copy />}
          {linkCopy.copied ? 'Link copied' : 'Copy invite link'}
        </Button>
        <Button variant="outline" asChild>
          <a href={whatsappShareUrl(groupName, link)} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="text-[#25D366]" />
            Share on WhatsApp
          </a>
        </Button>
      </div>
      <div className="flex items-center justify-between rounded-xl border px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground">Invite code</p>
          <p className="font-mono text-lg font-semibold tracking-[0.25em]" data-testid="invite-code">
            {inviteCode}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void codeCopy.copy(inviteCode, 'Invite code copied')}
          aria-label="Copy invite code"
        >
          {codeCopy.copied ? <Check /> : <Copy />}
          Copy
        </Button>
      </div>
    </div>
  )
}
