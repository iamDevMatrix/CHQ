import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * Real Supabase (Auth + PostgREST + gateway + Postgres with schema.sql RLS), real production build.
 * Logins are created by scripts/test-supabase.sh: manager@example.com is an outlet admin, stranger@example.com is not.
 */
test.describe.configure({ mode: 'serial' });

const PASSWORD = 'Test-pass-123';

async function guest(page: Page, suffix = '') {
  await page.goto('/' + suffix);
  const splash = page.locator('.splash');
  if (await splash.count()) await splash.click();
  await expect(page.locator('.item').first()).toBeVisible();
}

async function signIn(page: Page, email: string) {
  await page.goto('/#/admin');
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

async function adminPage(browser: Browser) {
  const page = await (await browser.newContext()).newPage();
  await signIn(page, 'manager@example.com');
  await expect(page.getByText('Menu admin')).toBeVisible();
  await expect(page.getByLabel('Malai Chai in stock')).toBeVisible();
  return page;
}

test('guest: full menu from Supabase, forms reach the database', async ({ page }) => {
  await guest(page, '?t=5');
  await expect(page.locator('.item')).toHaveCount(113);
  await page.locator('.about-btn').click();
  const partner = page.locator('#partner');
  await partner.getByLabel('Name').fill('Ravi Kumar');
  await partner.getByLabel('Mobile').fill('+91 98765 43210');
  await partner.getByLabel('City').fill('Hyderabad');
  await partner.getByRole('button', { name: 'Send enquiry' }).click();
  await expect(partner.locator('.note')).toContainText('Thanks, Ravi');
  await page.getByText('Share feedback').click();
  await page.getByLabel('4 stars').click();
  await page.getByLabel('Tell us more (optional)').fill('Great chai');
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.locator('.thanks')).toBeVisible();
});

test('admin: wrong password is rejected', async ({ page }) => {
  await page.goto('/#/admin');
  await page.getByPlaceholder('Email').fill('manager@example.com');
  await page.getByPlaceholder('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('.error')).toContainText(/invalid/i);
});

test('admin: a login that is not an outlet admin is told so and cannot edit', async ({ page }) => {
  await signIn(page, 'stranger@example.com');
  await expect(page.getByText('is not set up to edit this café')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});

test('admin: stock and visibility changes reach guests', async ({ browser, page }) => {
  const admin = await adminPage(browser);
  await admin.getByLabel('Malai Chai in stock').click();
  await expect(admin.locator('.toast')).toContainText('Malai Chai marked out of stock');
  await admin.locator('.admin-item-body', { hasText: 'Milo' }).click();
  await admin.getByLabel('Show on menu').click();
  await admin.getByRole('button', { name: 'Save' }).click();
  await expect(admin.locator('.toast')).toContainText('Saved');

  await guest(page);
  await expect(page.locator('.item.item-off', { hasText: 'Malai Chai' })).toContainText('Currently unavailable');
  await expect(page.locator('.item', { hasText: 'Milo' })).toHaveCount(0);
  await expect(page.locator('.item')).toHaveCount(112);
});

test('admin: two managers at once, a stale editor does not undo the other\'s stock change', async ({ browser }) => {
  const a = await adminPage(browser);
  await a.locator('.admin-item-body', { hasText: 'Rusk' }).click(); // A's editor: Rusk in stock

  const b = await adminPage(browser);
  await b.getByLabel('Rusk in stock').click();
  await expect(b.locator('.toast')).toContainText('Rusk marked out of stock');

  await a.getByLabel('Description').fill('Crisp, baked fresh');
  await a.getByRole('button', { name: 'Save' }).click();
  await expect(a.locator('.toast')).toContainText('Saved');

  await b.reload();
  await expect(b.getByLabel('Rusk in stock')).toHaveAttribute('aria-checked', 'false');
  await expect(b.locator('.admin-item', { hasText: 'Rusk' })).toBeVisible();
});

test('admin: move an item to another category and reorder it there', async ({ browser }) => {
  const admin = await adminPage(browser);
  await admin.locator('.admin-item-body', { hasText: 'Hindustani Chai' }).click();
  await admin.getByLabel('Category').selectOption({ label: 'Shakes' });
  await admin.getByRole('button', { name: 'Save' }).click();
  await expect(admin.locator('.toast')).toContainText('Saved');
  await admin.reload();
  const shakes = admin.locator('.admin-cat', { has: admin.getByRole('button', { name: 'Shakes', exact: true }) });
  await expect(shakes.locator('.admin-item').last()).toContainText('Hindustani Chai');
  await shakes.getByLabel('Move Hindustani Chai up').click();
  await expect(admin.locator('.toast')).toContainText('Reordered');
  await admin.reload();
  await expect(shakes.locator('.admin-item').nth(-2)).toContainText('Hindustani Chai');
});

test('admin: mark all in stock', async ({ browser }) => {
  const admin = await adminPage(browser);
  await admin.getByRole('button', { name: 'Mark all in stock' }).click();
  await admin.getByRole('button', { name: /Tap again: mark 2 back in stock/ }).click();
  await expect(admin.locator('.toast')).toContainText('2 items back in stock');
  await admin.reload();
  await expect(admin.getByRole('button', { name: /Out of stock \(0\)/ })).toBeVisible();
});

test('admin: settings save and show on the guest splash', async ({ browser, page }) => {
  const admin = await adminPage(browser);
  await admin.getByRole('button', { name: 'Café settings' }).click();
  await admin.getByLabel('Splash announcement (leave empty to turn the splash off)').fill('Monsoon menu now live');
  await admin.getByRole('button', { name: 'Save settings' }).click();
  await expect(admin.getByRole('button', { name: 'Saved ✓' })).toBeVisible();
  await page.goto('/');
  await expect(page.locator('.splash-text')).toHaveText('Monsoon menu now live');
});

test('admin: inboxes show submissions; a lead can be deleted', async ({ browser }) => {
  const admin = await adminPage(browser);
  await admin.getByRole('button', { name: 'Feedback' }).click();
  await expect(admin.locator('.inbox li')).toContainText('Great chai');
  await expect(admin.locator('.inbox li')).toContainText('Table 5');
  await admin.getByRole('button', { name: 'Partner enquiries' }).click();
  await expect(admin.locator('.inbox li')).toContainText('9876543210');
  await admin.getByRole('button', { name: 'Delete' }).click();
  await admin.getByRole('button', { name: 'Tap again to delete' }).click();
  await expect(admin.getByText('No partner enquiries yet.')).toBeVisible();
  await admin.reload();
  await admin.getByRole('button', { name: 'Partner enquiries' }).click();
  await expect(admin.getByText('No partner enquiries yet.')).toBeVisible();
});

test('security: the public key alone cannot read submissions, change the menu or sign up', async ({ request }) => {
  const url = process.env.SB_API_URL!;
  const h = { apikey: process.env.SB_KEY!, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  // Refused outright (no privilege) or allowed with zero rows (RLS): either way nothing leaks or changes.
  const nothing = async (res: { ok(): boolean; json(): Promise<unknown> }) => !res.ok() || (await res.json() as unknown[]).length === 0;
  expect(await nothing(await request.get(`${url}/rest/v1/feedback?select=*`, { headers: h }))).toBe(true);
  expect(await nothing(await request.get(`${url}/rest/v1/partner_enquiries?select=*`, { headers: h }))).toBe(true);
  expect(await nothing(await request.get(`${url}/rest/v1/menu_audit?select=id`, { headers: h }))).toBe(true);
  expect(await nothing(await request.patch(`${url}/rest/v1/items?name=eq.Samosa`, { headers: h, data: { price: 1 } }))).toBe(true);
  expect(await nothing(await request.delete(`${url}/rest/v1/items?price=gte.0`, { headers: h }))).toBe(true);
  expect(await nothing(await request.patch(`${url}/rest/v1/outlets?slug=eq.chq-capital`, { headers: h, data: { announcement: 'x' } }))).toBe(true);
  const menu = await (await request.get(`${url}/rest/v1/items?select=price&name=eq.Samosa`, { headers: h })).json();
  expect(menu).toEqual([{ price: 29 }]);
  const signup = await request.post(`${url}/auth/v1/signup`, { headers: h, data: { email: 'intruder@example.com', password: 'Test-pass-123' } });
  expect(signup.ok()).toBe(false);
});
