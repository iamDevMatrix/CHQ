import { expect, test, type Page, type Request } from '@playwright/test';
import seed from '../../src/data/seed.json' with { type: 'json' };

/**
 * Production code path (dist-live, built with .env.live) with Supabase's REST API answered here.
 * Checks the requests the guest page really sends: PostgREST filters, headers, insert body.
 * It does not prove the live Supabase project's settings; see README "Go live" for that.
 */
const API = 'https://example.supabase.co/rest/v1/';
const OUTLET_ID = '00000000-0000-4000-8000-000000000001';
type RawItem = [string, number, string, string?, string?];

function rows() {
  const o = seed.outlet;
  const outlet = {
    id: OUTLET_ID, slug: o.slug, name: o.name, tagline: o.tagline, phone: o.phone, email: o.email, announcement: '',
    address: o.address, about: o.about, partner_text: o.partnerText, website_url: o.websiteUrl, website_label: o.websiteLabel,
  };
  const categories: object[] = [];
  const items: object[] = [];
  seed.categories.forEach((c, ci) => {
    const cid = `00000000-0000-4000-8000-1${String(ci).padStart(11, '0')}`;
    categories.push({ id: cid, outlet_id: OUTLET_ID, name: c.name, sort_order: (ci + 1) * 10, is_active: true });
    let order = 0;
    for (const s of c.sections as { name: string; size?: string; items: RawItem[] }[])
      for (const [name, price, food_type, description = '', size] of s.items) {
        order += 10;
        items.push({
          id: `00000000-0000-4000-8000-2${String(items.length).padStart(11, '0')}`, outlet_id: OUTLET_ID, category_id: cid,
          section: s.name, name, description, price, size: size ?? s.size ?? '', food_type,
          is_available: name !== 'Malai Chai', is_active: true, is_bestseller: false, image_url: '', sort_order: order,
        });
      }
  });
  return { outlet, categories, items };
}

async function fakeSupabase(page: Page, opts: { down?: boolean } = {}) {
  const data = rows();
  const seen: Request[] = [];
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.route(API + '**', async (route) => {
    const req = route.request();
    seen.push(req);
    if (opts.down) return route.abort('internetdisconnected');
    const path = new URL(req.url()).pathname.replace('/rest/v1/', '');
    if (req.method() === 'POST') return route.fulfill({ status: 201, body: '' });
    const body = path === 'outlets' ? [data.outlet] : path === 'categories' ? data.categories : path === 'items' ? data.items : [];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return seen;
}

test('guest menu loads from Supabase REST with correct filters and headers', async ({ page }) => {
  const seen = await fakeSupabase(page);
  await page.goto('/?t=3');
  await expect(page.locator('.item')).toHaveCount(113);
  await expect(page.locator('.item.item-off', { hasText: 'Malai Chai' })).toContainText('Currently unavailable');

  const urls = seen.map((r) => decodeURIComponent(r.url()));
  expect(urls.some((u) => u.includes('outlets?select=') && u.includes('slug=eq.chq-capital'))).toBe(true);
  expect(urls.some((u) => u.includes(`items?select=*&outlet_id=eq.${OUTLET_ID}&order=sort_order`))).toBe(true);
  expect(urls.some((u) => u.includes(`categories?select=`) && u.includes(`outlet_id=eq.${OUTLET_ID}`))).toBe(true);
  const h = seen[0].headers();
  expect(h['apikey']).toBe('sb_publishable_test_placeholder');
  expect(h['authorization']).toBeUndefined(); // publishable keys are not JWTs
});

test('guest feedback is a minimal insert with outlet and table attached', async ({ page }) => {
  const seen = await fakeSupabase(page);
  await page.goto('/?t=3');
  await page.locator('.about-btn').click();
  await page.getByText('Share feedback').click();
  await page.getByLabel('5 stars').click();
  await page.getByLabel('Mobile (optional)').fill('+91 98765 43210');
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.locator('.thanks')).toBeVisible();

  const post = seen.find((r) => r.method() === 'POST')!;
  expect(post.url()).toBe(API + 'feedback');
  expect(post.headers()['prefer']).toBe('return=minimal');
  expect(post.postDataJSON()).toMatchObject({ outlet_id: OUTLET_ID, rating: 5, phone: '9876543210', table_no: '3' });
});

test('guest sees the saved menu with a warning when Supabase is unreachable', async ({ browser }) => {
  const context = await browser.newContext();
  const first = await context.newPage();
  await fakeSupabase(first);
  await first.goto('/');
  await expect(first.locator('.item')).toHaveCount(113);
  await first.close();

  const second = await context.newPage();
  await fakeSupabase(second, { down: true });
  await second.goto('/');
  await expect(second.locator('.item')).toHaveCount(113);
  await expect(second.locator('.notice')).toContainText('Showing a saved copy');
  await context.close();
});

test('guest page does not download the Supabase library; admin does', async ({ page }) => {
  await fakeSupabase(page);
  const scripts: string[] = [];
  page.on('request', (r) => r.resourceType() === 'script' && scripts.push(r.url()));
  await page.goto('/');
  await expect(page.locator('.item').first()).toBeVisible();
  expect(scripts.some((u) => /supabase-.*\.js/.test(u))).toBe(false);

  await page.goto('/#/admin');
  await expect(page.getByRole('heading', { name: 'Menu admin' })).toBeVisible(); // sign-in form
  expect(scripts.some((u) => /supabase-.*\.js/.test(u))).toBe(true);
});
