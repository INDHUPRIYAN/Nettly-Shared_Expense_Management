/**
 * Integration-test helpers. These tests run against a LOCAL Supabase stack
 * (`npm run db:start`) and exercise the real database through the same public
 * API the browser uses, so RLS, triggers and RPCs are tested for real.
 *
 * The default keys below are the well-known demo keys that the Supabase CLI
 * uses for every local stack — they are not secrets and only work locally.
 */
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database'

export const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
export const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(SUPABASE_URL)) {
  throw new Error('Integration tests must only run against a local Supabase stack.')
}

export type Client = SupabaseClient<Database>

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } }

export const admin: Client = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, clientOptions)

export function anonClient(): Client {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, clientOptions)
}

export interface TestUser {
  client: Client
  user: User
  id: string
  name: string
  email: string
}

const runId = Math.random().toString(36).slice(2, 8)
let counter = 0

/** Create a confirmed user and return a client signed in as them. */
export async function createTestUser(name: string): Promise<TestUser> {
  counter += 1
  const email = `${name.toLowerCase()}-${runId}-${counter}@example.test`
  const password = 'correct-horse-battery'
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  })
  if (error || !data.user) throw error ?? new Error('createUser failed')

  const client = anonClient()
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError
  return { client, user: data.user, id: data.user.id, name, email }
}

/** Equal split helper that mirrors the app's engine for test payloads. */
export function equalSplits(amount: number, userIds: string[]) {
  const base = Math.floor(amount / userIds.length)
  const remainder = amount % userIds.length
  return userIds.map((user_id, i) => ({ user_id, amount: base + (i >= userIds.length - remainder ? 1 : 0) }))
}

export async function createGroup(owner: TestUser, name = 'Test Group', currency = 'INR') {
  const { data, error } = await owner.client.rpc('create_group', { p_name: name, p_currency: currency })
  if (error || !data) throw error ?? new Error('create_group failed')
  return data
}

export async function join(user: TestUser, token: string) {
  const { data, error } = await user.client.rpc('join_group', { p_token: token })
  if (error) throw error
  return data?.[0]
}

export async function addExpense(
  user: TestUser,
  groupId: string,
  input: { title: string; amount: number; paidBy: string; splits: { user_id: string; amount: number }[] },
) {
  return user.client.rpc('create_expense', {
    p_group_id: groupId,
    p_title: input.title,
    p_amount: input.amount,
    p_paid_by: input.paidBy,
    p_splits: input.splits,
  })
}
