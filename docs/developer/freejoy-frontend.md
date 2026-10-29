# Freejoy frontend

Phase 1 built the public Freejoy pages on fixture data so the design could be approved. FREEJ-21
(Phase 2) switched them to real published offers from the catalogue API. The pages are still server
rendered and need no login, the browser never calls FastAPI, and the fixtures remain for local design
work and unit tests. Nothing here stores visitor data or links to an external site.

Design reference: `design-reference/freejoy/` (PNG and SVG screens plus `design_tokens.json`).
Plan and decisions: `.claude/plans/freejoy-phase1.plan.md`. Jira: project `FREEJ`, stories
FREEJ-6 to FREEJ-16 (Phase 1) and FREEJ-21 (the switch to the API).

## Routes

All public pages live in the `(public)` route group under `src/app/(public)/` and share
`layout.tsx` there (skip link, announcement bar, header, footer, mobile tab bar).

| Route | Screen | Notes |
|---|---|---|
| `/` | 01 / 05 | Hero, trust strip, category grid, "Freshly found" cards, newsletter band |
| `/freebies` | 02 / 06 | Search, category/type/postage filters, sort, pagination, empty and error states |
| `/category/[slug]` | 02 | Category intro plus the same catalogue controls scoped to one category |
| `/freebies/[slug]` | 03 / 07 | Hero, claim steps, "important bits", trust panel, related offers; the "offer has ended" page for an ended offer; 404 page for an unknown one |
| `/alerts` | 04 | Preferences form; validates in the browser, never sends |
| `/about`, `/contact`, `/privacy`, `/cookies`, `/terms`, `/affiliate-disclosure` | – | Editorial and legal scaffolding, each with a visible "draft, pending legal review" banner |
| `not-found.tsx` | – | Freejoy-styled 404 |

`/`, `/freebies`, `/category/[slug]`, `/freebies/[slug]`, `/alerts` and `/sitemap.xml` export
`dynamic = 'force-dynamic'` (or read the query string, which has the same effect). They render per
request, so `next build` never calls the backend and an outage can never be baked into a prerendered
page; the cache that protects the backend is the Data Cache described under
[Catalogue data](#catalogue-data) below. Indexing follows the catalogue source and the data; see
[freejoy-seo.md](freejoy-seo.md).

## Catalogue data

`src/lib/catalogue/` is the only data source. Pages and components import the facade
`@/lib/catalogue` (never `fixtures.ts`, `api-source.ts` or the API wrapper directly), and every facade
function answers from the configured source:

| `CATALOGUE_SOURCE` | Source | When |
|---|---|---|
| unset | the catalogue API | default for `next dev`, `next build` and production |
| unset under `NODE_ENV=test` | fixtures | the default for Vitest, so unit tests stay offline |
| `api` | the catalogue API | explicit |
| `fixture` | 24 fixture offers, 6 categories, 8 merchants | local design work without a backend; every page then shows the demo badge and wording and stays `noindex` |

The variable is server-only, read at call time by `source.ts` (`getConfiguredSource()`), and listed in
`nextjs-frontend/.env.example`. An unknown value is treated as unset. `getCatalogueSource()` (async)
returns the source and is what the SEO code asks; it does not depend on what is live. The Playwright
e2e server runs with `CATALOGUE_SOURCE=fixture` unless `E2E_LIVE_CATALOGUE=1`
(`scripts/e2e-env.cjs`).

Files in `src/lib/catalogue/`:

- `types.ts`: `Offer`, `Category`, `Merchant`, `CatalogueQuery`, `Page<T>` and the label maps. An API
  offer carries its `merchant` (the API has no merchant list); fixture offers resolve it by slug.
- `index.ts`: the facade. `lookupOffer(slug)` returns `found`, `ended` (the API's 410) or `not_found`;
  `getOfferBySlug(slug)` is the found-or-null shortcut.
- `source.ts`: `CatalogueSource`, `getConfiguredSource()`, the `CatalogueBackend` interface both sources
  implement, and the `OfferLookup` / `EndedOffer` types.
- `fixture-source.ts` and `fixtures.ts`: the fixture implementation. Every fixture offer has
  `demo: true`; two are expired and one is a draft so those states can be previewed. The clock is the
  fixed `FIXTURE_TODAY` (2026-10-29).
- `api-source.ts`: the API implementation. Reads go through the wrapper, every record passes
  `api-mapper.ts`, and reads that one render repeats (metadata, heading and results) are memoised per
  request with React `cache`. `getToday()` is the **Europe/London calendar date** (`today.ts`), because
  `isLive` and the 30-day expiry policy compare calendar days.
- `api-mapper.ts` and `slug.ts`: the facade boundary. Slugs (offer, category, merchant) must match
  `^[a-z0-9-]+$`; a record with any other slug is dropped and logged (the value is JSON-quoted and cut to
  60 characters). An offer with no verification date, an unreadable date or an unknown type is dropped
  too: the page says "Last checked", so it never invents one. Timestamps become London calendar dates.
  An unknown tint falls back to `cream`, an unreadable postage to "check terms".
- `errors.ts`: `CatalogueUnavailableError`, `settle()` and the curated visitor message.
- `query.ts`: filtering, sorting, pagination, related offers, `isLive` (fixtures and the pure helpers).
- `offer-url.ts`: the `/freebies?q=&category=&type=&postage=&sort=&page=` codec. Every catalogue
  control is a link or GET form, so filter state lives in the URL and works without JavaScript. A
  category in the URL only has to be a well-formed slug; the source decides whether it exists (the API
  answers an empty list, the fixtures ignore it).
- `revalidate.ts`: `revalidateCatalogue(paths?)`, see below.

## Catalogue API wrapper (FREEJ-21)

`src/lib/api/catalogue.ts` (`import 'server-only'`) is the only caller of the generated
`listOffers`, `readOffer` and `listCategories` (ESLint forbids importing the generated client anywhere
else). Contract: [backend-catalogue.md](backend-catalogue.md).

- **Calls.** `fetchOffers(params)`, `fetchOffer(slug)` and `fetchCategories()` go through
  `callBackend(..., { withSession: false, shared: true })`: the internal key, never the visitor's session,
  never a cookie read.
- **Cache.** Each read runs inside `unstable_cache` with tag `catalogue` and `revalidate: 60`
  (`CATALOGUE_CACHE_TAG`, `CATALOGUE_REVALIDATE_SECONDS`). A page costs the backend one request a minute
  per distinct read however many visitors arrive. A search with text (`q`) **skips the cache** so a
  visitor's words are never a cache key (and are never logged); it is still rate limited per visitor.
- **Timeout.** 3 s per request (`CATALOGUE_REQUEST_TIMEOUT_MS`, `AbortSignal.timeout`), as in
  `settings.ts`.
- **Errors are thrown, never cached.** Any outcome other than success, 404 or 410 (unreachable, timeout,
  401, 422, 429, 5xx) logs a warning (operation, status, backend message; no search text) and throws
  `CatalogueUnavailableError`. `unstable_cache` stores nothing for a thrown error, so the next request
  tries again, and a stale entry keeps being served while a background refresh fails. A 404 becomes
  `not_found` and a 410 becomes `gone` with the stub (title, category, end date); those are real answers
  and may be cached.
- **Visitor IP.** The backend rate limit is 120 requests a minute per `X-Client-IP`. `readTrustedClientIp()`
  in `server.ts` reads **only** Vercel's `x-vercel-forwarded-for` (and only when `VERCEL=1`), never
  `X-Forwarded-For`, `X-Real-IP` or any other header a client can set, and only if the value is an IP
  address. The wrapper reads it before the cache boundary and carries it to the request in an
  `AsyncLocalStorage`, so it is **not** part of the cache key (one entry per read, not per visitor) and is
  used only when the read actually reaches the backend. `shared: true` still reads no request headers
  itself; the address arrives through the new `clientIp` option. With no trusted header the header is
  omitted. Checked by hand against a local stub backend with `VERCEL=1` and pinned by `catalogue-headers.test.ts`.
- **No backend text in the browser.** Pages show the curated `CATALOGUE_UNAVAILABLE_MESSAGE`.

`revalidateCatalogue(paths?)` (`src/lib/catalogue/revalidate.ts`, server-only) expires the `catalogue`
tag immediately (`revalidateTag('catalogue', { expire: 0 })`) and optionally revalidates paths. It is for
the admin publish, unpublish and expire actions (FREEJ-22); nothing calls it yet.

## States

| State | What the visitor gets |
|---|---|
| Loading | `loading.tsx` skeletons (root, and an offer-shaped one for `/freebies/[slug]`); Suspense skeletons for the home sections and the catalogue results, `role="status" aria-busy="true"` with an accessible name, blocks `aria-hidden` |
| Empty | "No freebies match that yet" with a Clear filters link; "no featured freebies right now" on the home page |
| Error | `InlineError` (`role="alert"`, curated copy) with a "Try again" button (`RetryButton`, a real `button` that calls `router.refresh()`, `aria-disabled` while it runs so focus stays). The page answers **HTTP 200 with `noindex`** (metadata reads the same memoised data and sees the failure) and is never cached: dynamic responses carry `Cache-Control: private, no-cache, no-store`. |
| Not found | `notFound()` for an unknown, unpublished or non-slug offer or category. Streams as HTTP 200 with the 404 page and a `noindex` tag; see [freejoy-seo.md](freejoy-seo.md#owner-follow-ups) follow-up 4. |
| Ended | The API's 410 renders "This offer has ended" with the title, the end date and two ways onward (no call to action, claim steps or terms). `noindex, follow` for 30 days after the end date, then not found. |

## Trust rules the UI follows

- Fixture (demo) data is labelled on every surface: card badges, the "Sample listings" copy on the home
  and catalogue pages, the hero card, the alerts notice and the offer CTA. **API offers carry no demo
  badge or wording** (`offer.demo` is false; pages ask `getCatalogueSource()`).
- "Last checked" and freshness labels come only from the offer's `lastVerifiedAt` and `freshness`. There
  are no visitor counts, testimonials, scarcity cues or verification claims.
- No offer has a destination yet (the `/go/[id]` redirect is Phase 3). The offer CTA therefore opens a
  dialog: "Demo offer" for fixtures, "Claim link coming soon" for real offers. No element on any page has
  an external `href`.
- The alerts form validates with Zod, requires consent, and ends in a plainly worded
  "nothing was saved" state. There is no network call and nothing is logged.
- Legal pages carry a draft banner and a reviewer checklist instead of compliance claims.
- Public pages set no cookies and use no browser storage (tests: `public-pages-privacy.test.tsx`;
  `catalogue-live.spec.ts` checks `context.cookies()`).

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
| `src/components/catalogue/` | `OfferCard`/`OfferGrid` (shared), filters, sort, pagination, empty state, drawer, `InlineError`, `RetryButton` |
| `src/components/home/` | Hero, hero art, trust strip, category grid, freshly found, newsletter band, `HomeSections` (+ skeleton) |
| `src/components/offer/` | Breadcrumbs, hero, claim steps, important bits, trust panel, CTA, ended panel and ended-offer page, related |
| `src/components/alerts/` | `AlertsForm` (client component, react-hook-form + Zod) |
| `src/components/legal/` | `LegalPage` shell with draft banner and `ReviewerChecklist` |

Only `offer-cta.tsx`, `retry-button.tsx`, `alerts-form.tsx`, `filter-drawer.tsx`, the mobile tab bar and
the site header are client components. Client components must not import `@/lib/catalogue` (the facade),
`@/lib/api/catalogue` or read `BACKEND_*` / `CATALOGUE_SOURCE`; the client/server boundary test enforces
it. The filter drawer and sort control render outside the keyed Suspense boundaries in
`catalogue-layout.tsx` so they keep focus across filter navigations.

## Tests

- Unit (Vitest): `src/__tests__/unit/app/*` render each page and check metadata, 404s, error states and
  the no-external-link rule; `unit/api/catalogue*.test.ts` cover the wrapper (cache wiring, status
  mapping, timeout, outage error, headers on the wire); `unit/lib/catalogue/*` cover the mapper, the
  source switch, the London date, the API source and the fixtures; `unit/components/*` cover the header,
  cards, catalogue controls, CTA, error and live-versus-demo wording; `unit/config/client-server-boundary`
  keeps backend settings out of the browser.
- Playwright specs exist for the homepage, catalogue, offer detail, alerts and display font
  (`src/__tests__/e2e/*.spec.ts`, fixture catalogue) and `catalogue-live.spec.ts` (real data, journeys 1
  and 5). They need `npm run test:e2e:local`, which builds a production bundle and expects a running
  backend and a Firebase test project. **`catalogue-live.spec.ts` was written in FREEJ-21 but not run**: it
  needs a seeded backend (FREEJ-20). How to run it is in the file header and in
  [local-e2e.md](local-e2e.md#real-catalogue-data).

## Known deviations

- The newsletter band on the homepage is a GET form to `/alerts?email=`, so the address lands in
  the URL. Phase 3 replaces this with a POST server action.
- The mobile filter drawer needs JavaScript; search, sort (Apply button), category chips and
  pagination work without it.
- An unknown `/category/[slug]` or `/freebies/[slug]` renders the 404 page but answers HTTP 200 (with a
  `noindex` tag). The template's root `src/app/loading.tsx` wraps every page in a Suspense boundary, so
  dynamic routes stream the shell before `notFound()` runs. Measured on the production build: with the
  root `loading.tsx` removed (and no segment `loading.tsx`) `/category/nope` answers 404; the offer page's
  own `loading.tsx` has the same effect as the root one. Fixing it means scoping the root boundary to the
  admin, auth, dashboard and pricing groups (a template change outside FREEJ-21) and dropping the offer
  skeleton.
- Offers have no claim link yet (Phase 3), so the CTA button opens the "coming soon" dialog.

## Next phases

- Phase 2 (FREEJ-17 to FREEJ-22): backend models, migrations, public read API, admin offers. FREEJ-21
  (this switch) is done; FREEJ-22 (admin UI) calls `revalidateCatalogue`.
- Phase 3 (FREEJ-23 to FREEJ-27): `/go/[offerId]` redirect, click events, email provider,
  sitemap, structured data.
- Phase 4 (FREEJ-28, FREEJ-29): favourites and the remaining nice-to-haves.
