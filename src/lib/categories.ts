import {
  BookOpen,
  Car,
  Film,
  HeartPulse,
  Hotel,
  Lightbulb,
  Package,
  ShoppingBag,
  ShoppingCart,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'

/** Must match the CHECK constraint on public.expenses.category. */
export const CATEGORIES = [
  { id: 'food', label: 'Food & drinks', icon: UtensilsCrossed, tone: 'bg-orange-500/12 text-orange-700 dark:text-orange-300' },
  { id: 'transport', label: 'Transport', icon: Car, tone: 'bg-sky-500/12 text-sky-700 dark:text-sky-300' },
  { id: 'accommodation', label: 'Accommodation', icon: Hotel, tone: 'bg-violet-500/12 text-violet-700 dark:text-violet-300' },
  { id: 'entertainment', label: 'Activities', icon: Film, tone: 'bg-pink-500/12 text-pink-700 dark:text-pink-300' },
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag, tone: 'bg-fuchsia-500/12 text-fuchsia-700 dark:text-fuchsia-300' },
  { id: 'groceries', label: 'Groceries', icon: ShoppingCart, tone: 'bg-lime-500/15 text-lime-700 dark:text-lime-300' },
  { id: 'utilities', label: 'Bills & utilities', icon: Lightbulb, tone: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300' },
  { id: 'medical', label: 'Medical', icon: HeartPulse, tone: 'bg-red-500/12 text-red-700 dark:text-red-300' },
  { id: 'education', label: 'Education', icon: BookOpen, tone: 'bg-indigo-500/12 text-indigo-700 dark:text-indigo-300' },
  { id: 'other', label: 'Other', icon: Package, tone: 'bg-slate-500/12 text-slate-700 dark:text-slate-300' },
] as const satisfies ReadonlyArray<{ id: string; label: string; icon: LucideIcon; tone: string }>

export type CategoryId = (typeof CATEGORIES)[number]['id']

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]]

export function getCategory(id: string) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]!
}

export function isCategoryId(id: string): id is CategoryId {
  return CATEGORIES.some((c) => c.id === id)
}
