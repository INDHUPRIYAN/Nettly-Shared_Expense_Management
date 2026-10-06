# Nettly — Split anything. Settle everything.

Nettly is a real-time group expense and settlement app. Create a group for a trip, a flat, a college team or an event,
invite friends with a link, record who paid and who took part, and Nettly works out exactly who owes whom — with the
fewest possible payments.

> **Who paid? Who participated? Who owes? Who should receive?** Nettly calculates everything.

---

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Database schema](#database-schema)
- [Local development](#local-development)
- [Environment variables](#environment-variables)
- [Supabase setup (production)](#supabase-setup-production)
- [Running tests](#running-tests)
- [Building](#building)
- [Deployment (Vercel)](#deployment-vercel)
- [Security](#security)
- [Project structure](#project-structure)
- [Renaming the product](#renaming-the-product)

---

## Features

**Accounts** — email/password sign-up, login, logout, persistent sessions, protected routes, profile editing.

**Groups** — create, view, edit (name, description, currency), delete (owner only, with typed confirmation).
Roles: owner, admin, member.

**Invitations** — every group gets a long cryptographically random invite link (`/join/<token>`) and a short code
(e.g. `AB72KQ`). Copy link (Clipboard API), share on WhatsApp, join with a code, reset the link. Logged-out visitors see
a preview and are sent back to the invite after logging in or signing up. Joining twice is harmless.

**Expenses** — add, view, edit, delete (with confirmation); Edit and Delete buttons sit on every expense in the list. Title, description, amount, payer, category, date and
participants. Search and filter by category, grouped by month.

**Splitting** — equal, custom amounts, percentages and shares. Untick anyone who didn't take part — they owe ₹0 for
that expense. Live preview of every person's share; validation that the split adds up. Rounding is exact and
deterministic (₹100 / 3 = 33.33 + 33.33 + 33.34) — money is never created or lost.

**Balances** — total spent, a member-wise totals table (paid / share / balance per person, with a reconciling totals row), what each member paid, their share and net balance (positive = should receive, negative =
owes). A personal "Your balance" hero answers *"do I owe money or do people owe me?"* in under 5 seconds, followed by
**You owe** / **You should receive** lists.

**Settlements** — suggested minimum payments, **Mark as paid** with confirmation (full or partial amount, optional
note), settlement history with All / Pending / Paid filters, and undo (cancel) of a recorded payment. Settlements are
separate records: original expenses never change.

**Members** — member list with roles and balances; owners can promote admins and remove members; anyone can leave.
Members with financial history are never deleted: they can only be removed with a settled balance and are kept as
*former members* so historical records stay valid.

**Realtime** — when anyone adds, edits or deletes an expense, records a payment or joins, every open screen in that
group updates automatically.

**Polish** — mobile-first layout with bottom navigation on phones, dialogs as bottom sheets, skeleton loaders, empty
and error states, friendly error messages, keyboard and screen-reader support, a light red-gradient glassmorphism theme, installable PWA.

---

## Tech stack

| Layer      | Choice                                                                    |
| ---------- | ------------------------------------------------------------------------- |
| Frontend   | React 19, Vite 8, TypeScript (strict), React Router 8                     |
| UI         | Tailwind CSS v4, shadcn/ui-style components on Radix UI, Lucide icons, Sonner toasts |
| Data       | Supabase JS, TanStack Query, Zod                                          |
| Backend    | Supabase: PostgreSQL, Auth, Realtime, Row Level Security, SQL functions   |
| Tests      | Vitest, React Testing Library, Playwright                                 |
| Deployment | Vercel (static SPA) + Supabase                                            |

There is no separate backend server: the browser talks to Supabase directly, and **PostgreSQL is the source of truth
and the security boundary** (RLS, column privileges, triggers and validated SQL functions).

---

## Architecture

```text
 Browser (React SPA)                                   Supabase
 ┌───────────────────────────────┐        ┌────────────────────────────────────┐
 │ pages/ + components/          │        │ Auth (email/password, JWT)          │
 │   ▲                           │  HTTPS │ PostgREST ──► PostgreSQL            │
 │ hooks/ (TanStack Query)       │◄──────►│              • RLS on every table   │
 │   ▲                           │        │              • column-level GRANTs  │
 │ lib/api/ (typed Supabase calls│        │              • triggers/invariants  │
 │          + friendly errors)   │   WS   │              • RPC functions        │
 │ lib/settlement/ (pure engine) │◄──────►│ Realtime (groups.last_activity_at)  │
 └───────────────────────────────┘        └────────────────────────────────────┘
```

### The money engine — `src/lib/settlement/`

A pure, framework-free TypeScript module (no React, no I/O), fully unit tested:

| File                   | Responsibility                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `money.ts`             | Integer minor units (paise). `parseMoney`, `formatMoney`, `addMoney`, `splitMoney`… |
| `splitAmount.ts`       | Equal / custom / percentage / shares splits with largest-remainder rounding         |
| `calculateBalances.ts` | `net = paid − share + sent − received` per member                                    |
| `simplifyDebts.ts`     | Minimum-payment settlement plan and the personal "you owe / you get" view            |
| `types.ts`             | Shared types                                                                         |

**Money is never a float.** ₹100.50 is stored and computed as `10050`. User input is parsed from strings
(`"100.50"` → `10050`); display formatting passes an exact decimal string to `Intl.NumberFormat`. Weighted splits use
`BigInt` internally so `amount × weight` can never overflow.

**Rounding.** Splits allocate `floor(total × weight / Σweights)` to everyone, then hand out the leftover minor units
one at a time to the largest fractional remainders (ties → later participants). The result always sums exactly to the
total.

**Settlement algorithm.** Members are split into creditors (net > 0) and debtors (net < 0). First, any debtor and
creditor with exactly equal amounts are paired (one payment clears both). Then the largest remaining debtor repeatedly
pays the largest remaining creditor `min(debt, credit)` until everyone is at zero. This never creates or loses money,
uses at most *n − 1* payments, and is deterministic (ties are broken by user id). Example:
`A +2500, B −1500, C +500, D −1500` → `B→A 1500, D→A 1000, D→C 500`.

Balances are computed once per data change inside `GroupProvider` and shared through context. The database computes
the same numbers in SQL (`member_net_balance`, `group_balances`, `get_my_groups`) for the dashboard and server-side
checks; integration tests verify the two always agree.

### Realtime

Triggers bump `groups.last_activity_at` whenever a group's expenses, settlements or members change. Each open group
screen holds **one** Realtime subscription to that row (`filter: id=eq.<groupId>`, protected by RLS) and refetches the
group (debounced). This avoids per-table subscriptions and unfilterable delete events, and nobody receives events for
groups they are not in.

---

## Database schema

All amounts are `BIGINT` minor units. Migrations live in [`supabase/migrations`](supabase/migrations).

| Table            | Key columns                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| `profiles`       | `id` (= `auth.users.id`), `name`, `email`, `avatar_url` — created automatically by a trigger on sign-up       |
| `groups`         | `name`, `description`, `currency`, `created_by`, `invite_token` (192-bit random), `invite_code` (6 chars), `last_activity_at` |
| `group_members`  | `group_id`, `user_id`, `role` (`owner`/`admin`/`member`), `joined_at`, `removed_at` · unique `(group_id, user_id)` · one owner per group |
| `expenses`       | `group_id`, `title`, `description`, `amount > 0`, `currency` (always the group's), `paid_by`, `category`, `split_type`, `expense_date`, `created_by` |
| `expense_splits` | `expense_id`, `group_id` (derived), `user_id`, `amount ≥ 0`, `weight` (percent/shares input) · unique `(expense_id, user_id)` |
| `settlements`    | `group_id`, `from_user`, `to_user`, `amount > 0`, `status` (`pending`/`paid`/`cancelled`), `note`, `paid_at`, `cancelled_at`, `created_by` |

**Invariants enforced in the database**

- `sum(expense_splits.amount) = expenses.amount` and at least one split — a **deferred constraint trigger** checked at
  commit, so it holds even for direct table writes.
- Payers and participants must be active group members; expense currency always equals the group currency.
- `created_by`, `paid_at`, `cancelled_at`, invite tokens and other server fields cannot be written by clients
  (column-level privileges + triggers).
- Settlement transitions: `pending → paid | cancelled`, `paid → cancelled`. Amounts and parties are immutable;
  settlements are never deleted.
- Group currency is locked once money has been recorded.
- Expenses or payments involving a former member are locked (their settled balance cannot silently change).

**RPC functions:** `create_group`, `regenerate_invite`, `get_invite_preview` (public), `find_invite_by_code`,
`join_group`, `remove_member`, `set_member_role`, `create_expense`, `update_expense`, `get_my_groups`,
`group_balances`.

---

## Local development

**Prerequisites:** Node.js 20+ (tested on 24), npm, Git, and **Docker Desktop** (for the local Supabase stack).

```bash
git clone https://github.com/INDHUPRIYAN/Nettly-Shared_Expense_Management.git
cd Nettly-Shared_Expense_Management
npm install

# 1. Start Supabase locally (Postgres, Auth, Realtime, Studio) — applies all migrations
npm run db:start

# 2. Create .env.local with the values printed by `npx supabase status`
#    (API URL and anon key; see "Environment variables" below)

# 3. Optional: load the "Delhi Trip 2026" demo group (4 friends, 5 expenses)
npm run db:seed-demo

# 4. Run the app
npm run dev            # http://localhost:5173
```

Demo logins created by `db:seed-demo` (password `demo-password-2026`):
`indhu@demo.nettly.test`, `nandha@demo.nettly.test`, `karthik@demo.nettly.test`, `arun@demo.nettly.test`.
The seed script refuses to run against anything but a local stack — production is never seeded.

Useful commands:

```bash
npm run db:reset       # drop & recreate the local DB from migrations
npm run db:types       # regenerate src/types/database.ts from the local schema
npm run db:stop        # stop the local stack
npm run icons          # regenerate PWA icons from the brand mark
```

Supabase Studio (table browser) runs at http://127.0.0.1:54323 and the local email inbox at http://127.0.0.1:54324.

---

## Environment variables

Copy `.env.example` to `.env.local` (git-ignored) and fill in:

| Variable                 | Description                                                                 | Local value                  |
| ------------------------ | --------------------------------------------------------------------------- | ---------------------------- |
| `VITE_SUPABASE_URL`      | Supabase project URL                                                        | `http://127.0.0.1:54321`     |
| `VITE_SUPABASE_ANON_KEY` | Supabase **anon / publishable** key (safe in the browser — RLS protects data) | `ANON_KEY` from `npx supabase status` |
| `VITE_APP_URL`           | Public URL of the app, used in invite links and auth email redirects        | `http://localhost:5173`      |

Never put the **service-role** key in any `VITE_` variable — it would be shipped to every browser. The app never needs
it. If `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing, the app shows a configuration screen instead of
failing silently.

---

## Supabase setup (production)

1. Create a project at [supabase.com](https://supabase.com/dashboard) (pick a region close to your users).
2. Apply the schema from this repo:

   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```

   This creates all tables, RLS policies, functions, triggers and the Realtime publication. No demo data is created.

3. **Authentication → URL Configuration**
   - Site URL: `https://<your-vercel-domain>`
   - Redirect URLs: `https://<your-vercel-domain>/**` (and `http://localhost:5173/**` for local testing)
4. **Authentication → Providers → Email**: keep Email enabled. Recommended: *Confirm email* ON, minimum password
   length 8.
5. **Authentication → Emails / SMTP**: Supabase's built-in email sender is heavily rate-limited — configure a custom
   SMTP provider (Resend, Postmark, SES…) before real users sign up.
6. **Project Settings → API**: copy the Project URL and the anon/publishable key into Vercel (below).

---

## Running tests

```bash
npm run lint           # ESLint, zero warnings allowed
npm run typecheck      # TypeScript project build (no emit)
npm run test           # unit + component tests (Vitest + React Testing Library)

# The following need the local Supabase stack running (npm run db:start):
npm run test:integration   # database tests: RLS isolation, invariants, RPCs, realtime
npm run test:e2e           # Playwright: full two-user flow in real browsers (desktop + mobile)
```

First Playwright run: `npx playwright install chromium`.

| Suite       | What it covers                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| Unit        | Money parsing/formatting, all split types, rounding, exclusions, balances, debt simplification (incl. randomised conservation tests), the spec acceptance scenario, validation, error mapping, safe redirects, components |
| Integration | Profiles, invites, duplicate joins, group isolation, column privileges, split-total invariant, edit/delete permissions, settlement state machine, member removal & history, cascade delete, SQL vs TypeScript balance parity, realtime delivery |
| E2E         | Sign-up, create group, invite link, join (logged out → sign-up → join), duplicate join, logout/login, session persistence, add/edit/delete expense, custom split, live updates across two browsers, mark as paid, invalid invite, protected routes, mobile layout |

---

## Building

```bash
npm run build          # type-checks, then builds to dist/ (with PWA service worker)
npm run preview        # serve the production build at http://localhost:4173
```

Pages are code-split per route; the service worker caches only the app shell — Supabase API traffic always goes to the
network, so financial data is never served stale.

---

## Deployment (Vercel)

1. Push the repository to GitHub.
2. In Vercel: **Add New → Project → Import** this repository. Framework preset **Vite** is detected; build command
   `npm run build`, output directory `dist` (also set in `vercel.json`).
3. Add environment variables (Production and Preview):
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL` (e.g. `https://nettly.vercel.app`).
4. Deploy. Then make sure the Supabase Site URL / Redirect URLs (above) match the deployed domain. If you change the
   domain later, update `VITE_APP_URL` and **redeploy** (Vite inlines env vars at build time).

`vercel.json` rewrites every route to `index.html`, so deep links such as `/groups/<id>/settlements` and
`/join/<token>` work on refresh, and adds basic security headers.

---

## Security

- **Row Level Security on every table.** A user can only read data of groups where they are an *active* member;
  removed members lose access immediately. Anonymous users can read nothing (only the invite preview function).
- **Column-level privileges.** Clients can write only the columns they own (e.g. an expense's title or amount) —
  never `created_by`, `currency`, invite tokens, `paid_at` or settlement amounts.
- **No trusted client input.** `group_id`, `user_id`, `paid_by` and amounts are re-validated in Postgres; authorship
  comes from the JWT (`auth.uid()`), not the request. SECURITY DEFINER functions use `search_path = ''` and explicit
  authorization checks.
- **Invites.** 192-bit random tokens in links; tokens and codes are generated in the database and can be reset.
  Removing a member rotates the invite automatically, and short-code lookups are rate limited (10 failed attempts per
  user per hour) against guessing.
- **Payments can't be faked away.** The payer may mark a debt as paid (fast for friends), but the receiver can always
  dispute (cancel) a payment recorded to them — even after the payer has left the group.
- **Concurrency.** Write triggers take a row lock on the member's membership, so removing a member can't race with a
  new expense or payment for them.
- **Private emails.** Co-members can see each other's names, never email addresses (column-level privileges).
- **Secrets.** Only the public anon key is used in the browser. `.env*` files are git-ignored.
- **Safe redirects.** `?next=` only accepts same-origin relative paths.
- **No raw errors.** Database and auth errors are mapped to friendly messages; business rules raise stable codes
  (e.g. `SPLIT_TOTAL_MISMATCH`) that the UI translates.

---

## Project structure

```text
src/
  components/
    ui/            shadcn/ui-style primitives (button, input, dialog, menu, …)
    common/        logo, avatars, money display, empty/error/loading states, confirm dialog
    layout/        app shell, group layout (data + realtime + shared dialogs), navigation
    groups/        create group, group form, invite panel, join by code
    expenses/      expense form, split editor, expense list, expense details
    balances/      balance hero, summary cards, you owe / you receive, member balances
    settlements/   mark-as-paid dialog
  pages/           landing, auth, dashboard, group overview, expenses, settlements, members, settings, join, profile
  hooks/           useAuth, useGroup (queries + realtime), useGroupMutations, useBalances, useClipboard, …
  providers/       AuthProvider, GroupContext (derived balances & permissions)
  lib/
    settlement/    pure money/split/balance/settlement engine (+ tests)
    api/           typed Supabase data access
    validation/    Zod schemas
    supabase/      client
  routes/          router (lazy routes) and auth guards
  types/           database.ts (generated) and app.ts (domain types)
supabase/
  migrations/      schema, indexes, helpers & triggers, RLS, RPCs, realtime
tests/
  integration/     database tests against local Supabase
  e2e/             Playwright tests
scripts/           demo seed, icon generator
```

---

## Renaming the product

The product name and tagline live in [`src/config/app.ts`](src/config/app.ts). Also update the PWA manifest in
`vite.config.ts`, the `<title>`/description in `index.html`, and regenerate icons with `npm run icons`.

---

## License

Currently intended for personal, educational and hackathon use. A production license can be added on release.
