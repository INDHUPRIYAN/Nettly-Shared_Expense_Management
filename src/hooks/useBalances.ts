import { useGroupContext } from '@/providers/GroupContext'

/**
 * Balances for the open group. Calculated once per data change in
 * <GroupProvider>, so components can call this freely without recomputing.
 */
export function useBalances() {
  const { balances, balanceOf, transfers, mine, totalSpent } = useGroupContext()
  return { balances, balanceOf, transfers, mine, totalSpent }
}
