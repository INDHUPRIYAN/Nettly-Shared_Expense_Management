import { z } from 'zod'
import { CATEGORY_IDS } from '@/lib/categories'
import { CURRENCY_CODES, MAX_AMOUNT, parseMoney, type CurrencyCode } from '@/lib/settlement'

/* Zod schemas for every user input. The database enforces the same rules;
 * validating here gives instant, friendly feedback. */

const name = z
  .string()
  .trim()
  .min(1, 'Enter your name.')
  .max(80, 'Keep it under 80 characters.')

export const signupSchema = z.object({
  name,
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.')),
  password: z
    .string()
    .min(8, 'Use at least 8 characters.')
    .max(72, 'Use at most 72 characters.'),
})
export type SignupInput = z.infer<typeof signupSchema>

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.')),
  password: z.string().min(1, 'Enter your password.'),
})
export type LoginInput = z.infer<typeof loginSchema>

export const profileSchema = z.object({ name })

/** Group nickname: empty means "use the account name". */
export const memberNameSchema = z.object({
  name: z.string().trim().max(80, 'Keep it under 80 characters.'),
})
export type ProfileInput = z.infer<typeof profileSchema>

export const currencySchema = z.enum(CURRENCY_CODES as [CurrencyCode, ...CurrencyCode[]], 'Choose a currency.')

export const groupSchema = z.object({
  name: z.string().trim().min(1, 'Give your group a name.').max(80, 'Keep it under 80 characters.'),
  description: z
    .string()
    .trim()
    .max(500, 'Keep it under 500 characters.')
    .transform((v) => (v === '' ? null : v)),
  currency: currencySchema,
})
export type GroupInput = z.infer<typeof groupSchema>

/** Parsed money input: string as typed -> integer minor units. */
export const moneyInputSchema = z
  .string()
  .trim()
  .min(1, 'Enter an amount.')
  .transform((value, ctx) => {
    const parsed = parseMoney(value)
    if (parsed === null) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid amount (up to 2 decimals).' })
      return z.NEVER
    }
    return parsed
  })
  .refine((v) => v > 0, 'Amount must be greater than zero.')
  .refine((v) => v <= MAX_AMOUNT, 'That amount is too large.')

export const expenseDetailsSchema = z.object({
  title: z.string().trim().min(1, 'Add a title.').max(100, 'Keep the title under 100 characters.'),
  description: z
    .string()
    .trim()
    .max(500, 'Keep it under 500 characters.')
    .transform((v) => (v === '' ? null : v)),
  amount: moneyInputSchema,
  paidBy: z.string().min(1, 'Choose who paid.'),
  category: z.enum(CATEGORY_IDS, 'Choose a category.'),
  splitType: z.enum(['equal', 'custom', 'percentage', 'shares']),
  expenseDate: z.iso.date('Choose a valid date.'),
})
export type ExpenseDetailsInput = z.infer<typeof expenseDetailsSchema>

export const settlementSchema = z
  .object({
    fromUser: z.string().min(1),
    toUser: z.string().min(1),
    amount: z.number().int().positive('Amount must be greater than zero.').max(MAX_AMOUNT, 'That amount is too large.'),
    note: z
      .string()
      .trim()
      .max(200, 'Keep the note under 200 characters.')
      .transform((v) => (v === '' ? null : v)),
  })
  .refine((s) => s.fromUser !== s.toUser, { message: "Someone can't pay themselves.", path: ['toUser'] })
export type SettlementInput = z.infer<typeof settlementSchema>

/** Flatten Zod issues into { field: firstMessage }. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form'
    if (!(key in result)) result[key] = issue.message
  }
  return result
}
