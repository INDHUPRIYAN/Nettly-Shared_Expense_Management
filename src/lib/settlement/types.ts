/**
 * Integer amount in minor currency units (paise for INR, cents for USD).
 * ₹100.50 is represented as 10050. Never a fractional number.
 */
export type Money = number

export type UserId = string

export type SplitType = 'equal' | 'custom' | 'percentage' | 'shares'

export type SettlementStatus = 'pending' | 'paid' | 'cancelled'

/** One participant's share of an expense. */
export interface SplitShare {
  userId: UserId
  amount: Money
  /** Raw percentage / share count used to derive `amount` (informational). */
  weight?: number | null
}

/** Minimal expense shape needed by the balance engine. */
export interface LedgerExpense {
  id?: string
  paidBy: UserId
  amount: Money
  splits: ReadonlyArray<Pick<SplitShare, 'userId' | 'amount'>>
}

/** Minimal settlement shape needed by the balance engine. */
export interface LedgerSettlement {
  fromUser: UserId
  toUser: UserId
  amount: Money
  status: SettlementStatus
}

export interface MemberBalance {
  userId: UserId
  /** Total this member paid for expenses. */
  paid: Money
  /** Total of this member's shares across expenses. */
  share: Money
  /** Settlement payments this member has made (status = paid). */
  sent: Money
  /** Settlement payments this member has received (status = paid). */
  received: Money
  /**
   * paid - share + sent - received.
   * Positive: should receive money. Negative: owes money. Zero: settled.
   */
  net: Money
}

/** A suggested payment: `from` pays `to` the given amount. */
export interface Transfer {
  from: UserId
  to: UserId
  amount: Money
}
