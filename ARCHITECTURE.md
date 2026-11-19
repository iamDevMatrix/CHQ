# CHQ Capital Digital Menu: Architecture

## 1. Scope (v1)

In: QR opens a browser menu. Guests browse, search, filter veg, and build a "My list" that persists on their phone. Admin edits items, prices, categories, order, and toggles availability (greyed "Currently unavailable", Zomato/Swiggy style) or hides items entirely.

Also in: a splash announcement, an About sheet (≡ button top right, plus footer links) with a link to the Chai City site, a "Partner with us" enquiry form, and a guest feedback form. Admin has an inbox for each and a Café settings tab to edit the splash text, About text, website link and contact details.

Out (by design): ordering, payments, KOT to kitchen, native apps. The data model does not block adding these later (see section 9).

## 2. Stack decision

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript | JavaScript is the only language every browser runs natively. TS adds compile-time checks with zero runtime cost. Anything else (Flutter Web, Blazor, Kotlin/JS) ships a heavier runtime and has weaker iOS Safari behaviour. |
| UI | React 18 + Vite | Largest hiring pool in Hyderabad, small enough here (56 KB gzipped guest download, checked in CI against a 70 KB budget; admin and supabase-js are separate chunks guests never load). |
| Backend | Supabase (managed Postgres + Auth) | No server code to write or patch. Authorization enforced in the database via Row Level Security. Free tier covers one outlet comfortably. |
| Hosting | GitHub Pages (workflow included) or Cloudflare Pages, Vercel, Netlify | The app is static files. Free SSL, no servers. The build fails without Supabase settings, so demo mode cannot be deployed by mistake. |
| Routing | Hash routes (`/#/admin`) | Works on any static host without rewrite rules. |

Rejected: Next.js/SSR (no SEO need, adds a server), Firebase (NoSQL makes the category/item constraints application-enforced instead of DB-enforced), a custom Node/Express API (a server to run and secure for what RLS already does), PWA/service worker in v1 (iOS cache invalidation pain; localStorage cache covers the real need).

## 3. System diagram

```
 Guest phone (Chrome / Safari)                 Admin phone or laptop
 ┌──────────────────────────┐                  ┌──────────────────────┐
 │ QR -> https://menu.../?t=7│                  │ https://menu.../#/admin│
 │ GuestMenu (React)         │                  │ Admin (lazy chunk)     │
 │  - menu cache (localStorage)                 │  - supabase-js, login  │
 │  - My list  (localStorage)│                  │  - per-field writes    │
 └──────┬────────────────────┘                  └──────────┬────────────┘
        │ fetch: read menu, insert forms                   │ write (JWT)
        │ (focus + 60 s poll)                              │
        ▼                                                  ▼
 ┌────────────────────────────────────────────────────────────────────┐
 │ Supabase: Postgres + RLS (REST API)  |  Auth                       │
 │ outlets, outlet_admins, categories, items, menu_audit, feedback,   │
 │ partner_enquiries                                                  │
 └────────────────────────────────────────────────────────────────────┘
        ▲
 Static files (GitHub Pages / Cloudflare Pages / Vercel)
```

## 4. Data model

```
outlets(id, slug UNIQUE, name, tagline, phone, email)
outlet_admins(outlet_id, user_id)                      -- who may edit which outlet
categories(id, outlet_id, name, sort_order, is_active) -- UNIQUE(outlet_id, name)
items(id, outlet_id, category_id, section, name, description, price INT rupees,
      size, food_type veg|egg|nonveg, is_available, is_active, is_bestseller,
      image_url, sort_order)                           -- UNIQUE(outlet_id, name)
menu_audit(table_name, row_id, action, changed_by, old_row, new_row, changed_at)
feedback(id, outlet_id, rating 1-5, comment, name, phone, table_no, created_at)
partner_enquiries(id, outlet_id, name, phone, city, message, created_at)
-- outlets also holds announcement, address, about, partner_text, website_url, website_label
```

Decisions worth knowing:

- Two flags, not one. `is_available=false` keeps the item visible but greyed (guest knows it exists, comes back for it). `is_active=false` removes it from the guest view (seasonal or discontinued). Same split Zomato uses.
- Every orderable variant is its own row. "Black Tea / Green Tea" became two items. Reason: availability is per variant (green tea runs out, black tea doesn't) and the staff list must name exactly what the guest wants.
- `section` is a text field ("Tea", "Coffee", "Nostalgic") inside a category, not a third table. Ordering follows item `sort_order`. Promote it to a table only if sections need their own images or visibility toggles.
- Price is integer rupees. No floats for money. The DB rejects negatives and values above 99,999.
- Composite FK `(category_id, outlet_id)` makes it impossible for an item to point at another outlet's category. `ON DELETE RESTRICT` means deleting a category with items fails instead of wiping part of the menu.
- `outlet_id` from day one. CHQ Capital is outlet one; a second CHQ or Chai City outlet is a new row plus a `VITE_OUTLET_SLUG`, not a rebuild.
- Splash text, About copy and the website link live on the outlet row, not in code. "Now open" is temporary; the manager clears the text and the splash disappears without a redeploy.
- Feedback and partner enquiries are insert-only for guests and readable only by that outlet's admins. The DB rejects ratings outside 1-5 and phone numbers that are not 10-digit Indian mobiles. The browser limits each phone to one submission a minute. If bot spam appears, put Cloudflare Turnstile in front of the inserts.
- `menu_audit` trigger records every change with the user who made it. Answers "who turned off Malai Chai at 4pm" with a SQL query, no app code.

## 5. Security

- The browser holds only the Supabase anon key. That is safe by design: RLS lets anon read active rows only.
- Writes require a signed-in user present in `outlet_admins` for that outlet. A signed-up stranger can authenticate but cannot write (tested: update returns 0 rows). Because RLS reports that as success with 0 rows, the admin app checks the row count on every update and delete, and checks `outlet_admins` right after sign-in.
- Supabase grants every table privilege to anon/authenticated by default, including TRUNCATE, which RLS does not cover. `schema.sql` revokes those on the app's tables and grants only what the app uses (anon: read menu, insert forms; authenticated: admin reads and writes). Checked on a real local Supabase stack.
- Admin writes send only the changed columns. Two staff editing at once cannot overwrite each other's fields with a stale screen.
- Admins can delete feedback and leads (to honour deletion requests); the change history is readable only by that outlet's admins.
- Admin accounts are created in the Supabase dashboard; disable public sign-ups in Auth settings.
- `image_url` must be https (DB check) to avoid mixed-content warnings on Safari.
- Tested: guests can submit feedback and enquiries but read back 0 rows; guests cannot edit the outlet row; admins can read both and edit settings.
- Tested against Postgres 16 with Supabase auth stubs: guest view hides inactive items and items in hidden categories, non-admin write blocked, invalid price rejected, category delete with items blocked, audit rows written.

## 6. Cross-browser (Chrome + Safari, Android + iOS)

| Risk | Handling |
|---|---|
| iOS zooms on input focus | All inputs 16px |
| Notch / home bar covers the cart bar | `viewport-fit=cover` + `env(safe-area-inset-bottom)` |
| `100vh` wrong on mobile Safari | Sheets use `88dvh` with `88vh` fallback |
| localStorage throws (Safari private mode, Instagram/WhatsApp in-app browsers) | All storage wrapped in try/catch; menu still renders, list just doesn't persist |
| Page scrolls behind open sheet on iOS | Body scroll locked while sheet open, `overscroll-behavior: contain` |
| Old iOS | Build target `safari13`; IDs fall back to `crypto.getRandomValues` (valid UUIDs) where `crypto.randomUUID` is missing |
| QR opened inside camera app / Google Lens webview | Plain HTTPS page, no popups, no third-party cookies needed |

## 7. Freshness and caching

- Guest load is stale-while-revalidate: last menu from localStorage paints instantly, then fetches fresh. Matters on weak café Wi-Fi.
- No Realtime. Open pages refetch on tab focus and every 60 seconds (FR-06). Realtime was removed: it duplicated the poll, missed hide events (RLS filters them), and was one more production service.
- If a refresh fails, the saved copy stays on screen with a notice that prices and availability may have changed.
- A render error shows a "Reload menu" screen that clears the saved copy, so a bad cache cannot keep the page broken.
- "My list" expires after 6 hours so yesterday's list doesn't greet today's visit. Prices are always taken from the live menu, never from the stored list; unavailable items are flagged and excluded from the total.

## 8. Operations

| Item | Detail |
|---|---|
| Environments | Supabase project per env (prod, staging). Same code, different env vars. |
| QR | One static URL per outlet, optionally `?t=<table>` per table. The URL never changes when the menu does, so QRs are printed once. |
| Backups | Supabase daily backups (check the plan you pick). `menu_audit` also allows row-level recovery. |
| Cost | Fits Supabase and Cloudflare Pages free tiers at one-outlet traffic. Verify current free-tier limits before committing; I have not checked them. |
| Deploy | Push to `main` runs `.github/workflows/deploy.yml` (typecheck, build, size budget, publish to GitHub Pages). `ci.yml` runs all tests on every pull request and push. |
| Monitoring | Supabase dashboard for DB/API errors. Add Sentry (free tier) to the frontend before scale-out. |

## 9. Roadmap hooks (not built)

1. Images: upload to Supabase Storage from the editor (field already exists).
2. Time-based availability (breakfast items till 11am): `available_from/available_to` columns.
3. Ordering: `orders` + `order_lines` tables, table number already captured from the QR. "My list" becomes the cart with no UI rework.
4. Multi-outlet admin switcher, using the existing `outlet_admins` mapping.
5. Analytics: log list adds per item to see what guests want versus what sells.
