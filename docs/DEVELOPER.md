# CHQ Capital Digital Menu: Developer Guide

Handover guide for the developer who takes over this codebase. Read this first, then `docs/REQUIREMENTS.md` for what the app must do (FR-/NFR- IDs) and `ARCHITECTURE.md` for why it is built this way.

## 1. What this is

A menu that opens in the phone's browser when a guest scans a QR code at CHQ Capital (rooftop café, Jain Sadguru Capital Park). Guests browse, build a "My list" and show it to staff. There is no ordering or payment. Managers use an admin page to change items, prices, stock, splash text and café details, and to read feedback and partner leads.

| | |
|---|---|
| Guest menu | `https://<domain>/` or `/?t=<table>` |
| Admin | `https://<domain>/#/admin` |
| Frontend | React 18, TypeScript, Vite. Static files, no server code |
| Backend | Supabase: Postgres with Row Level Security (RLS), Auth, REST API |
| Hosting | GitHub Pages (workflow included), or Cloudflare Pages, Vercel, Netlify |
| Size | About 2,000 lines of app code |

## 2. Get it running

Requirements: Node.js 22 (20.12 or later works), npm. For the database tests: a PostgreSQL 16 client and server. For the real-Supabase tests: Docker.

```bash
npm ci
```

```bash
npm run dev
```

Open the printed URL. With no `.env`, the app runs in **demo mode**: the menu is stored in the browser's localStorage, seeded from `src/data/seed.json`, and admin needs no login. Demo mode is for reviewing the UI only.

To run against Supabase locally, copy `.env.example` to `.env` and fill in:

| Variable | Where to find it | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase > Project Settings > API > Project URL | A path such as `/sb` also works if a same-origin proxy forwards it to Supabase |
| `VITE_SUPABASE_ANON_KEY` | Same page: publishable key (`sb_publishable_...`) or legacy anon key (`eyJ...`) | Public by design. RLS decides what it can do |
| `VITE_OUTLET_SLUG` | `outlets.slug` in the database | Defaults to `chq-capital` |

Never put the service role or secret key in any `VITE_` variable. Everything with that prefix ships to the browser.

## 3. Code map

```
src/
  main.tsx            Entry. Hash router (#/admin), error boundary ("Reload menu" screen)
  types.ts            Domain types, GuestRepo / AdminRepo interfaces, newId(), patchById()
  hooks.ts            useMenu (load, cache, 60 s poll, refetch on focus), useCart ("My list"), rupees()
  storage.ts          The only place that touches localStorage (Safari private mode throws)
  styles.css          All styles. Dark theme tokens at the top
  data/seed.json      Starting menu (113 items, from Capital_Park_Menu_V2_final.pdf). Single source for demo data and supabase/seed.sql
  data/seed.ts        Expands seed.json into rows for demo mode
  repo/
    index.ts          getGuestRepo() / getAdminRepo(): picks Supabase or demo, lazy-loads each
    rest.ts           Guest repo: plain fetch to Supabase REST. No supabase-js (keeps guest download small)
    supabase.ts       Admin repo: supabase-js for sign-in and writes. Loaded only on #/admin
    rows.ts           Database row shapes and camelCase <-> snake_case mappers, shared by both
    demo.ts           localStorage implementation of AdminRepo for demo mode
  pages/
    GuestMenu.tsx     Menu, search, veg filter, category chips, My list, staff view
    Extras.tsx        Splash, About sheet, feedback form, partner form, consent notice
    Admin.tsx         Sign-in, menu editor, stock switches, reorder, mark all in stock
    AdminExtras.tsx   Feedback and partner inboxes (with delete), café settings
supabase/
  schema.sql          Tables, constraints, triggers, RLS policies, grants. Run once per project
  seed.sql            Generated from seed.json (npm run seed:sql). Do not edit by hand
scripts/
  gen-seed-sql.mjs    seed.json -> seed.sql
  check-size.mjs      Fails if the guest download exceeds 70 KB gzipped
  test-supabase.sh    Starts a local Supabase stack, resets it, builds, runs tests/supabase
tests/
  e2e/menu.spec.ts    Demo build: guest and admin flows
  e2e/live.spec.ts    Production build with Supabase REST faked: request shapes, offline fallback, bundle split
  supabase/stack.spec.ts  Production build on a real local Supabase stack
  db/                 SQL tests for RLS, grants, constraints and audit on plain Postgres
.github/workflows/
  ci.yml              All tests on every pull request and push to main
  deploy.yml          Build and publish to GitHub Pages on push to main
```

## 4. How it works

### Data flow

- **Guest:** `useMenu(getGuestRepo)` shows the last saved copy from localStorage immediately, then fetches outlets, categories and items from Supabase REST. It refetches every 60 seconds while the tab is visible and whenever the tab regains focus (FR-06). There is no Realtime subscription.
- **Admin:** `useMenu(getAdminRepo)` loads everything, including hidden rows (RLS returns them to admins). Edits update the screen first, then save. On failure the screen reloads from the server and the editor stays open with the person's changes.

### Rules the code depends on

1. **Authorization lives in the database.** `supabase/schema.sql` RLS policies decide who reads and writes what. The browser checks only improve messages; they are not security.
2. **Admin writes send only changed fields.** `updateItem(id, patch)` and `updateCategory(id, patch)`, never a whole row. Two staff often edit at once, and a whole-row save from a stale screen would undo the other person's change.
3. **Every admin update and delete checks the row count.** RLS turns a blocked update into "0 rows changed" with no error. `src/repo/supabase.ts` adds `.select('id')` and throws if nothing changed, so the UI never shows "Saved" for a write that did not happen.
4. **Guests never load supabase-js.** It is about 61 KB gzipped. The guest download budget is 70 KB (NFR-02), checked by `npm run size` in CI.
5. **Money is whole rupees, integer.** The database rejects negatives, decimals and values above 99,999.
6. **One orderable variant is one item row**, because stock is per variant (Black Tea and Green Tea are separate).
7. **All localStorage access goes through `src/storage.ts`.** Safari private mode and in-app browsers throw on access.
8. **Inputs are 16 px** (stops iOS zoom). **Guest touch targets are at least 44 px** (NFR-07, tested).
9. **No em dashes in UI copy.**
10. **No new runtime dependency** without a written reason why the platform or existing code cannot do it.

### Database

| Table | Purpose | Guest (public key) | Admin |
|---|---|---|---|
| `outlets` | Café details, splash text, About, website link | Read | Read, update |
| `outlet_admins` | Which login may edit which outlet | None | Read own row |
| `categories` | Name, order, visible | Read visible | Full |
| `items` | Name, price, size, type, section, in stock, visible, order | Read visible | Full |
| `feedback` | Rating, comment, optional name and mobile, table | Insert only | Read, delete |
| `partner_enquiries` | Franchise leads | Insert only | Read, delete |
| `menu_audit` | Who changed what, before and after (trigger) | None | Read own outlet |

Two flags on items: `is_available = false` shows the item greyed as "Currently unavailable"; `is_active = false` hides it from guests.

`schema.sql` revokes Supabase's default "all privileges" on these tables and grants only the set above. Supabase's default includes `TRUNCATE`, which RLS does not cover.

## 5. Testing

| Command | What it checks | Needs |
|---|---|---|
| `npm run typecheck` | TypeScript | Nothing |
| `npm run test:e2e` | 13 Playwright tests: demo build flows and the production build against a faked Supabase API, in Chrome and Safari (WebKit) engines | Playwright browsers (`npx playwright install chromium webkit`) |
| `npm run test:db` | 27 SQL assertions: RLS, grants, constraints, per-field updates, audit | PostgreSQL 16; set `PGHOST`, `PGPORT`, `PGUSER` |
| `npm run test:supabase` | 10 tests of the production build on a real local Supabase stack: sign-in, non-admin login, stock reaching guests, two managers at once, forms, inbox delete, public-key security | Docker. Add `KEY=anon` to test the legacy anon key |
| `npm run build && npm run size` | Guest download under 70 KB gzipped | Supabase env vars (placeholders are fine) |
| `npm run seed:check` | `supabase/seed.sql` matches `seed.json` | Nothing |

CI (`.github/workflows/ci.yml`) runs all of these on every pull request and push to `main`.

If Playwright's own Chromium is not installed, set `CHROME_PATH` to a Chrome or Chromium binary.

Last local results at handover: typecheck clean; 13/13 e2e on Chromium; 27/27 DB; 10/10 on real local Supabase with both key types. WebKit runs only in CI (not available in the build environment).

When you change behaviour: write or update a test that fails without your change, then check it passes. The DB tests were checked this way (a broken delete policy makes them fail), and so was the two-managers test.

## 6. Deploy

### First deploy

1. **Supabase project** (README "Go live", steps 1 to 5). Create it under a company email, region Mumbai (`ap-south-1`). Run `supabase/schema.sql`, then `supabase/seed.sql`. Turn off public sign-ups. Create each manager's login and add them to `outlet_admins` with the SQL in the README.
2. **GitHub Pages.** Push to GitHub. Settings > Pages > Source: GitHub Actions. Settings > Secrets and variables > Actions > Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (and `VITE_OUTLET_SLUG` if not `chq-capital`). Run the `deploy` workflow.
3. **Domain.** Settings > Pages > Custom domain (e.g. `menu.chqhub.in`), add the CNAME record at the DNS provider, tick Enforce HTTPS.
4. **QR codes** for `https://<domain>/?t=<table>`. The URL never changes, so print once.

Other hosts: import the repo, build command `npm run build`, output folder `dist`, same environment variables. Routing is hash-based, so no rewrite rules are needed.

`npm run build` fails without the two Supabase variables. This is deliberate: it stops demo mode reaching the real QR.

### Every later deploy

Merge to `main`. `deploy.yml` typechecks, builds, checks the size budget and publishes.

### Database changes after go-live

`schema.sql` is written for a fresh project. For a live database, write the change as a separate migration SQL file, test it with `npm run test:db` and `npm run test:supabase`, then run it in the Supabase SQL editor. Back up first (Supabase > Database > Backups). Any new table needs RLS enabled, policies, grants in the privileges block, and a test in `tests/db/rls.test.sql`.

## 7. Common tasks

| Task | How |
|---|---|
| Change prices, items, stock, splash, About | Admin page. No code change |
| Add a manager | Supabase > Authentication > Users > Add user, then the `outlet_admins` insert from the README |
| Remove a manager | Delete their `outlet_admins` row, or delete the user |
| A guest asks for their details to be deleted | Admin > Feedback or Partner enquiries > Delete |
| Who changed an item | `select * from menu_audit where row_id = '<item id>' order by changed_at desc;` |
| Replace the starting menu (before go-live) | Edit `src/data/seed.json`, run `npm run seed:sql`, commit both. `.claude/commands/menu-from-pdf.md` extracts a new PDF menu into seed.json |
| Second outlet | Insert an `outlets` row with a new slug, add its categories, items and admins. Deploy a second site with `VITE_OUTLET_SLUG` set to that slug |
| Add a field to items | Column in `schema.sql` (with a check constraint), field in `types.ts`, mapping in `src/repo/rows.ts`, UI in `Admin.tsx`, a DB test, and a migration for the live database |

## 8. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Build fails: "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set" | Variables missing in `.env` or in GitHub > Actions > Variables |
| Guest page: "Menu could not load" | Wrong URL or key, or `VITE_OUTLET_SLUG` does not match `outlets.slug` |
| Manager signs in and sees "not set up to edit this café" | No `outlet_admins` row for that login (README step 4) |
| Admin save shows "Not saved: this account cannot edit this café, or the row was deleted by someone else" | Same as above, or another manager deleted that item |
| "Email logins are disabled" on sign-in | The Email provider is switched off in Supabase Auth settings. Only new sign-ups should be off |
| Guest still sees an old price | Pages refresh every 60 s or when the tab is reopened. A notice appears if the refresh is failing |
| CI fails on `seed:check` | `seed.json` changed without `npm run seed:sql` |
| CI fails on `size` | Something in guest code imports supabase-js or a large library |

## 9. Known gaps and open decisions

Not built (planned after two weeks live, driven by real usage):

- FR-32 alert when a partner lead arrives
- FR-33 CSV export of feedback and leads
- FR-34 QR scan counts
- Automatic deletion of old feedback, leads and audit rows. Proposed periods are in REQUIREMENTS section 8 and are not signed off

Not verified:

- Real iPhone and Android devices, including Instagram and WhatsApp in-app browsers (NFR-01)
- Load time on slow 4G (NFR-02 checks size only)
- The hosted Supabase project itself (tested on a local Supabase stack)
- Supabase and hosting free-tier limits (NFR-11)
- Consent notice wording against India's DPDP rules (needs a lawyer)

Open decisions for the business (REQUIREMENTS section 11): GST and service charge on prices; whether to keep the bestseller tag and image URL field; who gets admin logins and who reads leads.

## 10. Claude Code setup (optional)

The repo works with any editor. If you use Claude Code:

- `CLAUDE.md` gives every session the rules above and what "done" means.
- `.claude/settings.json` blocks reading `.env`, `git push` and `supabase db reset`, runs a typecheck before Claude finishes, and enables the Ponytail plugin (scope control).
- `.claude/skills/bmad-*` and `_bmad/` are the BMad Method planning skills (v6.12.4).
- `.mcp.json` connects Playwright and a read-only Supabase connection (pinned versions; needs `SUPABASE_PROJECT_REF` and `SUPABASE_ACCESS_TOKEN` in your environment).
- `/ship-check` runs the merge checklist.
