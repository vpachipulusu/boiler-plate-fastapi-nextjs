# Phase 1 evidence (FREEJ-16 quality gate)

Captured 2026-10-29 from `npm run build` + `npm run start` on `main` at the review follow-up commit,
with Playwright Chromium at 1440×900 and 390×844, full page, device scale 1. Fixture clock is
2026-10-29, so "Last checked" dates are stable.

## Checks

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 31 pre-existing template warnings |
| `npm run typecheck` | clean |
| `npm run test:unit` | 97 files, 1471 tests passing |
| `npm run build` | green; `/`, legal pages static, `/freebies/[slug]` SSG (21 live offers), `/freebies`, `/category/[slug]`, `/alerts` dynamic |
| Playwright specs | written, **not run** (needs `test:e2e:local`, a backend and a Firebase test project) |
| Horizontal overflow | none at 390 or 1440 on any captured page |
| External links | none on any public page (unit tests assert `a[href^="http"]` is absent) |

## Screenshots

| File | Page | Design screen |
|---|---|---|
| `01-home-1440.png` | `/` | `01_home_desktop.png` |
| `02-catalogue-1440.png` | `/freebies` | `02_catalogue_desktop.png` |
| `03-offer-detail-1440.png` | `/freebies/coffee-discovery-pack` | `03_offer_detail_desktop.png` |
| `04-alerts-1440.png` | `/alerts` | `04_alerts_preferences_desktop.png` |
| `05-home-390.png` | `/` | `05_home_mobile.png` |
| `06-catalogue-390.png` | `/freebies` | `06_catalogue_mobile.png` |
| `07-offer-detail-390.png` | `/freebies/coffee-discovery-pack` | `07_offer_detail_mobile.png` |
| `08-alerts-390.png` | `/alerts` | (no mobile reference) |
| `09-category-1440.png` | `/category/food-drink` | (no reference; reuses screen 02) |
| `10-offer-expired-1440.png` | `/freebies/laundry-sheets-sample` | expired state |
| `11-catalogue-empty-1440.png` | `/freebies?q=zzzz` | empty state |
| `12-offer-trial-390.png` | `/freebies/daily-gummy-vitamin-trial` | trial with card requirement |
| `13-not-found-1440.png` | `/category/nope` | 404 page |

In the 390 captures the fixed bottom tab bar appears once at the first viewport's bottom edge;
that is a full-page screenshot artefact, not a layout bug.

## Comparison notes against the design kit

Matches the reference closely: announcement bar, header (logo, nav, search pill, coral alerts
pill), cream editorial hero with the jar illustration and floating cards, four-item trust strip,
six category cards with tinted initials, "Freshly found" four-column cards, mint newsletter band,
catalogue header and search card, filter sidebar with radio and checkbox rows, offer cards with
type pill and "View freebie" link, offer detail hero with mint trust panel and coral CTA, three
numbered claim steps, "The important bits" card, related offers, two-panel alerts card.

Deliberate differences:

- **Demo labelling.** Every surface says "sample listings / design preview" and cards carry a DEMO
  pill. The reference's "Real freebies · Checked daily", "Hand-checked offers", "Fresh every day"
  and "Checked regularly" lines were replaced because fixture data cannot back them (plan rule:
  no fabricated verification claims).
- **Offer types.** The reference's "Giveaways" and "Try for free" become the five honest types:
  free sample, free trial, cashback, voucher, competition.
- **Availability filters.** Only "No postage required" is implemented; "Available now" is implicit
  (expired offers are never listed) and "Added this week" needs real dates.
- **Pagination** replaces the reference's "Load more freebies" button so state stays in the URL.
- **Mobile tab bar** is Home / Browse / Categories / Alerts; "Saved" waits for favourites (FREEJ-28).
- **Mobile cards** drop the freshness label and show the DEMO pill below the type pill so the two
  never overlap at 170px card width.
- **Alerts page** adds a pre-submit "design preview" notice and a planned-for-launch footer line.
- **Wishlist hearts** on cards are not rendered (favourites deferred).
- **Font.** Inter 700/800 for display text, as the design tokens suggest; body font stays the
  admin-selectable one.

## Known issues carried forward

- Unknown `/category/[slug]` answers HTTP 200 with the 404 UI (root `loading.tsx` boundary; see
  `docs/developer/freejoy-frontend.md`).
- Newsletter band passes the email to `/alerts` in the query string; replaced by a POST action in
  Phase 3.
- Mobile filter drawer needs JavaScript (sort uses an Apply button and works without it).
