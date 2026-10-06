import { beforeAll, describe, expect, it } from 'vitest'
import { calculateBalances, simplifyDebts } from '../../src/lib/settlement'
import {
  addExpense,
  admin,
  anonClient,
  createGroup,
  createTestUser,
  equalSplits,
  join,
  type TestUser,
} from './helpers'

const R = (rupees: number) => rupees * 100

describe('profiles', () => {
  it('creates a profile automatically on signup, readable by its owner', async () => {
    const indhu = await createTestUser('Indhu')
    const { data, error } = await indhu.client.from('profiles').select('id, name').eq('id', indhu.id).single()
    expect(error).toBeNull()
    expect(data).toMatchObject({ id: indhu.id, name: 'Indhu' })
    // The email is stored but is private: clients cannot select it, even their own.
    const { data: stored } = await admin.from('profiles').select('email').eq('id', indhu.id).single()
    expect(stored?.email).toBe(indhu.email)
    const hidden = await indhu.client.from('profiles').select('email').eq('id', indhu.id)
    expect(hidden.error?.code).toBe('42501')
  })

  it('users can update their own name but not their email or other profiles', async () => {
    const a = await createTestUser('Alpha')
    const b = await createTestUser('Bravo')
    const own = await a.client.from('profiles').update({ name: 'Alpha Prime' }).eq('id', a.id).select('name').single()
    expect(own.data?.name).toBe('Alpha Prime')

    const other = await a.client.from('profiles').update({ name: 'Hacked' }).eq('id', b.id).select('id')
    expect(other.data).toEqual([])

    // Column-level privileges: email is not writable from the client.
    const email = await a.client.from('profiles').update({ email: 'x@y.z' } as never).eq('id', a.id)
    expect(email.error?.code).toBe('42501')
  })

  it('profiles of strangers are not visible', async () => {
    const a = await createTestUser('Stranger1')
    const b = await createTestUser('Stranger2')
    const { data } = await a.client.from('profiles').select('id').eq('id', b.id)
    expect(data).toEqual([])
  })
})

describe('groups and invites', () => {
  it('create_group makes the creator the owner and generates invite token + code', async () => {
    const owner = await createTestUser('Owner')
    const group = await createGroup(owner, 'Delhi Trip 2026')
    expect(group.invite_token).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(group.invite_code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
    expect(group.created_by).toBe(owner.id)
    const { data: members } = await owner.client.from('group_members').select('user_id, role').eq('group_id', group.id)
    expect(members).toEqual([{ user_id: owner.id, role: 'owner' }])
  })

  it('rejects an empty group name', async () => {
    const owner = await createTestUser('Owner')
    const { error } = await owner.client.rpc('create_group', { p_name: '   ' })
    expect(error?.message).toBe('INVALID_INPUT')
  })

  it('clients cannot insert groups directly or forge invite tokens', async () => {
    const user = await createTestUser('Forger')
    const { error } = await user.client.from('groups').insert({ name: 'x', invite_token: 'a', invite_code: 'AAAAAA' } as never)
    expect(error).not.toBeNull()
    const owner = await createTestUser('Owner')
    const group = await createGroup(owner)
    const forge = await owner.client.from('groups').update({ invite_token: 'chosen-token-value' } as never).eq('id', group.id)
    expect(forge.error?.code).toBe('42501')
  })

  it('invite preview works while logged out; invalid tokens return nothing', async () => {
    const owner = await createTestUser('Indhu')
    const group = await createGroup(owner, 'Preview Trip')
    const anon = anonClient()
    const { data } = await anon.rpc('get_invite_preview', { p_token: group.invite_token })
    expect(data?.[0]).toMatchObject({ name: 'Preview Trip', creator_name: 'Indhu', member_count: 1, is_member: false })

    const invalid = await anon.rpc('get_invite_preview', { p_token: 'definitely-not-a-valid-token-123' })
    expect(invalid.data).toEqual([])
  })

  it('join_group joins once and protects against duplicate membership', async () => {
    const owner = await createTestUser('Owner')
    const friend = await createTestUser('Friend')
    const group = await createGroup(owner)
    expect(await join(friend, group.invite_token)).toMatchObject({ group_id: group.id, status: 'joined' })
    expect(await join(friend, group.invite_token)).toMatchObject({ status: 'already_member' })
    const { data } = await owner.client.from('group_members').select('user_id').eq('group_id', group.id)
    expect(data).toHaveLength(2)
  })

  it('rejects invalid invite tokens', async () => {
    const user = await createTestUser('Joiner')
    const { error } = await user.client.rpc('join_group', { p_token: 'nope-nope-nope-nope-nope' })
    expect(error?.message).toBe('INVITE_INVALID')
  })

  it('anonymous users cannot join', async () => {
    const owner = await createTestUser('Owner')
    const group = await createGroup(owner)
    const { error } = await anonClient().rpc('join_group', { p_token: group.invite_token })
    expect(error).not.toBeNull()
  })

  it('find_invite_by_code resolves the short code', async () => {
    const owner = await createTestUser('Owner')
    const other = await createTestUser('Other')
    const group = await createGroup(owner)
    const { data } = await other.client.rpc('find_invite_by_code', { p_code: group.invite_code.toLowerCase() })
    expect(data).toBe(group.invite_token)
  })

  it('regenerating the invite invalidates the old link (admins only)', async () => {
    const owner = await createTestUser('Owner')
    const member = await createTestUser('Member')
    const group = await createGroup(owner)
    await join(member, group.invite_token)

    const denied = await member.client.rpc('regenerate_invite', { p_group_id: group.id })
    expect(denied.error?.message).toBe('NOT_AUTHORIZED')

    const { data: updated } = await owner.client.rpc('regenerate_invite', { p_group_id: group.id })
    expect(updated?.invite_token).not.toBe(group.invite_token)
    const late = await createTestUser('Late')
    const { error } = await late.client.rpc('join_group', { p_token: group.invite_token })
    expect(error?.message).toBe('INVITE_INVALID')
  })

  it('only owner/admin can edit settings; only the owner can delete', async () => {
    const owner = await createTestUser('Owner')
    const member = await createTestUser('Member')
    const group = await createGroup(owner)
    await join(member, group.invite_token)

    const memberEdit = await member.client.from('groups').update({ name: 'Mine now' }).eq('id', group.id).select()
    expect(memberEdit.data).toEqual([])
    const memberDelete = await member.client.from('groups').delete().eq('id', group.id).select()
    expect(memberDelete.data).toEqual([])

    const ownerEdit = await owner.client.from('groups').update({ name: ' Renamed ' }).eq('id', group.id).select().single()
    expect(ownerEdit.data?.name).toBe('Renamed')
  })

  it('currency cannot change once money is recorded', async () => {
    const owner = await createTestUser('Owner')
    const group = await createGroup(owner)
    const before = await owner.client.from('groups').update({ currency: 'USD' }).eq('id', group.id).select().single()
    expect(before.data?.currency).toBe('USD')
    await addExpense(owner, group.id, { title: 'x', amount: 100, paidBy: owner.id, splits: equalSplits(100, [owner.id]) })
    const after = await owner.client.from('groups').update({ currency: 'INR' }).eq('id', group.id)
    expect(after.error?.message).toBe('CURRENCY_LOCKED')
  })
})

describe('group isolation (RLS)', () => {
  let owner: TestUser
  let outsider: TestUser
  let groupId: string

  beforeAll(async () => {
    owner = await createTestUser('Owner')
    outsider = await createTestUser('Outsider')
    const group = await createGroup(owner, 'Private Group')
    groupId = group.id
    const { error } = await addExpense(owner, groupId, {
      title: 'Secret dinner',
      amount: 1000,
      paidBy: owner.id,
      splits: equalSplits(1000, [owner.id]),
    })
    expect(error).toBeNull()
  })

  it('outsiders see nothing', async () => {
    for (const table of ['groups', 'group_members', 'expenses', 'expense_splits', 'settlements'] as const) {
      const column = table === 'groups' ? 'id' : 'group_id'
      const { data, error } = await outsider.client.from(table).select('*').eq(column as never, groupId)
      expect(error).toBeNull()
      expect(data).toEqual([])
    }
    const { data: balances } = await outsider.client.rpc('group_balances', { p_group_id: groupId })
    expect(balances).toEqual([])
  })

  it('outsiders cannot write into the group', async () => {
    const rpc = await addExpense(outsider, groupId, {
      title: 'Injected',
      amount: 100,
      paidBy: outsider.id,
      splits: equalSplits(100, [outsider.id]),
    })
    expect(rpc.error?.message).toBe('NOT_A_MEMBER')

    const direct = await outsider.client
      .from('expenses')
      .insert({ group_id: groupId, title: 'Direct', amount: 100, paid_by: owner.id } as never)
    expect(direct.error).not.toBeNull()

    const settlement = await outsider.client
      .from('settlements')
      .insert({ group_id: groupId, from_user: outsider.id, to_user: owner.id, amount: 100, status: 'paid' })
    expect(settlement.error).not.toBeNull()
  })

  it('anonymous users can read nothing', async () => {
    const anon = anonClient()
    const { data } = await anon.from('expenses').select('*')
    expect(data ?? []).toEqual([])
    const groups = await anon.from('groups').select('*')
    expect(groups.data ?? []).toEqual([])
  })
})

describe('expenses and splits', () => {
  let a: TestUser
  let b: TestUser
  let c: TestUser
  let outsider: TestUser
  let groupId: string

  beforeAll(async () => {
    a = await createTestUser('A')
    b = await createTestUser('B')
    c = await createTestUser('C')
    outsider = await createTestUser('Outsider')
    const group = await createGroup(a)
    groupId = group.id
    await join(b, group.invite_token)
    await join(c, group.invite_token)
  })

  it('creates an expense with splits; server sets created_by and currency', async () => {
    const { data: id, error } = await addExpense(b, groupId, {
      title: '  Dinner ',
      amount: R(1200),
      paidBy: a.id,
      splits: equalSplits(R(1200), [a.id, b.id, c.id]),
    })
    expect(error).toBeNull()
    const { data } = await a.client.from('expenses').select('*, expense_splits(user_id, amount)').eq('id', id!).single()
    expect(data).toMatchObject({ title: 'Dinner', amount: R(1200), currency: 'INR', paid_by: a.id, created_by: b.id })
    expect(data?.expense_splits.reduce((s, x) => s + x.amount, 0)).toBe(R(1200))
  })

  it('rejects splits that do not add up to the amount', async () => {
    const { error } = await addExpense(a, groupId, {
      title: 'Bad',
      amount: 1000,
      paidBy: a.id,
      splits: [
        { user_id: a.id, amount: 500 },
        { user_id: b.id, amount: 400 },
      ],
    })
    expect(error?.message).toBe('SPLIT_TOTAL_MISMATCH')
  })

  it('rejects empty, duplicate, negative and fractional splits', async () => {
    const base = { title: 'Bad', amount: 1000, paidBy: a.id }
    expect((await addExpense(a, groupId, { ...base, splits: [] })).error?.message).toBe('SPLIT_EMPTY')
    expect(
      (
        await addExpense(a, groupId, {
          ...base,
          splits: [
            { user_id: a.id, amount: 500 },
            { user_id: a.id, amount: 500 },
          ],
        })
      ).error?.message,
    ).toBe('SPLIT_DUPLICATE_PARTICIPANT')
    expect(
      (
        await addExpense(a, groupId, {
          ...base,
          splits: [
            { user_id: a.id, amount: 1500 },
            { user_id: b.id, amount: -500 },
          ],
        })
      ).error?.message,
    ).toBe('SPLIT_INVALID_AMOUNT')
    expect(
      (await addExpense(a, groupId, { ...base, splits: [{ user_id: a.id, amount: 999.5 }, { user_id: b.id, amount: 0.5 }] }))
        .error?.message,
    ).toBe('SPLIT_INVALID_AMOUNT')
    expect((await addExpense(a, groupId, { ...base, amount: 0, splits: [] })).error?.message).toBe('INVALID_AMOUNT')
  })

  it('rejects payers and participants who are not members', async () => {
    const payer = await addExpense(a, groupId, {
      title: 'x',
      amount: 100,
      paidBy: outsider.id,
      splits: equalSplits(100, [a.id]),
    })
    expect(payer.error?.message).toBe('PAYER_NOT_MEMBER')
    const participant = await addExpense(a, groupId, {
      title: 'x',
      amount: 100,
      paidBy: a.id,
      splits: equalSplits(100, [a.id, outsider.id]),
    })
    expect(participant.error?.message).toBe('PARTICIPANT_NOT_MEMBER')
  })

  it('the split total is enforced even for direct table writes (deferred constraint)', async () => {
    // An expense with no splits cannot be committed.
    const noSplits = await a.client.from('expenses').insert({ group_id: groupId, title: 'Raw', amount: 100, paid_by: a.id } as never)
    expect(noSplits.error?.message).toBe('SPLIT_EMPTY')

    // Adding an extra split to an existing balanced expense is rejected.
    const { data: id } = await addExpense(a, groupId, {
      title: 'Taxi',
      amount: 300,
      paidBy: a.id,
      splits: equalSplits(300, [a.id, b.id]),
    })
    const extra = await a.client.from('expense_splits').insert({ expense_id: id!, user_id: c.id, amount: 100 } as never)
    expect(extra.error?.message).toBe('SPLIT_TOTAL_MISMATCH')

    // Removing a split is rejected too.
    const removed = await a.client.from('expense_splits').delete().eq('expense_id', id!).eq('user_id', b.id)
    expect(removed.error?.message).toBe('SPLIT_TOTAL_MISMATCH')
  })

  it('server-controlled columns cannot be written by clients', async () => {
    const forged = await a.client
      .from('expenses')
      .insert({ group_id: groupId, title: 'x', amount: 100, paid_by: a.id, created_by: b.id, currency: 'USD' } as never)
    expect(forged.error?.code).toBe('42501')
  })

  it('only the person who added an expense can edit or delete it (not even the owner)', async () => {
    const { data: id } = await addExpense(b, groupId, {
      title: 'B expense',
      amount: 600,
      paidBy: b.id,
      splits: equalSplits(600, [a.id, b.id, c.id]),
    })
    const update = (user: TestUser, title: string) =>
      user.client.rpc('update_expense', {
        p_expense_id: id!,
        p_title: title,
        p_amount: 900,
        p_paid_by: b.id,
        p_splits: equalSplits(900, [a.id, b.id, c.id]),
      })

    expect((await update(c, 'C edit')).error?.message).toBe('NOT_AUTHORIZED')
    const cDelete = await c.client.from('expenses').delete().eq('id', id!).select()
    expect(cDelete.data).toEqual([])

    // The group owner can't edit or delete someone else's expense either.
    expect((await update(a, 'Owner edit')).error?.message).toBe('NOT_AUTHORIZED')
    const ownerDelete = await a.client.from('expenses').delete().eq('id', id!).select()
    expect(ownerDelete.data).toEqual([])
    const ownerSplits = await a.client.from('expense_splits').delete().eq('expense_id', id!).select()
    expect(ownerSplits.data).toEqual([])

    expect((await update(b, 'Creator edit')).error).toBeNull()
    const { data } = await b.client.from('expenses').select('title, amount, expense_splits(amount)').eq('id', id!).single()
    expect(data).toMatchObject({ title: 'Creator edit', amount: 900 })
    expect(data?.expense_splits.map((s) => s.amount).sort()).toEqual([300, 300, 300])

    const del = await b.client.from('expenses').delete().eq('id', id!).select()
    expect(del.data).toHaveLength(1)
    const { data: splits } = await a.client.from('expense_splits').select('id').eq('expense_id', id!)
    expect(splits).toEqual([])
  })
})

describe('settlements', () => {
  let a: TestUser
  let b: TestUser
  let c: TestUser
  let groupId: string

  beforeAll(async () => {
    a = await createTestUser('A')
    b = await createTestUser('B')
    c = await createTestUser('C')
    const group = await createGroup(a)
    groupId = group.id
    await join(b, group.invite_token)
    await join(c, group.invite_token)
    await addExpense(a, groupId, { title: 'Hotel', amount: 3000, paidBy: a.id, splits: equalSplits(3000, [a.id, b.id, c.id]) })
  })

  it('only the receiver can mark money as paid; paid_at is set by the server', async () => {
    // The payer cannot mark their own payment as paid.
    const selfMarked = await b.client
      .from('settlements')
      .insert({ group_id: groupId, from_user: b.id, to_user: a.id, amount: 1000, status: 'paid' })
    expect(selfMarked.error).not.toBeNull()

    // The receiver records it.
    const { data, error } = await a.client
      .from('settlements')
      .insert({ group_id: groupId, from_user: b.id, to_user: a.id, amount: 1000, status: 'paid' })
      .select()
      .single()
    expect(error).toBeNull()
    expect(data?.created_by).toBe(a.id)
    expect(data?.paid_at).not.toBeNull()
    const { data: balances } = await a.client.rpc('group_balances', { p_group_id: groupId })
    expect(balances?.find((x) => x.user_id === b.id)?.net).toBe(0)
  })

  it('nobody else (not even the owner) can record or change a payment between others', async () => {
    const third = await c.client
      .from('settlements')
      .insert({ group_id: groupId, from_user: b.id, to_user: a.id, amount: 1, status: 'paid' })
    expect(third.error).not.toBeNull()
    const forged = await a.client
      .from('settlements')
      .insert({ group_id: groupId, from_user: c.id, to_user: b.id, amount: 1, status: 'paid' })
    expect(forged.error).not.toBeNull()
    const forgedRequest = await a.client
      .from('settlements')
      .insert({ group_id: groupId, from_user: c.id, to_user: b.id, amount: 1, status: 'pending' })
    expect(forgedRequest.error).not.toBeNull()
  })

  it(`"I've paid" requests count only after the receiver confirms`, async () => {
    // The payer sends a request: pending, no effect on balances.
    const { data: s } = await c.client
      .from('settlements')
      .insert({ group_id: groupId, from_user: c.id, to_user: a.id, amount: 500, status: 'pending' })
      .select()
      .single()
    expect(s?.paid_at).toBeNull()
    const before = await a.client.rpc('group_balances', { p_group_id: groupId })
    expect(before.data?.find((x) => x.user_id === c.id)?.net).toBe(-1000)

    // Only one open request at a time per pair.
    const duplicate = await c.client
      .from('settlements')
      .insert({ group_id: groupId, from_user: c.id, to_user: a.id, amount: 500, status: 'pending' })
    expect(duplicate.error?.message).toBe('SETTLEMENT_REQUEST_EXISTS')

    // The payer cannot confirm their own request.
    const selfConfirm = await c.client.from('settlements').update({ status: 'paid' }).eq('id', s!.id)
    expect(selfConfirm.error?.message).toBe('ONLY_RECEIVER_CAN_MARK_PAID')

    // The receiver confirms.
    const paid = await a.client.from('settlements').update({ status: 'paid' }).eq('id', s!.id).select().single()
    expect(paid.data?.status).toBe('paid')
    expect(paid.data?.paid_at).not.toBeNull()
    const after = await a.client.rpc('group_balances', { p_group_id: groupId })
    expect(after.data?.find((x) => x.user_id === c.id)?.net).toBe(-500)

    // Amounts are immutable; the payer cannot undo a confirmed payment.
    const amount = await c.client.from('settlements').update({ amount: 1 } as never).eq('id', s!.id)
    expect(amount.error?.code).toBe('42501')
    const payerUndo = await c.client.from('settlements').update({ status: 'cancelled' }).eq('id', s!.id)
    expect(payerUndo.error?.message).toBe('ONLY_RECEIVER_CAN_MARK_PAID')

    // Only the receiver can undo it.
    const cancelled = await a.client.from('settlements').update({ status: 'cancelled' }).eq('id', s!.id).select().single()
    expect(cancelled.data?.status).toBe('cancelled')
    const revive = await a.client.from('settlements').update({ status: 'paid' }).eq('id', s!.id)
    expect(revive.error?.message).toBe('SETTLEMENT_INVALID_TRANSITION')
    const del = await a.client.from('settlements').delete().eq('id', s!.id)
    expect(del.error).not.toBeNull()
  })

  it('a payer can withdraw their own pending request', async () => {
    const { data: s } = await c.client
      .from('settlements')
      .insert({ group_id: groupId, from_user: c.id, to_user: a.id, amount: 200, status: 'pending' })
      .select('id')
      .single()
    const withdrawn = await c.client.from('settlements').update({ status: 'cancelled' }).eq('id', s!.id).select('status').single()
    expect(withdrawn.data?.status).toBe('cancelled')
  })

  it('rejects self-payments and non-positive amounts', async () => {
    const self = await a.client.from('settlements').insert({ group_id: groupId, from_user: a.id, to_user: a.id, amount: 5 })
    expect(self.error).not.toBeNull()
    const zero = await b.client.from('settlements').insert({ group_id: groupId, from_user: b.id, to_user: a.id, amount: 0 })
    expect(zero.error).not.toBeNull()
  })
})

describe('membership removal keeps history valid', () => {
  it('blocks removal with a balance, deactivates when settled, removes when no history', async () => {
    const owner = await createTestUser('Owner')
    const spender = await createTestUser('Spender')
    const lurker = await createTestUser('Lurker')
    const group = await createGroup(owner)
    await join(spender, group.invite_token)
    await join(lurker, group.invite_token)

    const { data: expenseId } = await addExpense(owner, group.id, {
      title: 'Lunch',
      amount: 1000,
      paidBy: owner.id,
      splits: equalSplits(1000, [owner.id, spender.id]),
    })

    // Members cannot remove others.
    const denied = await spender.client.rpc('remove_member', { p_group_id: group.id, p_user_id: lurker.id })
    expect(denied.error?.message).toBe('NOT_AUTHORIZED')
    // Owner cannot be removed.
    const ownerRemoval = await owner.client.rpc('remove_member', { p_group_id: group.id, p_user_id: owner.id })
    expect(ownerRemoval.error?.message).toBe('CANNOT_REMOVE_OWNER')

    // Spender owes 500 -> cannot be removed yet.
    const blocked = await owner.client.rpc('remove_member', { p_group_id: group.id, p_user_id: spender.id })
    expect(blocked.error?.message).toBe('MEMBER_HAS_BALANCE')

    await owner.client
      .from('settlements')
      .insert({ group_id: group.id, from_user: spender.id, to_user: owner.id, amount: 500, status: 'paid' })

    const deactivated = await owner.client.rpc('remove_member', { p_group_id: group.id, p_user_id: spender.id })
    expect(deactivated.data).toBe('deactivated')

    // History is intact and the former member's name still resolves.
    const { data: members } = await owner.client.from('group_members').select('user_id, removed_at').eq('group_id', group.id)
    expect(members?.find((m) => m.user_id === spender.id)?.removed_at).not.toBeNull()
    const { data: profile } = await owner.client.from('profiles').select('name').eq('id', spender.id).single()
    expect(profile?.name).toBe('Spender')

    // The former member loses access.
    const { data: lost } = await spender.client.from('expenses').select('id').eq('group_id', group.id)
    expect(lost).toEqual([])

    // Expenses involving a former member are locked.
    const locked = await owner.client.rpc('update_expense', {
      p_expense_id: expenseId!,
      p_title: 'Lunch',
      p_amount: 2000,
      p_paid_by: owner.id,
      p_splits: equalSplits(2000, [owner.id, spender.id]),
    })
    expect(locked.error?.message).toBe('EXPENSE_LOCKED')
    const lockedDelete = await owner.client.from('expenses').delete().eq('id', expenseId!)
    expect(lockedDelete.error?.message).toBe('EXPENSE_LOCKED')

    // No history -> hard removal; the member can leave on their own too.
    const removed = await owner.client.rpc('remove_member', { p_group_id: group.id, p_user_id: lurker.id })
    expect(removed.data).toBe('removed')

    // Removal rotated the invite: the old link no longer works for anyone.
    const stale = await spender.client.rpc('join_group', { p_token: group.invite_token })
    expect(stale.error?.message).toBe('INVITE_INVALID')
    // With a fresh invite, the former member is reactivated (history intact).
    const { data: fresh } = await owner.client.from('groups').select('invite_token').eq('id', group.id).single()
    expect(await join(spender, fresh!.invite_token)).toMatchObject({ status: 'rejoined' })
  })

  it('deleting a group cascades everything, including history with former members', async () => {
    const owner = await createTestUser('Owner')
    const friend = await createTestUser('Friend')
    const group = await createGroup(owner)
    await join(friend, group.invite_token)
    await addExpense(owner, group.id, {
      title: 'Snacks',
      amount: 400,
      paidBy: friend.id,
      splits: equalSplits(400, [owner.id, friend.id]),
    })
    await friend.client
      .from('settlements')
      .insert({ group_id: group.id, from_user: owner.id, to_user: friend.id, amount: 200, status: 'paid' })
    expect((await owner.client.rpc('remove_member', { p_group_id: group.id, p_user_id: friend.id })).data).toBe(
      'deactivated',
    )

    const { data, error } = await owner.client.from('groups').delete().eq('id', group.id).select()
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    const { data: expenses } = await owner.client.from('expenses').select('id').eq('group_id', group.id)
    expect(expenses).toEqual([])
  })

  it('members can leave a group themselves', async () => {
    const owner = await createTestUser('Owner')
    const friend = await createTestUser('Friend')
    const group = await createGroup(owner)
    await join(friend, group.invite_token)
    const { data } = await friend.client.rpc('remove_member', { p_group_id: group.id, p_user_id: friend.id })
    expect(data).toBe('removed')
  })
})

describe('member display names', () => {
  it('admins rename anyone, members rename only themselves, empty resets', async () => {
    const owner = await createTestUser('Owner')
    const nandha = await createTestUser('Nandha')
    const karthik = await createTestUser('Karthik')
    const outsider = await createTestUser('Outsider')
    const group = await createGroup(owner)
    await join(nandha, group.invite_token)
    await join(karthik, group.invite_token)
    const rename = (by: TestUser, who: TestUser, name: string) =>
      by.client.rpc('set_member_display_name', { p_group_id: group.id, p_user_id: who.id, p_name: name })
    const nameOf = async (who: TestUser) =>
      (await owner.client.from('group_members').select('display_name').eq('group_id', group.id).eq('user_id', who.id).single()).data
        ?.display_name

    expect((await rename(owner, nandha, '  Nandha K ')).error).toBeNull()
    expect(await nameOf(nandha)).toBe('Nandha K')
    expect((await rename(karthik, karthik, 'KK')).error).toBeNull()
    expect(await nameOf(karthik)).toBe('KK')

    expect((await rename(karthik, nandha, 'Hacked')).error?.message).toBe('NOT_AUTHORIZED')
    expect((await rename(outsider, nandha, 'Hacked')).error?.message).toBe('NOT_A_MEMBER')
    expect((await rename(owner, nandha, 'x'.repeat(81))).error?.message).toBe('INVALID_INPUT')
    // Clients can't write the column directly.
    const direct = await karthik.client.from('group_members').update({ display_name: 'Direct' } as never).eq('user_id', karthik.id)
    expect(direct.error).not.toBeNull()

    expect((await rename(owner, nandha, '')).error).toBeNull()
    expect(await nameOf(nandha)).toBeNull()
    // The profile name is untouched.
    const { data: profile } = await owner.client.from('profiles').select('name').eq('id', karthik.id).single()
    expect(profile?.name).toBe('Karthik')
  })
})

describe('hardening', () => {
  it('a receiver can dispute a fake payment even after the payer left', async () => {
    const owner = await createTestUser('Owner')
    const debtor = await createTestUser('Debtor')
    const group = await createGroup(owner)
    await join(debtor, group.invite_token)
    await addExpense(owner, group.id, { title: 'Hotel', amount: 2000, paidBy: owner.id, splits: equalSplits(2000, [owner.id, debtor.id]) })

    // A debtor can no longer mark their own payment as paid at all...
    const fakeAttempt = await debtor.client
      .from('settlements')
      .insert({ group_id: group.id, from_user: debtor.id, to_user: owner.id, amount: 1000, status: 'paid' })
    expect(fakeAttempt.error).not.toBeNull()
    // ...and a receiver-confirmed payment stays disputable by the receiver after the payer leaves.
    const { data: fake } = await owner.client
      .from('settlements')
      .insert({ group_id: group.id, from_user: debtor.id, to_user: owner.id, amount: 1000, status: 'paid' })
      .select('id')
      .single()
    expect((await debtor.client.rpc('remove_member', { p_group_id: group.id, p_user_id: debtor.id })).data).toBe('deactivated')

    // The receiver disputes it: the debt is back on the books.
    const disputed = await owner.client.from('settlements').update({ status: 'cancelled' }).eq('id', fake!.id).select('status').single()
    expect(disputed.data?.status).toBe('cancelled')
    const { data: balances } = await owner.client.rpc('group_balances', { p_group_id: group.id })
    expect(balances?.find((b) => b.user_id === debtor.id)?.net).toBe(-1000)
  })

  it('expenses involving a former member are locked at the split level too', async () => {
    const owner = await createTestUser('Owner')
    const gone = await createTestUser('Gone')
    const stay = await createTestUser('Stay')
    const group = await createGroup(owner)
    await join(gone, group.invite_token)
    await join(stay, group.invite_token)
    const { data: id } = await addExpense(owner, group.id, {
      title: 'Shared',
      amount: 300,
      paidBy: owner.id,
      splits: equalSplits(300, [owner.id, gone.id, stay.id]),
    })
    await owner.client.from('settlements').insert({ group_id: group.id, from_user: gone.id, to_user: owner.id, amount: 100, status: 'paid' })
    await gone.client.rpc('remove_member', { p_group_id: group.id, p_user_id: gone.id })

    const del = await owner.client.from('expense_splits').delete().eq('expense_id', id!).eq('user_id', stay.id)
    expect(del.error?.message).toBe('EXPENSE_LOCKED')
    const ins = await owner.client.from('expense_splits').insert({ expense_id: id!, user_id: owner.id, amount: 0 } as never)
    expect(ins.error?.message).toBe('EXPENSE_LOCKED')
  })

  it('rate-limits invite code guessing', async () => {
    const guesser = await createTestUser('Guesser')
    for (let i = 0; i < 10; i++) {
      const { data, error } = await guesser.client.rpc('find_invite_by_code', { p_code: 'ZZZZZ' + String(i % 8 + 2) })
      expect(error).toBeNull()
      expect(data).toBeNull()
    }
    const { error } = await guesser.client.rpc('find_invite_by_code', { p_code: 'ZZZZZZ' })
    expect(error?.message).toBe('RATE_LIMITED')
  })
})

describe('acceptance scenario through the database', () => {
  it('SQL balances match the TypeScript engine and settle to zero', async () => {
    const [A, B, C, D] = await Promise.all(['A', 'B', 'C', 'D'].map((n) => createTestUser(n)))
    const users = [A!, B!, C!, D!]
    const group = await createGroup(A!, 'Acceptance')
    for (const u of users.slice(1)) await join(u, group.invite_token)
    const all = users.map((u) => u.id)

    expect((await addExpense(A!, group.id, { title: 'Hotel', amount: R(4000), paidBy: A!.id, splits: equalSplits(R(4000), all) })).error).toBeNull()
    expect((await addExpense(B!, group.id, { title: 'Dinner', amount: R(1200), paidBy: B!.id, splits: equalSplits(R(1200), all) })).error).toBeNull()
    expect(
      (await addExpense(C!, group.id, { title: 'Taxi', amount: R(900), paidBy: C!.id, splits: equalSplits(R(900), [A!.id, C!.id, D!.id]) })).error,
    ).toBeNull()

    const { data: sql } = await A!.client.rpc('group_balances', { p_group_id: group.id })
    const { data: expenses } = await A!.client
      .from('expenses')
      .select('paid_by, amount, expense_splits(user_id, amount)')
      .eq('group_id', group.id)
    const engine = calculateBalances(
      all,
      (expenses ?? []).map((e) => ({
        paidBy: e.paid_by,
        amount: e.amount,
        splits: e.expense_splits.map((s) => ({ userId: s.user_id, amount: s.amount })),
      })),
    )
    for (const b of engine) {
      const row = sql?.find((r) => r.user_id === b.userId)
      expect(row).toMatchObject({ paid: b.paid, share: b.share, net: b.net })
    }
    expect(engine.map((b) => b.net)).toEqual([R(2400), R(-100), R(-700), R(-1600)])
    expect(engine.reduce((s, b) => s + b.share, 0)).toBe(R(6100))

    // Each receiver confirms the suggested payment they received.
    for (const t of simplifyDebts(engine)) {
      const receiver = users.find((u) => u.id === t.to)!
      const { error } = await receiver.client
        .from('settlements')
        .insert({ group_id: group.id, from_user: t.from, to_user: t.to, amount: t.amount, status: 'paid' })
      expect(error).toBeNull()
    }
    const { data: after } = await B!.client.rpc('group_balances', { p_group_id: group.id })
    expect(after?.every((r) => r.net === 0)).toBe(true)

    const { data: dashboard } = await D!.client.rpc('get_my_groups')
    expect(dashboard?.find((g) => g.id === group.id)).toMatchObject({ member_count: 4, total_spent: R(6100), my_balance: 0 })
  })
})

describe('realtime', () => {
  it("member B's subscription fires when member A adds an expense", async () => {
    const a = await createTestUser('A')
    const b = await createTestUser('B')
    const group = await createGroup(a)
    await join(b, group.invite_token)

    const { data: session } = await b.client.auth.getSession()
    await b.client.realtime.setAuth(session.session!.access_token)

    const received = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no realtime event within 15s')), 15_000)
      const channel = b.client
        .channel(`test-group-${group.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'groups', filter: `id=eq.${group.id}` }, (payload) => {
          clearTimeout(timer)
          void b.client.removeChannel(channel)
          resolve((payload.new as { id: string }).id)
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await addExpense(a, group.id, { title: 'Live', amount: 100, paidBy: a.id, splits: equalSplits(100, [a.id, b.id]) })
          }
        })
    })
    await expect(received).resolves.toBe(group.id)
  })
})
