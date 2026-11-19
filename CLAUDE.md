# CHQ Capital Digital Menu

QR-opened browser menu for CHQ Capital (rooftop café, Jain Sadguru Capital Park). Guests browse and build a list to show staff; no ordering. Admin edits menu, stock, splash, About.

Requirements: `docs/REQUIREMENTS.md` (FR-/NFR- IDs). Design decisions: `ARCHITECTURE.md`. Read the relevant FR before changing behaviour, and cite the FR ID in commit messages.

## Stack
React 18 + TypeScript + Vite. Supabase (Postgres + RLS + Auth). Static hosting (GitHub Pages workflow in `.github/workflows/deploy.yml`). Hash routes: `/` guest, `/#/admin` admin.
No env vars = demo mode (localStorage). `npm run build` refuses to build without Supabase vars.
Guest page talks to Supabase with plain fetch (`src/repo/rest.ts`); only admin loads supabase-js (`src/repo/supabase.ts`).

## Commands
- `npm run dev` local
- `npm run typecheck`
- `npm run test:e2e` Playwright on the demo build and on the production build with a faked Supabase API (set `CHROME_PATH` if Playwright's Chromium is not installed)
- `npm run build && npm run size` guest bundle budget (needs Supabase env vars, any placeholder works)
- `npm run test:db` schema + RLS tests on any Postgres (`PGHOST`, `PGPORT`, `PGUSER`)
- `npm run test:supabase` real local Supabase stack (Docker) + production build; run after any change to `src/repo/` or `supabase/`
- `npm run seed:sql` regenerate `supabase/seed.sql` from `src/data/seed.json`

## Rules
- Authorization lives in `supabase/schema.sql` RLS. Never add a check only in the browser. Any new table: RLS on, policies written, grants added to the privileges block, a line added to `tests/db/rls.test.sql`.
- Money is whole rupees, integer. No floats.
- One orderable variant = one item row (stock is per variant).
- Every localStorage/sessionStorage access goes through `src/storage.ts` (Safari private mode and in-app browsers throw).
- Inputs 16px (iOS zoom). Touch targets 44px. Respect `env(safe-area-inset-*)`.
- Guest bundle budget: 70 KB gzipped JS+CSS, enforced by `npm run size` in CI. Never import supabase-js from guest code.
- Admin writes send only changed fields (`updateItem(id, patch)`), never a whole row: two staff edit at once.
- RLS turns a blocked update/delete into 0 rows with no error: every admin update/delete uses `.select('id')` and checks the count.
- No new runtime dependency without saying why the platform or existing code can't do it.
- No em dashes in UI copy.

## Done means
typecheck passes, `test:e2e` passes, `test:db` and `test:supabase` pass if SQL or `src/repo/` changed, `/ponytail-review` run on the diff, and the reply says what was not tested (real iPhone, real Android).
