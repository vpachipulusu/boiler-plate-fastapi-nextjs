# Freejoy frontend (Phase 1: design preview)

Phase 1 delivers the public Freejoy pages on fixture data so the design can be approved before the
backend (Phase 2) and the affiliate redirect, newsletter and SEO work (Phase 3) are built. Nothing in
this phase calls FastAPI, stores data or links to an external site.

Design reference: `design-reference/freejoy/` (PNG and SVG screens plus `design_tokens.json`).
Plan and decisions: `.claude/plans/freejoy-phase1.plan.md`. Jira: project `FREEJ`, stories
FREEJ-6 to FREEJ-16.

## Routes

All public pages live in the `(public)` route group under `src/app/(public)/` and share
`layout.tsx` there (skip link, announcement bar, header, footer, mobile tab bar).

| Route | Screen | Notes |
|---|---|---|
| `/` | 01 / 05 | Hero, trust strip, category grid, "Freshly found" cards, newsletter band |
| `/freebies` | 02 / 06 | Search, category/type/postage filters, sort, pagination, empty state |
| `/category/[slug]` | 02 | Category intro plus the same catalogue controls scoped to one category |
| `/freebies/[slug]` | 03 / 07 | Hero, claim steps, "important bits", trust panel, related offers, demo CTA |
| `/alerts` | 04 | Preferences form; validates in the browser, never sends |
| `/about`, `/contact`, `/privacy`, `/cookies`, `/terms`, `/affiliate-disclosure` | – | Editorial and legal scaffolding, each with a visible "draft, pending legal review" banner |
| `not-found.tsx` | – | Freejoy-styled 404 |

Every Phase 1 page is `noindex` because the content is fixture data. Indexing is now driven by the
catalogue data and flips on its own when the API supplies real offers; see
[freejoy-seo.md](freejoy-seo.md).

## Fixture catalogue

`src/lib/catalogue/` is the only data source. Pages and components import the facade
`@/lib/catalogue` (never `fixtures.ts` directly), so Phase 2 can swap the fixtures for the catalogue
API without touching call sites.

- `types.ts`: `Offer`, `Category`, `Merchant`, `CatalogueQuery`, `Page<T>` and the label maps.
- `fixtures.ts`: 24 offers, 6 categories, 8 merchants. Every offer has `demo: true`; two are
  expired and one is a draft so those states can be previewed.
- `query.ts`: filtering, sorting, pagination, related offers, `isLive`.
- `offer-url.ts`: the `/freebies?q=&category=&type=&postage=&sort=&page=` codec. Every catalogue
  control is a link or GET form, so filter state lives in the URL and works without JavaScript.
- The clock is fixed: `getToday()` returns `FIXTURE_TODAY` (2026-10-29). No rendering code calls
  `Date.now()`, so screenshots and tests are stable.

## Trust rules the UI follows

- Demo data is labelled on every surface: card badges, the "Sample listings" copy on the home and
  catalogue pages, the hero card, the alerts notice and the offer CTA.
- "Last checked" and freshness labels come only from fixture fields (`lastVerifiedAt`,
  `freshness`). There are no visitor counts, testimonials, scarcity cues or verification claims.
- The offer CTA opens a "Demo offer" dialog. No element on any page has an external `href`.
- The alerts form validates with Zod, requires consent, and ends in a plainly worded
  "nothing was saved" state. There is no network call and nothing is logged.
- Legal pages carry a draft banner and a reviewer checklist instead of compliance claims.

## Theme and typography

- `src/config/themes.ts`: the `freejoy` preset is the default. Tokens map `design_tokens.json`
  to HSL CSS variables (`--cta` coral, `--accent-ink` green, `--secondary` cream, `--accent` mint).
  The CTA was lifted slightly from the token value so ink-on-coral passes 4.5:1
  (`theme-contrast.test.ts` enforces this).
- `src/config/fonts.ts`: Inter 700/800 as `--font-display`; body font stays admin-selectable.
- `tailwind.config.ts`: `rounded-input` 12px, `rounded-card` 16px, `rounded-editorial` 24px,
  `rounded-pill`, `max-w-content` 1314px.

## Components

| Folder | Contents |
|---|---|
| `src/components/site/` | Header, footer, mobile tab bar, announcement bar, search form, brand mark |
| `src/components/catalogue/` | `OfferCard`/`OfferGrid` (shared), filters, sort, pagination, empty state, drawer |
| `src/components/home/` | Hero, hero art, trust strip, category grid, freshly found, newsletter band |
| `src/components/offer/` | Breadcrumbs, hero, claim steps, important bits, trust panel, CTA, related |
| `src/components/alerts/` | `AlertsForm` (client component, react-hook-form + Zod) |
| `src/components/legal/` | `LegalPage` shell with draft banner and `ReviewerChecklist` |

Only `offer-cta.tsx`, `alerts-form.tsx`, `filter-drawer.tsx`, the mobile tab bar and the site
header are client components. The filter drawer and sort control render outside the keyed
Suspense boundaries in `catalogue-layout.tsx` so they keep focus across filter navigations.

## Tests

- Unit (Vitest): `src/__tests__/unit/app/*` render each page and check metadata, 404s and the
  no-external-link rule; `src/__tests__/unit/components/*` cover the header, cards, catalogue
  controls, CTA and alerts form; `src/__tests__/unit/lib/catalogue/*` cover the fixture contract.
- Playwright specs exist for the homepage, catalogue, offer detail, alerts and display font
  (`src/__tests__/e2e/*.spec.ts`). They need `npm run test:e2e:local`, which builds a production
  bundle and expects a running backend and a Firebase test project. They were not run for Phase 1;
  see `docs/evidence/phase1/README.md` for what was verified instead.

## Known Phase 1 deviations

- The newsletter band on the homepage is a GET form to `/alerts?email=`, so the address lands in
  the URL. Phase 3 replaces this with a POST server action.
- The mobile filter drawer needs JavaScript; search, sort (Apply button), category chips and
  pagination work without it.
- `/freebies` is served statically from fixtures; caching and revalidation arrive with Phase 2.
- An unknown `/category/[slug]` renders the 404 page but answers HTTP 200. The template's root
  `src/app/loading.tsx` wraps every page in a Suspense boundary, so dynamic routes stream the shell
  before `notFound()` runs (`/freebies/[slug]` is static and does answer 404). Fix with the Phase 3
  SEO work by scoping or removing the root loading boundary.

## Next phases

- Phase 2 (FREEJ-17 to FREEJ-22): backend models, migrations, public read API, admin offers.
- Phase 3 (FREEJ-23 to FREEJ-27): `/go/[offerId]` redirect, click events, email provider,
  sitemap, structured data.
- Phase 4 (FREEJ-28, FREEJ-29): favourites and the remaining nice-to-haves.
