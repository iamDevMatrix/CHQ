# CHQ Capital Digital Menu: How I Would Build It (SDE view)

Companion to `REQUIREMENTS.md`. This covers how the work is run in Claude Code, what Ponytail changes, and what I would cut from the build that already exists.

---

## 1. Ponytail audit of the current build

Ponytail's rule: before writing code, stop at the first rung that holds. Does it need to exist? Is it already in the codebase? Standard library? Native platform feature? Installed dependency? One line? Only then the minimum that works. It never cuts validation, data-loss handling, security or accessibility.

I applied that to the 1,868 lines I wrote. Findings, worst first.

| # | What | Ladder rung it fails | Recommendation | Lines saved (approx.) |
|---|---|---|---|---|
| 1 | Three freshness mechanisms for guests: Supabase Realtime, refetch on tab focus, 60 s poll | "Does this need to exist?" The requirement (FR-06) is "within 60 s". Poll + focus meets it alone. Realtime also misses hide events because RLS filters them, so it isn't even complete. | **Cut Realtime.** Drop the `subscribe` code in `supabase.ts` and the publication line in SQL. Keep focus + poll. | ~25, plus one moving part in production |
| 2 | `isBestseller` flag and badge | Not in the brief, not in the PDF | Cut, or confirm with management (Open Question 8) | ~10 + 1 column |
| 3 | `imageUrl` field, thumbnails, https check | Not in the brief. The PDF's photos are decorative, not per item | Cut until someone asks for item photos | ~10 + 1 column |
| 4 | `menu_audit` table and trigger | Not asked. But it is the only record of who did what in a shared-staff setting, and costs no app code | **Keep.** Cheap, and it answers disputes. Add a retention rule (REQUIREMENTS §8). | 0 |
| 5 | Search and Veg-only filter | Not in brief. Veg-only is standard on Indian menus; search earns its keep at 107 items | Keep both, confirm (Open Question 8) | 0 |
| 6 | Up/down reorder for items and categories | Brief says "editable", not "reorderable". But without it a new item lands at the bottom with no fix | Keep | 0 |
| 7 | Demo repo (`demo.ts`) alongside Supabase repo | Exists only to show the client a working demo without a backend | Keep until sign-off, then delete `demo.ts` and the demo build target | ~105 after sign-off |
| 8 | Client-side 1/min form throttle | Real spam protection is DB checks, already present. Throttle is a UX guard against double taps, which the disabled button already covers | Low value. Keep, it's 6 lines | 0 |
| 9 | Stepper buttons 30 × 34 px | **Accessibility: never cut.** Below the 44 px target (NFR-07) | **Fix, do not cut** | +0 |
| 10 | Feedback and partner forms collect phone numbers without a notice | **Data handling: never cut.** FR-31 / NFR-09 | **Add** a one-line notice | +~10 |

Net: about 150 lines out, about 10 in, and one fewer production service (Realtime). **Decision for Chief:** items 1 to 3 change behaviour, so I have not applied them. Say which to cut.

**Update (production pass):** item 1 applied (Realtime removed; admin writes made per-field first so freshness via poll is safe). Items 9 and 10 fixed. Items 2 and 3 (bestseller, image URL) are still in, pending Open Question 8. The Ponytail audit findings 1 to 13 are fixed; see git history.

What Ponytail would not have caught: the database test runner I wrote first reported "passed" when psql could not connect. I found it by breaking a policy on purpose and checking the test failed. That check is now in the plan (section 6).

## 2. Claude Code setup in this repo

All of these are committed in the zip.

| File | What it does | Why |
|---|---|---|
| `CLAUDE.md` | Project brief, commands, rules (RLS for every table, whole rupees, 44 px targets, 70 KB budget, no new deps without reason), and "Done means" | Every session starts with the constraints instead of rediscovering them |
| `.claude/settings.json` | Allows npm scripts, tsc, Playwright and read-only git. **Denies** reading `.env`, `git push`, and `supabase db reset`. A Stop hook runs typecheck and blocks finishing if it fails. Declares the Ponytail marketplace and enables the plugin | Claude cannot leak keys, push, or wipe the database; cannot say "done" on broken types. Ponytail is offered on first open, no manual install |
| `.mcp.json` | Playwright MCP (phone viewport) and Supabase MCP in **read-only** mode | Claude can drive the real UI and inspect the live schema without being able to change production data |
| `.claude/agents/mobile-qa.md` | Subagent that runs acceptance criteria from `REQUIREMENTS.md` on phone viewports, reports with evidence, never edits code | Separate checker so the code is not grading itself |
| `.claude/commands/ship-check.md` | `/ship-check`: typecheck, build size vs budget, e2e, DB tests if SQL changed, `/ponytail-review`, mobile QA, security review if data layer changed; ends SHIP or HOLD | One command as the merge gate |
| `.claude/commands/menu-from-pdf.md` | `/menu-from-pdf <pdf>`: extracts a new Canva menu into `seed.json`, shows a diff, waits for approval | Next menu revision is a 5-minute job |
| `.github/workflows/ci.yml` | Typecheck, seed check, production build + 70 KB size budget, Playwright (Chromium + WebKit, demo build and production build against a faked Supabase API), DB tests on Postgres 16; on every pull request and push to `main` | Safari engine coverage I could not get in this sandbox |
| `.github/workflows/deploy.yml` | On push to `main`: typecheck, build (fails without Supabase vars), size check, publish to GitHub Pages | Hosting straight from GitHub |
| `tests/e2e/menu.spec.ts`, `live.spec.ts` | 13 Playwright tests: FR-03, 05, 11, 13, 14, 22, 25, 29, 30, 31, NFR-07, two-admin concurrency, production request shapes, offline fallback, bundle split | Passed 13/13 on Chromium here |
| `tests/db/` | 27 assertions on RLS, grants, constraints, per-field updates and audit; runs on plain Postgres with Supabase stand-ins, using only the schema's own grants | Passed 27/27; fails when a policy is broken (checked) |

### Plugins

| Plugin | Install | Role here |
|---|---|---|
| Ponytail (v5.3.3 at time of setup) | Declared in `.claude/settings.json`; Claude Code offers it when you trust the repo. Manual fallback: `/plugin marketplace add DietrichGebert/ponytail`, then `/plugin install ponytail@ponytail`. Needs Node on PATH. Run `full` mode. Leave the optional webhook settings unset; they send task data off the machine. | Stops scope creep in every session; `/ponytail-review` on each branch; `/ponytail-debt` to track deferred `shortcut:` comments |
| backend-design (already in your setup) | n/a | `security-reviewer` and `schema-reviewer` subagents on any change under `supabase/` or `src/repo/` |
| frontend-design / design-superpowers (already in your setup) | n/a | Only if the visual design is reworked; `design:accessibility-review` for NFR-07 |

## 3. Working loop per feature

1. **Plan mode** (Shift+Tab twice). Claude reads the FR, the files it touches, and proposes a plan. Ponytail's ladder applies here: most rejected work dies at "does this need to exist?".
2. Approve the plan. Claude implements on a branch. For two independent features, use two git worktrees and two sessions.
3. Stop hook runs typecheck automatically.
4. `/ship-check`. HOLD means fix and rerun.
5. Commit with the FR ID. PR. CI runs the same tests plus WebKit.
6. Checkpoints (Esc twice) to rewind if a direction is wrong, instead of patching on top.

## 4. Phases

Durations are my estimates for one developer using Claude Code; not based on measured velocity.

| Phase | Work | Exit criteria | Est. |
|---|---|---|---|
| 0. Sign-off | Answer REQUIREMENTS §11; decide Ponytail items 1 to 3 | Signed requirements v1.0 | 2 to 3 days (stakeholder time) |
| 1. Close gaps | FR-31 consent notice; NFR-07 44 px steppers; apply chosen cuts; FR-25 "all in stock" reset if confirmed | `/ship-check` SHIP | 1 day |
| 2. Real-device pass | iPhone (Safari + Instagram in-app), mid-range Android (Chrome + Samsung Internet + WhatsApp in-app), slow 4G | No blocker on the device matrix | 0.5 day |
| 3. Go-live | Supabase project (Mumbai), admin users, domain, deploy, print QRs, 15-min manager training | Manager marks an item out of stock unaided in under 15 s | 1 day |
| 4. After 2 weeks live | FR-32 lead alerts, FR-34 scan counts, FR-33 CSV, based on what the inboxes show | Driven by usage, not built in advance | as needed |

## 5. Deliberately not built (Ponytail "does this need to exist?")

Service worker/PWA, i18n, item images, ordering, payments, analytics SDK, state-management library, CSS framework, component library, server code. Each was considered and rejected because no requirement needs it yet. Reopen when a requirement does.

## 6. What is still unverified

- **Real devices:** no real iPhone or Android has opened it yet. WebKit tests will run in CI; they could not be installed in this sandbox.
- **Supabase build:** the production build is tested end to end against a real local Supabase stack (`npm run test:supabase`: Auth, REST API, gateway, Postgres with this schema), with both the publishable key and the legacy anon key. Not yet run against the hosted Supabase project; the hosted dashboard settings (sign-ups off, admin logins) are manual steps in the README.
- **Slow networks:** load time on a slow 4G profile has not been measured.
- **Free tiers:** current Supabase and hosting free-tier limits have not been checked.
- **Legal:** the DPDP reading in REQUIREMENTS NFR-09 needs legal confirmation.
- **Ponytail itself:** now installed and enabled for the project, but not yet run on this code. The audit in section 1 applies its published decision ladder by hand; a real `/ponytail-audit` run may disagree with it.

Sources: Ponytail README (github.com/DietrichGebert/ponytail); flaviocopes.com/ponytail.
