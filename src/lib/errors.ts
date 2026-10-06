/**
 * Maps errors from Supabase (Auth, PostgREST, our own SQL business rules) and
 * the network into short, human-friendly messages. Raw database messages are
 * never shown to users.
 */

/** Business-rule codes raised by our SQL functions and triggers. */
const DB_MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: 'Please log in to continue.',
  NOT_A_MEMBER: "You're not a member of this group.",
  NOT_AUTHORIZED: "You don't have permission to do that.",
  GROUP_NOT_FOUND: 'This group no longer exists.',
  INVITE_INVALID: 'This invite link is invalid or expired.',
  INVALID_INPUT: 'Some of the details are invalid. Please check and try again.',
  INVALID_AMOUNT: 'Enter an amount greater than zero.',
  INVALID_ROLE: 'That role is not available.',
  PAYER_NOT_MEMBER: 'The person who paid must be a current group member.',
  PARTICIPANT_NOT_MEMBER: 'Everyone in the split must be a current group member.',
  SPLIT_EMPTY: 'Select at least one person to split with.',
  SPLIT_TOTAL_MISMATCH: "The split doesn't add up to the total amount.",
  SPLIT_DUPLICATE_PARTICIPANT: 'A person can only appear once in a split.',
  SPLIT_INVALID_AMOUNT: 'Split amounts must be zero or more.',
  EXPENSE_NOT_FOUND: 'This expense no longer exists.',
  EXPENSE_LOCKED: "This expense involves someone who has left the group, so it can't be changed.",
  EXPENSE_IMMUTABLE_FIELD: "That detail of an expense can't be changed.",
  CURRENCY_LOCKED: "The currency can't be changed after expenses or payments have been added.",
  SETTLEMENT_INVALID_TRANSITION: 'This payment has already been updated.',
  SETTLEMENT_IMMUTABLE_FIELD: "Payment details can't be changed once recorded.",
  SETTLEMENT_PARTY_NOT_MEMBER: 'Both people in a payment must be current group members.',
  CANNOT_REMOVE_OWNER: "The group owner can't be removed.",
  MEMBER_NOT_FOUND: 'That person is not a member of this group anymore.',
  MEMBER_HAS_BALANCE: 'This member still has an unsettled balance. Settle up first.',
  MEMBER_HAS_PENDING_SETTLEMENTS: 'This member has pending payments. Resolve them first.',
  RATE_LIMITED: 'Too many attempts. Please wait a while and try again.',
}

/** Supabase Auth error codes. */
const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  user_already_exists: 'An account with this email already exists. Try logging in.',
  email_exists: 'An account with this email already exists. Try logging in.',
  weak_password: 'Choose a stronger password (at least 8 characters).',
  email_not_confirmed: 'Please confirm your email address first — check your inbox.',
  over_request_rate_limit: 'Too many attempts. Please wait a moment and try again.',
  over_email_send_rate_limit: 'Too many emails sent. Please wait a few minutes.',
  signup_disabled: 'New sign-ups are currently disabled.',
  email_address_invalid: 'Enter a valid email address.',
  session_not_found: 'Your session expired. Please log in again.',
  refresh_token_not_found: 'Your session expired. Please log in again.',
  user_not_found: 'Incorrect email or password.',
}

/** Postgres / PostgREST error codes. */
const SQLSTATE_MESSAGES: Record<string, string> = {
  '42501': "You don't have permission to do that.",
  '23505': 'That already exists.',
  '23503': 'Something this depends on no longer exists.',
  '23514': 'Some of the details are invalid. Please check and try again.',
  '22P02': 'Some of the details are invalid. Please check and try again.',
  PGRST301: 'Your session expired. Please log in again.',
  PGRST303: 'Your session expired. Please log in again.',
  PGRST116: "We couldn't find that. It may have been deleted.",
}

export const GENERIC_ERROR = 'Something went wrong. Please try again.'
export const NETWORK_ERROR = "Can't reach the server. Check your connection and try again."

/** An error whose message is already safe to show to users. */
export class AppError extends Error {
  override name = 'AppError'
  readonly code: string | undefined
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

interface ErrorLike {
  message?: unknown
  code?: unknown
  name?: unknown
  status?: unknown
}

function asErrorLike(error: unknown): ErrorLike | null {
  return typeof error === 'object' && error !== null ? (error as ErrorLike) : null
}

/** Stable error code if one can be determined (business rule, auth code or SQLSTATE). */
export function getErrorCode(error: unknown): string | undefined {
  if (error instanceof AppError) return error.code
  const e = asErrorLike(error)
  if (!e) return undefined
  const message = typeof e.message === 'string' ? e.message.trim() : ''
  if (message in DB_MESSAGES) return message
  return typeof e.code === 'string' ? e.code : undefined
}

export function isNetworkError(error: unknown): boolean {
  const e = asErrorLike(error)
  if (!e) return false
  const message = typeof e.message === 'string' ? e.message : ''
  return (
    e.name === 'AuthRetryableFetchError' ||
    (e.name === 'TypeError' && /fetch|network|load failed/i.test(message)) ||
    /Failed to fetch|NetworkError|Load failed|ERR_NETWORK|ECONNREFUSED/i.test(message)
  )
}

/** A user-facing message for any error. Never returns raw database text. */
export function getErrorMessage(error: unknown, fallback = GENERIC_ERROR): string {
  if (!error) return fallback
  if (error instanceof AppError) return error.message
  if (isNetworkError(error)) return NETWORK_ERROR

  const e = asErrorLike(error)
  if (!e) return fallback
  const message = typeof e.message === 'string' ? e.message.trim() : ''
  const code = typeof e.code === 'string' ? e.code : ''

  if (DB_MESSAGES[message]) return DB_MESSAGES[message]
  if (AUTH_MESSAGES[code]) return AUTH_MESSAGES[code]
  if (SQLSTATE_MESSAGES[code]) return SQLSTATE_MESSAGES[code]
  if (/jwt expired|invalid jwt|refresh token/i.test(message)) return 'Your session expired. Please log in again.'
  if (/invalid login credentials/i.test(message)) return AUTH_MESSAGES.invalid_credentials!
  if (/already registered/i.test(message)) return AUTH_MESSAGES.user_already_exists!
  if (e.status === 429) return AUTH_MESSAGES.over_request_rate_limit!
  return fallback
}

/** Throw a friendly AppError if a Supabase call failed. */
export function throwIfError(error: unknown, fallback?: string): void {
  if (error) throw new AppError(getErrorMessage(error, fallback), getErrorCode(error))
}
