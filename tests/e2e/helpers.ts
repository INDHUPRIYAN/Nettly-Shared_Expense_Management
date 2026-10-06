import { expect, type Page } from '@playwright/test'

const runId = Date.now().toString(36)
export const PASSWORD = 'delhi-trip-2026'

export function email(name: string) {
  return `${name.toLowerCase()}.${runId}@example.test`
}

export async function signUp(page: Page, name: string) {
  await page.getByLabel('Full name').fill(name)
  await page.getByLabel('Email').fill(email(name))
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
}

export async function logIn(page: Page, name: string) {
  await page.getByLabel('Email').fill(email(name))
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in' }).click()
}

export async function logOut(page: Page) {
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Log out' }).click()
  await expect(page).toHaveURL('/')
}

export function myBalance(page: Page) {
  return page.getByTestId('my-balance')
}

export async function openTab(page: Page, name: 'Overview' | 'Expenses' | 'Settle up' | 'Members' | 'History' | 'Settings') {
  await page.getByRole('navigation', { name: 'Group sections' }).first().getByRole('link', { name }).click()
}
