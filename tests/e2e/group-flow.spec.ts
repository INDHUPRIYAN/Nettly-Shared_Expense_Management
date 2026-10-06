import { expect, test, type Browser, type Page } from '@playwright/test'
import { logIn, logOut, myBalance, openTab, signUp } from './helpers'

/**
 * The complete real-world flow with two people in two separate browsers:
 * signup, create group, invite, join, login/logout, add/edit/delete expenses,
 * balances, settle up — with realtime updates verified across both screens.
 */

async function newPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext()
  return context.newPage()
}

test('Delhi Trip 2026: two friends split, edit, delete and settle', async ({ browser }) => {
  const indhu = await newPage(browser)
  const nandha = await newPage(browser)

  // --- Indhu signs up and creates the group ---------------------------------
  await indhu.goto('/signup')
  await signUp(indhu, 'Indhu')
  await expect(indhu.getByRole('heading', { name: 'Welcome, Indhu' })).toBeVisible()
  await expect(indhu.getByText('No groups yet')).toBeVisible()

  await indhu.getByRole('button', { name: 'Create group' }).first().click()
  const createDialog = indhu.getByRole('dialog')
  await createDialog.getByLabel('Group name').fill('Delhi Trip 2026')
  await createDialog.getByRole('button', { name: 'Create group' }).click()
  await expect(createDialog.getByText('Group created!')).toBeVisible()
  const inviteLink = (await createDialog.getByTestId('invite-link').textContent())!.trim()
  expect(inviteLink).toMatch(/\/join\/[A-Za-z0-9_-]{32}$/)
  await expect(createDialog.getByRole('link', { name: 'Share on WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=/)
  await createDialog.getByRole('button', { name: 'Open group' }).click()
  await expect(indhu.getByRole('heading', { name: 'Delhi Trip 2026' })).toBeVisible()
  await expect(indhu.getByText('1 member', { exact: false })).toBeVisible()

  // --- Nandha opens the invite while logged out, signs up, joins -------------
  const invitePath = new URL(inviteLink).pathname
  await nandha.goto(invitePath)
  await expect(nandha.getByText("You're invited!")).toBeVisible()
  await expect(nandha.getByRole('heading', { name: 'Delhi Trip 2026' })).toBeVisible()
  await expect(nandha.getByText('Created by Indhu')).toBeVisible()
  await nandha.getByRole('link', { name: 'Create account to join' }).click()
  await signUp(nandha, 'Nandha')
  await expect(nandha).toHaveURL(invitePath)
  await nandha.getByRole('button', { name: 'Join group' }).click()
  await expect(nandha.getByRole('heading', { name: 'Delhi Trip 2026' })).toBeVisible()

  // Realtime: Indhu's open screen shows the new member without reloading.
  await expect(indhu.getByText('2 members', { exact: false })).toBeVisible()

  // Duplicate join protection.
  await nandha.goto(invitePath)
  await expect(nandha.getByText("You're already a member.")).toBeVisible()
  await nandha.getByRole('link', { name: 'Open group' }).click()

  // --- Logout / login round trip -------------------------------------------
  await logOut(nandha)
  await nandha.goto('/login')
  await logIn(nandha, 'Nandha')
  await expect(nandha.getByRole('link', { name: /Delhi Trip 2026/ })).toBeVisible()
  await nandha.getByRole('link', { name: /Delhi Trip 2026/ }).click()
  await expect(myBalance(nandha)).toHaveText('₹0')

  // Session persists across reloads.
  await nandha.reload()
  await expect(nandha.getByRole('heading', { name: 'Delhi Trip 2026' })).toBeVisible()

  // --- Indhu adds an expense; Nandha's screen updates live ------------------
  await indhu.getByTestId('header-add-expense').click()
  let form = indhu.getByRole('dialog')
  await form.getByLabel('Title').fill('Dinner')
  await form.getByLabel('Amount', { exact: true }).fill('1200')
  await form.getByLabel('Category').selectOption('food')
  await expect(form.getByText('₹600 each · 2 people')).toBeVisible()
  await form.getByRole('button', { name: 'Add expense' }).click()
  await expect(form).toBeHidden()

  await expect(myBalance(indhu)).toHaveText('+₹600')
  await expect(myBalance(nandha)).toHaveText('-₹600')
  await expect(nandha.getByText('You need to pay')).toBeVisible()
  await expect(nandha.getByTestId('group-total')).toHaveText('₹1,200')

  // Member-wise totals reconcile with the total spent.
  await expect(nandha.getByTestId('totals-paid')).toHaveText('₹1,200')
  await expect(nandha.getByTestId('totals-share')).toHaveText('₹1,200')

  // Details view shows who owes what.
  await indhu.getByRole('button', { name: /^Dinner —/ }).click()
  await expect(indhu.getByRole('dialog').getByText('Who owes what')).toBeVisible()
  await indhu.keyboard.press('Escape')

  // --- Edit the expense straight from the list ---------------------------------
  // Nandha didn't add it, so the buttons are shown but disabled for them.
  await expect(nandha.getByRole('button', { name: 'Edit Dinner' })).toBeDisabled()
  await indhu.getByRole('button', { name: 'Edit Dinner' }).click()
  form = indhu.getByRole('dialog')
  await form.getByLabel('Amount', { exact: true }).fill('1500')
  await form.getByRole('button', { name: 'Save changes' }).click()
  await expect(form).toBeHidden()
  await expect(myBalance(nandha)).toHaveText('-₹750')

  // --- A custom split, then delete it --------------------------------------------
  await indhu.getByTestId('header-add-expense').click()
  form = indhu.getByRole('dialog')
  await form.getByLabel('Title').fill('Taxi')
  await form.getByLabel('Amount', { exact: true }).fill('300')
  await form.getByRole('radio', { name: 'Custom' }).click()
  await form.getByLabel('Amount for Indhu').fill('100')
  await form.getByLabel('Amount for Nandha').fill('100')
  await expect(form.getByText('₹100 left to assign')).toBeVisible()
  await form.getByLabel('Amount for Nandha').fill('200')
  await expect(form.getByTestId('calc-preview')).toContainText('gets back ₹200')
  await form.getByRole('button', { name: 'Add expense' }).click()
  await expect(form).toBeHidden()
  await expect(myBalance(nandha)).toHaveText('-₹950')

  await indhu.getByRole('button', { name: 'Delete Taxi' }).click()
  const confirm = indhu.getByRole('alertdialog')
  await expect(confirm.getByText('This will affect group balances.')).toBeVisible()
  await confirm.getByRole('button', { name: 'Delete' }).click()
  await expect(myBalance(nandha)).toHaveText('-₹750')

  // --- Nandha settles up ---------------------------------------------------------
  await expect(nandha.getByRole('heading', { name: 'You owe' })).toBeVisible()
  await openTab(nandha, 'Settle up')
  await nandha.getByRole('button', { name: 'Mark as paid' }).click()
  const pay = nandha.getByRole('dialog')
  await expect(pay.getByText('You are marking ₹750 paid to Indhu.')).toBeVisible()
  await pay.getByRole('button', { name: 'Confirm' }).click()
  await expect(nandha.getByText("You're all settled!")).toBeVisible()
  await expect(nandha.getByRole('list', { name: 'Settlement history' })).toContainText('You paid Indhu ₹750')

  // Indhu sees the payment live and is settled too.
  await expect(myBalance(indhu)).toHaveText('₹0')
  await expect(indhu.getByText("You're all settled up")).toBeVisible()

  // --- Members page shows balances & roles ---------------------------------------
  await openTab(indhu, 'Members')
  await expect(indhu.getByRole('list', { name: 'Group members' })).toContainText('Owner')
  await expect(indhu.getByRole('list', { name: 'Group members' })).toContainText('Nandha')

  // --- Owner renames a member (group nickname); Nandha sees it live -------------
  await indhu.getByRole('button', { name: 'Actions for Nandha' }).click()
  await indhu.getByRole('menuitem', { name: 'Edit name' }).click()
  const renameDialog = indhu.getByRole('dialog')
  await renameDialog.getByLabel('Name in this group').fill('Nandha K')
  await renameDialog.getByRole('button', { name: 'Save name' }).click()
  await expect(renameDialog).toBeHidden()
  await expect(indhu.getByRole('list', { name: 'Group members' })).toContainText('Nandha K')
  await openTab(nandha, 'Members')
  await expect(nandha.getByRole('list', { name: 'Group members' })).toContainText('Nandha K')
})

test('invalid invite links are handled', async ({ page }) => {
  await page.goto('/join/this-is-not-a-real-invite-token-0')
  await expect(page.getByRole('heading', { name: 'Invite not found' })).toBeVisible()
  await expect(page.getByText('This invite link is invalid or expired.')).toBeVisible()
})

test('protected routes redirect to login and come back', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/)
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
})

test('login shows a friendly error for wrong credentials', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('nobody@example.test')
  await page.getByLabel('Password').fill('wrong-password')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('alert')).toHaveText('Incorrect email or password.')
})
