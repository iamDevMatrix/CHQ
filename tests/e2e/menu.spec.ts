import { expect, test, type Page } from '@playwright/test';

// file:// URL from config; `?t=` and hash routes appended per test
const open = async (page: Page, suffix = '') => {
  await page.goto(test.info().project.use.baseURL + suffix);
  const splash = page.locator('.splash');
  if (await splash.count()) await splash.click();
  await expect(page.locator('.item').first()).toBeVisible();
};

test('FR-03: all PDF items render', async ({ page }) => {
  await open(page);
  await expect(page.locator('.item')).toHaveCount(113);
});

test('FR-11/13/14: list totals follow live availability', async ({ page }) => {
  await open(page, '?t=7');
  await page.getByLabel('Add Malai Chai').click();
  await page.getByLabel('Add Hindustani Chai').click();
  await expect(page.locator('.cart-bar')).toContainText('₹68');

  await page.goto(test.info().project.use.baseURL + '?t=7#/admin');
  await page.getByLabel('Malai Chai in stock').click();
  await page.getByText('View guest menu').click();

  await expect(page.locator('.item.item-off', { hasText: 'Malai Chai' })).toHaveCount(1);
  await expect(page.locator('.cart-bar')).toContainText('₹29');
});

test('FR-05: hidden item disappears for guests', async ({ page }) => {
  await page.goto(test.info().project.use.baseURL + '#/admin');
  await page.locator('.admin-item-body', { hasText: 'Milo' }).click();
  await page.getByLabel('Show on menu').click();
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByText('View guest menu').click();
  await expect(page.locator('.item', { hasText: 'Milo' })).toHaveCount(0);
});

test('FR-29/30: feedback and partner lead reach admin', async ({ page }) => {
  await open(page, '?t=4');
  await page.locator('.about-btn').click();
  const partner = page.locator('#partner');
  await partner.getByLabel('Name').fill('Ravi Kumar');
  await partner.getByLabel('Mobile').fill('+91 98765 43210'); // autofill format, 15 chars
  await expect(partner.locator('.consent')).toContainText('To have them deleted'); // FR-31
  await partner.getByRole('button', { name: 'Send enquiry' }).click();
  await expect(partner.locator('.note')).toContainText('Thanks, Ravi');

  await page.getByText('Share feedback').click();
  await page.getByLabel('4 stars').click();
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.locator('.thanks')).toBeVisible();

  await page.goto(test.info().project.use.baseURL + '#/admin');
  await page.getByRole('button', { name: 'Feedback' }).click();
  await expect(page.locator('.inbox li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Partner enquiries' }).click();
  await expect(page.locator('.inbox li')).toContainText('9876543210');
});

test('FR-29 / NFR-09: admin can delete a lead on request', async ({ page }) => {
  await open(page);
  await page.locator('.about-btn').click();
  const partner = page.locator('#partner');
  await partner.getByLabel('Name').fill('Asha');
  await partner.getByLabel('Mobile').fill('9123456780');
  await partner.getByRole('button', { name: 'Send enquiry' }).click();
  await page.goto(test.info().project.use.baseURL + '#/admin');
  await page.getByRole('button', { name: 'Partner enquiries' }).click();
  await page.locator('.inbox li', { hasText: 'Asha' }).getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Tap again to delete' }).click();
  await expect(page.getByText('No partner enquiries yet.')).toBeVisible();
});

test('NFR-07: guest touch targets are at least 44 px', async ({ page }) => {
  await open(page);
  await page.getByLabel('Add Malai Chai').click();
  const targets = [page.getByLabel('Decrease').first(), page.getByLabel('Increase').first(), page.getByLabel('Add Hindustani Chai'), page.locator('.about-btn'), page.locator('.chip').first()];
  for (const t of targets) {
    const box = await t.boundingBox();
    expect(box && Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  }
});

test('Two admins: a stale screen does not undo a colleague\'s stock change', async ({ context }) => {
  const url = test.info().project.use.baseURL + '#/admin';
  const a = await context.newPage();
  await a.goto(url);
  await a.locator('.admin-item-body', { hasText: 'Malai Chai' }).click(); // A opens the editor with Malai Chai in stock

  const b = await context.newPage();
  await b.goto(url);
  await b.getByLabel('Malai Chai in stock').click(); // B marks it out of stock
  await expect(b.getByLabel('Malai Chai in stock')).toHaveAttribute('aria-checked', 'false');

  await a.getByLabel('Description').fill('Slow-brewed with fresh cream'); // A only edits the description
  await a.getByRole('button', { name: 'Save' }).click();
  await expect(a.locator('.toast')).toContainText('Saved');

  await b.reload();
  await expect(b.getByLabel('Malai Chai in stock')).toHaveAttribute('aria-checked', 'false');
  await b.goto(test.info().project.use.baseURL);
  await expect(b.locator('.item.item-off', { hasText: 'Malai Chai' })).toContainText('Slow-brewed with fresh cream');
});

test('FR-22: an item moved to another category can be reordered there', async ({ page }) => {
  await page.goto(test.info().project.use.baseURL + '#/admin');
  await page.locator('.admin-item-body', { hasText: 'Hindustani Chai' }).click();
  await page.getByLabel('Category').selectOption({ label: 'Shakes' });
  await page.getByRole('button', { name: 'Save' }).click();
  const shakes = page.locator('.admin-cat', { has: page.getByRole('button', { name: 'Shakes', exact: true }) });
  await expect(shakes.locator('.admin-item').last()).toContainText('Hindustani Chai'); // lands at the end, no order clash
  await shakes.getByLabel('Move Hindustani Chai up').click();
  await expect(shakes.locator('.admin-item').nth(-2)).toContainText('Hindustani Chai');
});

test('FR-25: mark all in stock', async ({ page }) => {
  await page.goto(test.info().project.use.baseURL + '#/admin');
  await page.getByLabel('Malai Chai in stock').click();
  await page.getByLabel('Rusk in stock').click();
  await page.getByRole('button', { name: 'Mark all in stock' }).click();
  await page.getByRole('button', { name: /Tap again: mark 2 back in stock/ }).click();
  await expect(page.locator('.toast')).toContainText('2 items back in stock');
  await expect(page.getByRole('button', { name: /Out of stock \(0\)/ })).toBeVisible();
});
