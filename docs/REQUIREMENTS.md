# CHQ Capital Digital Menu: Requirements

| | |
|---|---|
| Version | 0.9 (draft for stakeholder sign-off) |
| Date | 14 Nov 2026 |
| Source inputs | Chief's brief (chat, 13 to 14 Nov 2026), `Capital_Park_Menu_V2.pdf` (12 pages), chaicity.in |
| Status key | **Built** = in the current build and tested. **Gap** = required, not built. **Assumed** = I decided without stakeholder input; confirm. |

Anything marked "Assumed" or listed under Open Questions has not been validated with CHQ operations. Treat this as a draft until section 11 is answered.

---

## 1. Problem and goal

CHQ Capital is a rooftop café at Jain Sadguru Capital Park, newly opened. The menu exists as a 12-page Canva PDF. Problems with that:

1. A PDF cannot show what is out of stock. Guests order, staff say "not available", guest re-orders. Every miss costs a round trip.
2. Price or item changes need a redesign and reprint/re-share.
3. Guests cannot shortlist items before calling a waiter.
4. There is no channel for feedback or franchise leads at the point of highest attention (seated guest, phone in hand).

**Goal:** a QR-opened browser menu that is always current, lets guests build a list to show staff, and captures feedback and partner leads. No ordering or payment in this phase.

**Success measures (proposed, no baseline exists):**

| Measure | How to read it |
|---|---|
| Share of tables that scan the QR | Scan count vs covers per day. Needs scan logging (Gap, see FR-30). |
| "Not available" misses at order time | Staff tally for 2 weeks before and after launch. Manual. |
| Time from price decision to live menu | Target: under 2 minutes, by the manager, no developer. |
| Feedback responses per week | From admin inbox. |
| Partner leads per month | From admin inbox. |

## 2. Stakeholders

| Stakeholder | Interest | What they need from this | Elicitation status |
|---|---|---|---|
| CHQ Hospitality Hub management (sponsor) | Brand, revenue, franchise pipeline | Professional menu, leads captured, cost near zero | Brief received via Chief |
| Café manager (CHQ Capital) | Daily operations | Mark items out of stock in seconds, change prices without help | **Not interviewed** |
| Floor staff / waiters | Speed at the table | Readable guest list, table number on it | **Not interviewed** |
| Kitchen | Stock reality | Someone keeps availability honest | **Not interviewed** |
| Guests (Capital Park office workers, visitors) | Quick choice, fair price | Fast load on mobile data, clear veg/non-veg, no app install | Inferred |
| Chai City franchise team | Leads | Partner enquiries routed to them, link to chaicity.in | Inferred from brief |
| Capital Park facility management | Tenant amenity | Possibly: listing the café in a park tenant app later | Inferred; not raised in brief |
| Developer / maintainer | Low upkeep | Simple stack, no servers | Chief (as SDE) |

## 3. Elicitation plan

What I would run before sign-off. Each row says what I assumed in the meantime.

| # | Who | Method | Question | Current assumption |
|---|---|---|---|---|
| E1 | Manager | 30-min interview on site | Who decides an item is out of stock, and how fast is it known? | Manager or shift lead, from their own phone |
| E2 | Manager | Interview | How many people need admin access? Shared login or one each? | 1 to 3 named logins, one each (audit trail depends on it) |
| E3 | Manager | Interview | Are menu prices GST-inclusive? Is there a service charge? | Unknown. Guest list says "may include applicable taxes" |
| E4 | Floor staff | Shadow one lunch rush | Do waiters walk to tables or do guests come to the counter? | Mixed. "Show to staff" view supports both |
| E5 | Floor staff | Shadow | Do tables have numbers? Will per-table QRs survive cleaning? | Tables numbered; `?t=` is optional |
| E6 | Guests | 5 hallway tests on phones they own | Can they find an item, add 3, and show the list in under 60 s? | Untested on real devices |
| E7 | Management | Interview | Who reads feedback and partner leads, and how often? Email alert needed? | Manager reads feedback; franchise team reads leads; no alerts |
| E8 | Management | Interview | Same menu across future outlets, or per outlet? | Per outlet, data model supports many |
| E9 | Kitchen | Interview | Are there time-bound items (breakfast only, evening only)? | None in current PDF |
| E10 | Management | Interview | Allergen disclosure policy? | Footer: "ask our staff about allergens" |
| E11 | Management | Interview | Who owns the domain and the Supabase account? | Unknown. Blocks go-live |

## 4. Scope

**In scope (v1):** guest menu, My list, availability and visibility control, admin editing, splash announcement, About section with Chai City link, Partner with us form, feedback form, admin inboxes, outlet settings.

**Out of scope (v1):** online ordering, payment, kitchen order tickets, POS integration, loyalty, native apps, multi-language, item images from a media library.

**Explicitly not wanted:** dedicated mobile application (brief).

## 5. Personas and journeys

**P1 Guest, office worker on lunch break.** Scans QR at table, 4G, 5 minutes to decide.
Journey: scan, see splash (first visit), browse or search, add items, tap "View my list", tap "Show to staff", waiter reads it.

**P2 Café manager.** On the floor, phone in hand, interrupted constantly.
Journey: kitchen says "no more mango", manager opens admin, searches "mango", flips switch. Done in under 15 s.

**P3 Prospective franchisee.** Guest who likes the café.
Journey: taps ≡, reads About, taps Partner with us, submits name, mobile, city. Or opens chaicity.in.

## 6. Functional requirements

Priority uses MoSCoW. Acceptance criteria are written so a tester can pass or fail them.

### 6.1 Guest menu

| ID | Requirement | Priority | Acceptance criteria | Status |
|---|---|---|---|---|
| FR-01 | Scanning the outlet QR opens the menu in the phone's default browser with no install or login | Must | Given a phone camera, when the QR is scanned, the menu renders without any prompt to install or sign in | Built |
| FR-02 | Menu shows categories in admin-defined order, with sub-sections (e.g. Tea, Coffee) and items in admin-defined order | Must | Order on screen matches sort order set in admin | Built |
| FR-03 | Each item shows name, price in ₹, size/quantity where set, and veg / egg / non-veg mark | Must | All 113 items in `Capital_Park_Menu_V2_final.pdf` match name, price and order (checked 18 Nov 2026). Veg/egg/non-veg marks are inferred: the PDF has none | Built |
| FR-04 | Out-of-stock items remain visible, greyed, labelled "Currently unavailable", and cannot be added | Must | Given item marked out of stock, guest sees it greyed with label and no ADD button | Built |
| FR-05 | Hidden items and hidden categories do not appear to guests at all | Must | Given item hidden, it is absent from guest view and from the API response to guests | Built |
| FR-06 | Guest view reflects admin changes without reinstalling or rescanning | Must | Change appears on an open guest page within 60 s, or on next focus of the tab | Built (focus + 60 s poll; Realtime removed) |
| FR-07 | Search by item, section or category name | Should | Typing "shake" shows only the 11 shakes | Built, **not in brief** |
| FR-08 | "Veg only" filter | Should | With filter on, no egg or non-veg items shown | Built, **not in brief** |
| FR-09 | Category tabs jump to the category and highlight while scrolling | Should | Tapping "Desserts" scrolls to Desserts | Built |
| FR-10 | Table number from QR (`?t=7`) shown in header and on the staff view | Could | Scanning a table-7 QR shows "Table 7" | Built, Assumed (E5) |

### 6.2 My list (no ordering)

| ID | Requirement | Priority | Acceptance criteria | Status |
|---|---|---|---|---|
| FR-11 | Guest adds items with quantities to a list | Must | ADD becomes a − / + stepper; total updates | Built |
| FR-12 | List survives page refresh and closing the browser tab | Must | Refresh keeps items and quantities | Built |
| FR-13 | Prices on the list always come from the live menu | Must | Admin changes price; list total changes accordingly | Built |
| FR-14 | Items that become unavailable are flagged and excluded from the total | Must | Mark a listed item out of stock; it moves to "No longer available" | Built |
| FR-15 | Clear text that ordering is not online; list is shown to staff | Must | Note visible on list screen | Built |
| FR-16 | Large-text staff view | Should | "Show to staff" displays items × qty in large text | Built |
| FR-17 | List expires after a visit | Should | List older than 6 h is not restored | Built, Assumed |

### 6.3 Admin

| ID | Requirement | Priority | Acceptance criteria | Status |
|---|---|---|---|---|
| FR-18 | Admin login, per person | Must | Only listed admins can change data; others are rejected by the database | Built (Supabase mode) |
| FR-19 | Toggle item in stock / out of stock in one tap from the list | Must | One tap; toast confirms; guest view updates (FR-06) | Built |
| FR-20 | Add, edit, delete items: name, price, size, category, section, description, type, visibility | Must | Invalid price (negative, decimal, above 99,999) rejected; duplicate name rejected | Built |
| FR-21 | Add, rename, reorder, hide, delete categories | Must | Deleting a category that has items is refused | Built |
| FR-22 | Reorder items within a category | Should | Up/down arrows persist order | Built |
| FR-23 | Filter admin list to out-of-stock or hidden | Should | Filter shows only matching items | Built |
| FR-24 | Change history: who changed what and when | Could | Every change row recorded with user id | Built (DB only, no UI) |
| FR-25 | Bulk "mark all in stock" at start of day | Could | One action resets availability | Built ("Mark all in stock", two-tap confirm), Assumed need (E1) |

### 6.4 Splash, About, partner, feedback

| ID | Requirement | Priority | Acceptance criteria | Status |
|---|---|---|---|---|
| FR-26 | Splash: "CHQ Capital, The Rooftop Café is now open at Jain Sadguru Capital Park" | Must | Shown on first open in a session, auto-closes, tap to skip; text editable in admin; empty text turns it off | Built |
| FR-27 | About section reachable from the header (≡) and the footer | Must | About shows about text, address, contact, Chai City link | Built |
| FR-28 | Link to chaicity.in | Must | Opens in a new tab | Built |
| FR-29 | Partner with us inside About, with enquiry form (name, mobile, city, message) | Must | Valid 10-digit Indian mobile required; lead appears in admin | Built |
| FR-30 | Feedback: 1 to 5 stars, optional comment, optional name and mobile, table auto-attached | Must | Rating required; lead appears in admin with average rating | Built |
| FR-31 | **Consent notice on forms that collect name and phone** | Must | Plain-language notice beside submit: what is collected, why, how to ask for deletion | Built; admin can delete an entry on request. Wording needs legal review |
| FR-32 | Alert someone when a partner lead arrives | Should | Email or WhatsApp to the franchise team within 5 min | **Gap**, Assumed (E7) |
| FR-33 | Export leads and feedback (CSV) | Could | Admin downloads CSV | **Gap** |
| FR-34 | Count QR scans per day and per table | Could | Simple daily count in admin | **Gap**, needed for success measure 1 |

## 7. Non-functional requirements

Targets below are my proposals for sign-off, not measured baselines.

| ID | Category | Requirement | Current state |
|---|---|---|---|
| NFR-01 | Browser support | Latest 2 major versions of Chrome Android and Safari iOS; also Samsung Internet, and in-app browsers of WhatsApp, Instagram and Google Lens | Tested in desktop Chrome at phone size only. **Real-device testing is a gap.** |
| NFR-02 | Performance | Guest JS+CSS under 70 KB gzipped; usable menu within 3 s on a slow 4G profile | 56 KB gzipped guest download (JS + CSS), checked in CI. Load time not measured on a throttled profile. |
| NFR-03 | Resilience | If the network drops after first load, the last menu still shows | Built (local cache) |
| NFR-04 | Availability | Static hosting on CDN; backend on managed Supabase | Inherited from providers; no SLA checked |
| NFR-05 | Security | Guests can read only active menu rows; only outlet admins can write; guests cannot read feedback or leads | Built and tested on Postgres 16 |
| NFR-06 | Abuse | Form spam limited | DB size and format checks, 1 submission per minute per browser. No captcha. |
| NFR-07 | Accessibility | WCAG 2.1 AA for the guest menu: contrast, labels on icon buttons, 44 px touch targets | Labels done. Guest touch targets 44 px, checked by an e2e test. Contrast not audited. |
| NFR-08 | Usability | Manager can mark an item out of stock in under 15 s from phone lock screen | Not tested with the manager |
| NFR-09 | Privacy (India DPDP) | Notice and consent for personal data collected via forms; retention period; deletion on request | Notice built (FR-31); admins can delete entries on request. **Retention not automated** (section 8 periods unsigned). DPDP Rules, 2025 were notified on 14 Nov 2025 with an 18-month phased rollout, ending around 12 May 2027 (sources below). Not yet binding for most obligations, but cheap to build now. Get legal confirmation; I am not a lawyer. |
| NFR-10 | Maintainability | Manager edits everything except code; no developer needed for menu, prices, splash, About text | Built |
| NFR-11 | Cost | Run within free tiers at one outlet | **Not verified** against current Supabase and host pricing |

## 8. Data requirements

| Entity | Key fields | Owner | Retention |
|---|---|---|---|
| Outlet | name, tagline, splash text, about, address, contact, website | Manager | Permanent |
| Category | name, order, visible | Manager | Permanent |
| Item | name, price (whole ₹), size, type, section, in stock, visible, order | Manager | Permanent |
| Feedback | rating, comment, optional name and mobile, table, time | Manager reads | **Undefined. Proposed: 12 months, then delete personal fields.** |
| Partner enquiry | name, mobile, city, message, time | Franchise team | **Undefined. Proposed: 24 months or until closed.** |
| Change log | who, what, when, before/after | System | **Undefined. Proposed: 12 months.** |

## 9. Business rules

| ID | Rule |
|---|---|
| BR-01 | One orderable variant = one item (Black Tea and Green Tea are separate) so each has its own stock switch |
| BR-02 | Prices are whole rupees; no paise |
| BR-03 | An item belongs to exactly one category of the same outlet (enforced by DB) |
| BR-04 | Item names are unique within an outlet |
| BR-05 | A category with items cannot be deleted |
| BR-06 | Add-ons (Extra Cheese, Extra Pav) are listed as normal items in the relevant section |
| BR-07 | Samosa appears once (Accompaniments). |
| BR-08 | The Mains ADD ON box (Extra Cheese, Extra Butter, Extra Pav, ₹29 each) is listed under Pav Bhaji, where the PDF places it. **Assumed:** it does not apply to Vada Pav. |

## 10. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Manager does not keep stock switches current; guests lose trust | Medium | High | FR-25 start-of-day reset; make toggle 1 tap; train on day one |
| QR stickers damaged or swapped | Medium | Medium | One outlet URL printed as text under QR; laminate |
| No owner for Supabase/domain accounts | Medium | High | E11 before go-live; accounts in company email, 2 admins |
| Spam on partner form | Low now | Medium | Add captcha only if it happens |
| In-app browsers block storage; list lost | Medium | Low | Already degrades gracefully; menu still works |
| Real-device bugs on older iPhones | Medium | Medium | Device test pass before printing QRs |

## 11. Open questions (need answers to sign off)

1. Are prices GST-inclusive? Any service charge? (E3)
2. Who gets admin logins, and who reads leads? Do leads need instant alerts? (E2, E7)
3. Per-table QRs or one QR for all tables? (E5)
4. Address line: full area and city for the About section.
5. Who owns the domain and Supabase account? (E11)
6. Allergen information: is a footer note enough? (E10)
7. Should Partner with us also link to chaicity.in/franchise/?
8. Are search, Veg only, bestseller tag and image field wanted? They were not in the brief (see Build Plan, Ponytail audit).

## 12. Traceability summary

| Area | Must | Built | Gap |
|---|---|---|---|
| Guest menu | 6 | 6 | 0 |
| My list | 5 | 5 | 0 |
| Admin | 4 | 4 | 0 |
| Splash, About, forms | 6 | 6 | 0 |
| NFR (11 total) | n/a | 7 met (02 size only, 07 touch targets), 2 unverified (08, 11) | 2 (01 real devices, 09 retention) |

Sources for NFR-09: PIB note on DPDP Rules, 2025 (static.pib.gov.in, 17 Nov 2025); AZB & Partners update (azbpartners.com, 14 Nov 2025).
