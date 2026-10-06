import { APP_NAME } from '@/config/app'
import { env } from '@/lib/env'

/**
 * Only allow same-origin relative paths as post-login redirect targets
 * (prevents open redirects like ?next=//evil.example).
 */
export function safeNextPath(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next) return fallback
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback
  if (/[\r\n\t]/.test(next) || /^\/+[a-z][a-z0-9+.-]*:/i.test(next)) return fallback
  return next
}

/** Link to a login/signup page that returns to `next` afterwards. */
export function authPath(page: 'login' | 'signup', next?: string): string {
  const safe = next ? safeNextPath(next, '') : ''
  return safe ? `/${page}?next=${encodeURIComponent(safe)}` : `/${page}`
}

export function inviteUrl(inviteToken: string, baseUrl: string = env.appUrl): string {
  return `${baseUrl}/join/${encodeURIComponent(inviteToken)}`
}

export function whatsappShareUrl(groupName: string, link: string): string {
  const message = `Join our ${APP_NAME} group: ${groupName}\n\nJoin here:\n${link}`
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}
