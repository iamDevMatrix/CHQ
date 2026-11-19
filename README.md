# CHQ Capital Digital Menu

Browser-only QR menu with a "My list" and an admin panel. React + TypeScript + Vite, Supabase backend, static hosting.

- Guest menu: `/` (optionally `/?t=7` for table 7)
- Admin: `/#/admin`

**Developers: start with `docs/DEVELOPER.md`.**

Docs: `docs/REQUIREMENTS.md` (requirements, FR/NFR IDs), `docs/BUILD_PLAN.md` (how it is built), `ARCHITECTURE.md` (design decisions). Claude Code config: `CLAUDE.md`, `.claude/`, `.mcp.json`.

## Run locally (demo mode, no backend)

```bash
npm install
npm run dev
```

With no Supabase env vars, the app runs in demo mode: the menu lives in the browser's localStorage, seeded from `src/data/seed.json`. Admin needs no login. Use it to review the UI only. `npm run build` refuses to build without Supabase settings, so demo mode cannot reach the real QR.

## Go live

### 1. Supabase (once)

1. Create a Supabase project (region: Mumbai, `ap-south-1`). Use a company email as the owner, not a personal one.
2. SQL editor: run `supabase/schema.sql`, then `supabase/seed.sql`.
3. Authentication > Sign In / Providers: turn off "Allow new users to sign up".
4. Authentication > Users > Add user: create a login for each manager (email + password, auto-confirm). Then make each one an admin in the SQL editor:
   ```sql
   insert into outlet_admins (outlet_id, user_id)
   select o.id, u.id from outlets o, auth.users u
   where o.slug = 'chq-capital' and u.email = 'manager@example.com';
   ```
   A login that skips this step can sign in but sees "not set up to edit this café" and cannot change anything.
5. Project Settings > API: copy the Project URL and the publishable (or legacy anon) key. Both are safe in the browser; the database rules decide what they can do.

### 2. Hosting from GitHub (pick one)

**GitHub Pages (workflow included).**
1. Push this repo to GitHub.
2. Settings > Pages > Build and deployment > Source: **GitHub Actions**.
3. Settings > Secrets and variables > Actions > **Variables**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (and `VITE_OUTLET_SLUG` only if it is not `chq-capital`).
4. Actions > deploy > Run workflow (later pushes to `main` deploy automatically). The site appears at `https://<user>.github.io/<repo>/`.
5. Custom domain (e.g. `menu.chqhub.in`): Settings > Pages > Custom domain, then add the CNAME record your DNS provider shows. Tick "Enforce HTTPS".

**Cloudflare Pages, Vercel or Netlify.** Import the GitHub repo. Build command `npm run build`, output folder `dist`, and the same two environment variables. No other settings are needed: routing is hash-based, so there are no rewrite rules.

### 3. QR codes

Generate one QR per table for `https://<your-domain>/?t=<table>`, or one for `https://<your-domain>/`. The URL never changes when the menu changes, so print once. Put the URL as text under the QR.

### 4. Before printing QRs

- Open the live URL on a real iPhone (Safari and Instagram/WhatsApp in-app) and a mid-range Android (Chrome, Samsung Internet). These have not been tested on real devices.
- Sign in at `/#/admin` as each manager and flip one item out of stock and back.

## Day-to-day

- Out of stock: admin > flip the item's switch. Guests see it greyed within 60 s (or when they return to the tab).
- Start of day: admin > "Mark all in stock".
- A guest asks for their details to be deleted: admin > Feedback or Partner enquiries > Delete on their entry.
- Who changed what: `select * from menu_audit order by changed_at desc limit 50;` in the SQL editor.

## Editing the starting menu

`src/data/seed.json` is the single source for the initial menu. After changing it, run `npm run seed:sql` to regenerate `supabase/seed.sql` (CI fails if you forget). Once live, all edits happen in the admin panel.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local dev server (demo mode unless `.env` has Supabase values) |
| `npm run build` | Production build to `dist/`. Fails without Supabase env vars |
| `npm run size` | Guest download vs the 70 KB gzipped budget (after `build`) |
| `npm run build:demo` | Single self-contained HTML demo to `dist-demo/` |
| `npm run seed:sql` / `seed:check` | Regenerate / verify seed SQL from seed.json |
| `npm test` | Typecheck + Playwright (demo build and production build against a faked Supabase API) |
| `npm run test:db` | Schema and security tests on Postgres (`PGHOST`, `PGPORT`, `PGUSER`) |
| `npm run test:supabase` | Production build against a real local Supabase stack (needs Docker): sign-in, admin edits, guest view, forms, security checks through the API gateway |
