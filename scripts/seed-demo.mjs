// Development-only demo data: the "Delhi Trip 2026" group with 4 friends.
//
//   npm run db:seed-demo
//
// Creates (or reuses) four confirmed demo accounts, then signs in AS each user
// and uses the same RPCs the app uses — so all RLS rules and triggers apply.
// Refuses to run against anything except a local Supabase stack.
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
// Well-known demo keys of every local Supabase CLI stack (not secrets).
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(URL)) {
  console.error(`Refusing to seed demo data into ${URL}. This script is for local development only.`)
  process.exit(1)
}

const PASSWORD = 'demo-password-2026'
const PEOPLE = ['Indhu', 'Nandha', 'Karthik', 'Arun']
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(URL, SERVICE_ROLE_KEY, options)

function must(result, what) {
  if (result.error) {
    console.error(`Failed to ${what}:`, result.error.message)
    process.exit(1)
  }
  return result.data
}

async function signedIn(name) {
  const email = `${name.toLowerCase()}@demo.nettly.test`
  const created = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { name } })
  if (created.error && !/already/i.test(created.error.message)) must(created, `create ${name}`)
  const client = createClient(URL, ANON_KEY, options)
  const { user } = must(await client.auth.signInWithPassword({ email, password: PASSWORD }), `sign in ${name}`)
  return { name, email, id: user.id, client }
}

const users = []
for (const name of PEOPLE) users.push(await signedIn(name))
const [indhu, nandha, karthik, arun] = users

const existing = must(await indhu.client.rpc('get_my_groups'), 'list groups')
if (existing.some((g) => g.name === 'Delhi Trip 2026')) {
  console.log('Demo group already exists — nothing to do.')
} else {
  const group = must(
    await indhu.client.rpc('create_group', {
      p_name: 'Delhi Trip 2026',
      p_description: 'Four friends, one week in Delhi',
      p_currency: 'INR',
    }),
    'create group',
  )
  for (const u of [nandha, karthik, arun]) must(await u.client.rpc('join_group', { p_token: group.invite_token }), `join ${u.name}`)

  const R = (rupees) => Math.round(rupees * 100)
  const split = (entries) => entries.map(([u, amount, weight = null]) => ({ user_id: u.id, amount, weight }))
  const expenses = [
    {
      by: indhu, title: 'Train tickets', category: 'transport', type: 'equal', amount: R(8000), daysAgo: 6,
      splits: split(users.map((u) => [u, R(2000)])),
    },
    {
      by: karthik, title: 'Hotel', category: 'accommodation', type: 'shares', amount: R(6500), daysAgo: 5,
      description: 'Indhu took the bigger room',
      splits: split([[indhu, R(2600), 2], [nandha, R(1300), 1], [karthik, R(1300), 1], [arun, R(1300), 1]]),
    },
    {
      by: nandha, title: 'Dinner', category: 'food', type: 'equal', amount: R(1200), daysAgo: 4,
      description: 'Dinner near Connaught Place — Arun skipped it',
      splits: split([[indhu, R(400)], [nandha, R(400)], [karthik, R(400)]]),
    },
    {
      by: arun, title: 'Metro', category: 'transport', type: 'equal', amount: R(480), daysAgo: 3,
      splits: split(users.map((u) => [u, R(120)])),
    },
    {
      by: indhu, title: 'Street food tour', category: 'food', type: 'percentage', amount: R(2400), daysAgo: 2,
      splits: split([[indhu, R(960), 40], [nandha, R(480), 20], [karthik, R(480), 20], [arun, R(480), 20]]),
    },
  ]
  for (const e of expenses) {
    const date = new Date(Date.now() - e.daysAgo * 86_400_000).toISOString()
    must(
      await e.by.client.rpc('create_expense', {
        p_group_id: group.id,
        p_title: e.title,
        p_amount: e.amount,
        p_paid_by: e.by.id,
        p_splits: e.splits,
        p_split_type: e.type,
        p_category: e.category,
        p_description: e.description ?? null,
        p_expense_date: date,
      }),
      `add ${e.title}`,
    )
  }
  must(
    await arun.client
      .from('settlements')
      .insert({ group_id: group.id, from_user: arun.id, to_user: karthik.id, amount: R(500), status: 'paid', note: 'UPI' }),
    'record settlement',
  )
  console.log('Created "Delhi Trip 2026" with 4 members, 5 expenses and 1 payment.')
}

console.log('\nDemo logins (password for all: %s):', PASSWORD)
for (const u of users) console.log(`  ${u.name.padEnd(8)} ${u.email}`)
