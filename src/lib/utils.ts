import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Initials for avatars: "Indhu Priyan" -> "IP". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? '?'
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

const dateFormatter = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' })
const dateYearFormatter = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

/** "8 Oct" (this year) or "8 Oct 2025". */
export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.getFullYear() === new Date().getFullYear() ? dateFormatter.format(date) : dateYearFormatter.format(date)
}

/** yyyy-mm-dd in the user's local time zone, for <input type="date">. */
export function toDateInputValue(value: string | Date = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Convert a yyyy-mm-dd date input to an ISO timestamp at local noon (avoids day shifts across time zones). */
export function dateInputToIso(value: string): string {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0).toISOString()
}
