import { expect, test, type Page } from '@playwright/test'
import { signUp } from './helpers'

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

test('mobile: landing, signup, group and bottom navigation fit the screen', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expectNoHorizontalScroll(page)

  await page.getByRole('link', { name: 'Sign up' }).click()
  await signUp(page, 'Mobile')
  await expect(page.getByRole('heading', { name: 'Welcome, Mobile' })).toBeVisible()
  await expectNoHorizontalScroll(page)

  await page.getByRole('button', { name: 'Create group' }).first().click()
  await page.getByRole('dialog').getByLabel('Group name').fill('Goa Weekend')
  await page.getByRole('dialog').getByRole('button', { name: 'Create group' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Open group' }).click()

  const bottomNav = page.getByRole('navigation', { name: 'Group sections' }).last()
  await expect(bottomNav).toBeVisible()
  await expect(bottomNav.getByRole('link')).toHaveText(['Home', 'Expenses', 'Settle', 'Members', 'History'])
  await expectNoHorizontalScroll(page)

  await page.getByTestId('header-add-expense').click()
  const form = page.getByRole('dialog')
  await form.getByLabel('Title').fill('Breakfast')
  await form.getByLabel('Amount', { exact: true }).fill('450.50')
  await form.getByRole('button', { name: 'Add expense' }).click()
  await expect(form).toBeHidden()

  await bottomNav.getByRole('link', { name: 'Expenses' }).click()
  await expect(page.getByRole('button', { name: /^Breakfast —/ })).toContainText('₹450.50')
  await expectNoHorizontalScroll(page)
})
