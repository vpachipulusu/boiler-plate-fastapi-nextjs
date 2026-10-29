# Plan: Freejoy — Phase 0 alignment + Phase 1 design-first frontend

**Source**: `FREEJOY_CLAUDE_CODE_MASTER_PROMPT.md` (free-form master prompt) + `design-reference/freejoy/*`
**Selected milestone**: Phase 0 (inspect, align) + Phase 1 (fixture-backed public frontend). Phases 2–4 are planned here at story level only.
**Complexity**: Large (Phase 1 alone: ~35 new files, 2 days of focused work; Phases 2–3 are each comparable)
**Jira**: epics and stories created in `FREEJ` (see the end of this file)

## 1. Phase 0 findings — current state

| Item | Finding |
| --- | --- |
| Working folder | `C:\MainData\AI-Projects\freejoy-app` is **not a git repository**. It holds only the master prompt, the handoff note and `design-reference/freejoy/` (10 PNGs + `design_tokens.json`; the SVGs and README named in the prompt are **not on disk**). |
| Boilerplate | A clean clone exists at `C:\MainData\AI-Projects\boiler-plate-fastapi-nextjs` on `main` at `edf950b` ("fix: make the first CI run green (#10)"), in step with `origin/main`. Two commits of history. |
| Stack confirmed | Next.js `^16.4.3`, React 19, Tailwind 3.4 + shadcn/ui, Vitest 5, Playwright 1.50; FastAPI, Python 3.12, uv, SQLAlchemy async, one Alembic baseline `0001`, coverage floor 87%. |
| Public routes today | `/` (boilerplate landing), `/pricing` (Stripe module), `/contact` (disabled form), `not-found.tsx`. No public header/footer component exists. |
| Theme system | `src/config/themes.ts` holds two presets (`plain`, `luxury`); `DEFAULT_THEME='luxury'`; CSS variables are HSL triples consumed by Tailwind (`bg-cta`, `text-accent-ink`, `bg-good`, …). Theme admin setting is stubbed (`getActiveTheme` returns the default). |
| Fonts | Body font is admin-selectable (Inter default). **Display font is hard-coded to Fraunces (serif)** on `h1–h3`; the design uses Inter 800 for all headings. Tests `display-font.test.tsx` / `display-font.spec.ts` assert the current behaviour. |
| API seam | `src/lib/api/server.ts` → `callBackend` already supports `withSession: false` and a `shared: true` mode designed for a public catalogue inside `unstable_cache`. `src/lib/api/settings.ts` is the reference pattern for an internal-key-only public read. |
| Backend seams | `app/api/v1/settings.py` (internal key + `limit_by_client_ip(PUBLIC_SETTINGS_POLICY)`) is the public-read pattern; `app/api/v1/admin_users.py` + `require_admin(<permission>)` + `AuditorDep` is the admin-write pattern. `ADMIN_PERMISSIONS` is a closed registry in `app/core/permissions.py`. |
| Data | `SeoMeta` and `UrlRedirect` models exist in the baseline with no routes; `/admin/seo` renders `FeatureUnavailable`. |
| Proxy | `src/proxy.ts` protects `/dashboard|/settings|/profile|/security|/admin` by cookie presence and `/api/*` except `/api/health`. Public pages need no proxy change in Phase 1. |
| Jira | Project `FREEJ` (cloudId `2a493948-64cf-4e23-92e3-5ac1a71a7673`) was empty. Issue types: Epic, Story, Task, Subtask, Feature, Bug. |

### Unsafe assumptions caught
- The prompt lists `.svg` files and a README in the kit; only PNGs and `design_tokens.json` exist. Pixel comparison is against the PNGs only.
- The design's hero shows "Real freebies · Checked daily" and offer cards say "New today" / "Popular" / "Ends soon". With fixture data these become **fabricated verification/popularity claims**. Phase 1 renders them from fixture fields that are explicitly labelled demo, never computed from "now".
- The design has a heart/"Saved" favourites tab. No scope section covers favourites. Decision below.
- No new GitHub remote exists for Freejoy. Decision below.

## 2. Decisions (made, reversible, flagged)

| # | Decision | Why |
| --- | --- | --- |
| D1 | Bootstrap `freejoy-app` with `git init`, add the template as remote `template`, fetch and branch `main` from `template/main`, then work on `feat/freejoy-phase1-frontend`. The user adds `origin` (a new GitHub repo) when ready. | Keeps the template reusable (handoff note) and keeps the design assets already in the folder. Never pushes to the template's `main`. |
| D2 | Add a `freejoy` preset to `THEME_PRESETS` and set `DEFAULT_THEME='freejoy'`; keep `plain`/`luxury`. Tokens from `design_tokens.json` mapped to the existing HSL variable contract (`--cta`=coral, `--primary`=ink, `--accent-ink`=forest green, `--good-bg`=mint, `--feature`=ink sidebar). | Branding flows through the existing theme contract so admin/auth/dashboard stay intact. |
| D3 | Switch `displayFont` to Inter (weights 700/800) and keep the `--font-display` variable; update the two display-font tests. | Design headings are Inter 800. Fraunces serif would contradict the reference. |
| D4 | New route group `src/app/(public)/` with its own layout (SiteHeader, SiteFooter, mobile tab bar). Move `/` and `/contact` into it. `/pricing` stays where it is (Stripe module touch point). | Public chrome without touching `(admin)`, `(auth)` or `dashboard/` layouts. |
| D5 | Typed fixture module `src/lib/catalogue/` (`types.ts`, `fixtures.ts`, `query.ts`, `index.ts`). Every fixture carries `source: 'fixture'` and a `demo: true` flag; pages render a visible "Demo listing" badge. | API-ready: Phase 2 swaps `index.ts` to call `src/lib/api/catalogue.ts`. |
| D6 | Outbound CTA on fixture offers opens an inline "Demo offer" notice; **no `href` to any external site**. `/go/[id]` is Phase 3. | Fake offers cannot generate misleading outbound clicks. |
| D7 | Alerts form validates client-side (Zod) and ends in a clearly worded "Alerts are not live yet — nothing was saved" state. | Never implies a subscription succeeded. |
| D8 | Favourites (heart icon, "Saved" tab) **deferred to Phase 4 backlog**. Mobile tab bar in Phase 1: Home, Browse, Categories, Alerts. | A heart that does nothing is a dead-end control. |
| D9 | Fixture-backed offer and category pages set `robots: noindex` until Phase 2 replaces fixtures. | Keeps demo content out of search engines. |
| D10 | "Last checked"/"New today" style cues render only from explicit fixture fields (`lastVerifiedAt`, `freshness`) and the detail page says "Demo data — not a real verification". | No manufactured verification stamps. |
| D11 | Legal pages ship with a top banner "Draft — placeholder text pending legal review" and no compliance claims. | Prompt §4 and §6. |
| D12 | No new npm or Python dependencies in Phase 1. | Everything needed (Radix dialog, Zod, react-hook-form, lucide) is installed. |

## 3. Mapping: design screen → route → components → future API

| Screen | Route | Components (new unless noted) | Future API (Phase 2) |
| --- | --- | --- | --- |
| 01 Home desktop / 05 Home mobile | `/` (`(public)/page.tsx`) | `SiteHeader`, `AnnouncementBar`, `HomeHero`, `TrustStrip`, `CategoryGrid`, `OfferCard`, `OfferGrid`, `NewsletterBand`, `SiteFooter`, `MobileTabBar` | `GET /v1/catalogue/offers?featured=true`, `GET /v1/catalogue/categories` |
| 02 Catalogue desktop / 06 Catalogue mobile | `/freebies?q=&category=&type=&postage=free&sort=&page=` | `CatalogueHeader`, `SearchForm`, `FilterSidebar` (desktop), `FilterChips` + `FilterDrawer` (mobile, Radix Dialog), `SortSelect`, `OfferGrid`, `CatalogueEmptyState`, `CataloguePagination` (link-based, URL-preserving), existing `ui/pagination` `getRange` | `GET /v1/catalogue/offers` with the same query params |
| 03 Offer detail desktop / 07 mobile | `/freebies/[slug]` | `Breadcrumbs`, `OfferHero`, `OfferTypeBadge`, `OfferTrustPanel`, `OfferCta` (demo notice), `ClaimSteps`, `ImportantBits`, `RelatedOffers` | `GET /v1/catalogue/offers/{slug}`; Phase 3 `/go/[offerId]` |
| (derived from 02) | `/category/[slug]` | `CategoryIntro` + catalogue components | `GET /v1/catalogue/categories/{slug}` |
| 04 Alerts preferences | `/alerts` | `AlertsPanel`, `AlertsForm` (client: email, category checkboxes, frequency radio, consent) | Phase 3 `POST /v1/subscribers` |
| 08 Admin offers | `/admin/offers` (Phase 2) | reuse `AdminSidebar`, `Card`, `Table`, `StatusPill`, `TableSkeleton`, `InlineError`; new `OffersTable`, `OfferForm`, `OfferStatsStrip` | `/v1/admin/offers`, `/v1/admin/categories`, `/v1/admin/merchants` |
| 09 Design system | theme preset + `globals.css` | `freejoy` preset, pill `Button` size/variant, `OfferTypeBadge`, inputs radius 12px | — |
| — | `/about`, `/contact`, `/privacy`, `/cookies`, `/terms`, `/affiliate-disclosure` | `LegalPage` wrapper with draft banner | — |
| — | `not-found.tsx` | restyle with Freejoy tokens | — |

## 4. Patterns to mirror

| Category | Source | Pattern |
| --- | --- | --- |
| Public server read | `nextjs-frontend/src/lib/api/settings.ts` | `callBackend(..., { withSession: false })`, timeout, log-and-throw, in-memory cache |
| Shared cache mode | `nextjs-frontend/src/lib/api/server.ts:60-70` | `shared: true` for visitor-independent reads inside `unstable_cache` |
| Search-param page | `nextjs-frontend/src/app/(admin)/admin/users/page.tsx` | `searchParams` Promise, `parsePage`, capped query, `Suspense` + skeleton keyed by params |
| Accessible form field | `nextjs-frontend/src/app/contact/page.tsx:31-41` | label + 44px control + `aria-describedby` hint |
| Status chips | `nextjs-frontend/src/components/ui/status-pill.tsx` | icon + text + tint, never colour alone |
| Empty/error states | `nextjs-frontend/src/app/(admin)/admin/audit-logs/page.tsx` | `InlineError` with retry href; plain empty-state paragraph |
| 404 | `nextjs-frontend/src/app/not-found.tsx` | one calm panel, one way out |
| Unit tests | `nextjs-frontend/src/__tests__/unit/components/pagination.test.tsx`, `unit/app/utility-pages.test.tsx` | Testing Library, AAA, behaviour-named tests |
| E2E | `nextjs-frontend/src/__tests__/e2e/homepage.spec.ts` | `test` from `./helpers/fixtures`, `waitForPageReady`, viewport tests |
| Backend public router (Phase 2) | `fastapi_backend/app/api/v1/settings.py` | router-level `require_internal_key` + `limit_by_client_ip`, `Literal[True]` success envelope, ETag |
| Backend admin router (Phase 2) | `fastapi_backend/app/api/v1/admin_users.py` | `require_admin(<permission>)`, `AuditorDep`, domain errors mapped to 403/404/409 |
| Enums (Phase 2) | `fastapi_backend/app/models/platform/enums.py` | `enum_column` + `enum_check`, 16-char text, no native enum |
| Migrations (Phase 2) | `fastapi_backend/app/core/platform_schema.py` | append revision id to `PLATFORM_REVISIONS`; never edit `0001` |

## 5. Files to change — Phase 1

| File (under `nextjs-frontend/`) | Action | Why |
| --- | --- | --- |
| `src/config/themes.ts` | UPDATE | add `freejoy` preset, `DEFAULT_THEME='freejoy'` |
| `src/config/fonts.ts`, `tailwind.config.ts` | UPDATE | display font → Inter 700/800; `display` fallback sans; add `rounded-pill` (999px), `rounded-card` (16px), `rounded-editorial` (24px), `rounded-input` (12px); container max 1314px |
| `src/app/globals.css` | UPDATE | Freejoy `:root` defaults, 56/64 display scale utilities, focus ring = ink |
| `src/config/site.ts`, `.env.example` | UPDATE | description/keywords for Freejoy; `NEXT_PUBLIC_APP_NAME=Freejoy` placeholder (no secrets) |
| `src/app/layout.tsx` | UPDATE | metadata `locale: en_GB`, author placeholders removed |
| `src/app/(public)/layout.tsx` | CREATE | header, footer, mobile tab bar, skip link |
| `src/app/(public)/page.tsx` | CREATE (move from `src/app/page.tsx`) | homepage |
| `src/app/(public)/freebies/page.tsx` | CREATE | catalogue with URL-preserved filters |
| `src/app/(public)/freebies/[slug]/page.tsx` | CREATE | offer detail + `generateMetadata` + `notFound()` |
| `src/app/(public)/category/[slug]/page.tsx` | CREATE | category landing |
| `src/app/(public)/alerts/page.tsx` | CREATE | alerts preferences |
| `src/app/(public)/{about,privacy,cookies,terms,affiliate-disclosure}/page.tsx` | CREATE | draft legal/editorial scaffolding |
| `src/app/(public)/contact/page.tsx` | CREATE (move) | keep disabled form, restyle |
| `src/app/not-found.tsx` | UPDATE | Freejoy styling |
| `src/components/site/*` | CREATE | `site-header.tsx`, `site-footer.tsx`, `mobile-tab-bar.tsx`, `announcement-bar.tsx`, `nav-items.ts`, `search-form.tsx` |
| `src/components/catalogue/*` | CREATE | `offer-card.tsx`, `offer-grid.tsx`, `offer-type-badge.tsx`, `category-grid.tsx`, `filter-sidebar.tsx`, `filter-drawer.tsx`, `filter-chips.tsx`, `sort-select.tsx`, `catalogue-pagination.tsx`, `catalogue-empty-state.tsx`, `demo-notice.tsx` |
| `src/components/offer/*` | CREATE | `offer-hero.tsx`, `offer-trust-panel.tsx`, `offer-cta.tsx`, `claim-steps.tsx`, `important-bits.tsx`, `related-offers.tsx`, `breadcrumbs.tsx` |
| `src/components/home/*` | CREATE | `home-hero.tsx`, `trust-strip.tsx`, `newsletter-band.tsx` |
| `src/components/alerts/alerts-form.tsx` | CREATE | client form, Zod, demo result state |
| `src/components/legal/legal-page.tsx` | CREATE | draft banner wrapper |
| `src/lib/catalogue/{types,fixtures,query,index}.ts` | CREATE | typed demo data + pure filter/sort/paginate |
| `src/lib/catalogue/offer-url.ts` | CREATE | search-param ↔ filter state codec (tested) |
| `src/__tests__/unit/lib/catalogue/*.test.ts` | CREATE | query + url codec |
| `src/__tests__/unit/components/{offer-card,offer-type-badge,site-header,alerts-form,filter-drawer}.test.tsx` | CREATE | component behaviour |
| `src/__tests__/unit/app/public-pages.test.tsx` | CREATE | each public route renders; offer 404 |
| `src/__tests__/unit/config/display-font.test.tsx`, `src/__tests__/e2e/display-font.spec.ts` | UPDATE | Inter display |
| `src/__tests__/e2e/freebies.spec.ts`, `offer-detail.spec.ts`, `alerts.spec.ts` | CREATE | journeys 1–3 incl. mobile and empty state |
| `src/__tests__/e2e/homepage.spec.ts` | UPDATE | pricing-link test becomes conditional; contact assertions kept |
| `public/freejoy/*.svg` | CREATE | original flat illustrations (not copied from the mockup files) |
| `docs/developer/freejoy-frontend.md` | CREATE | fixture contract, route list, what is demo |
| Backend | NONE | Phase 1 touches no Python |

## 6. Tasks — Phase 1 (in order)

### Task 0: Bootstrap repo
- **Action**: `git init` in `freejoy-app`; `git remote add template https://github.com/vpachipulusu/boiler-plate-fastapi-nextjs.git`; `git fetch template`; `git checkout -b main template/main`; commit the design kit and prompt (`docs: add Freejoy design reference and master prompt`); `git checkout -b feat/freejoy-phase1-frontend`; `npm ci` in `nextjs-frontend/`; copy `.env.example → .env.local` (placeholders only).
- **Validate**: `git log --oneline -3`; `npm run typecheck` green before any change.

### Task 1: Brand tokens
- **Action**: D2 + D3. Freejoy preset light + dark (dark mode derived: ink background, mint/coral kept AA). Pill button variant/size. Radii. Container width.
- **Mirror**: `themes.ts` `luxury` preset shape; `theme-contrast.test.ts` contrast helper.
- **Validate**: `npm run test:unit -- theme-contrast display-font button` green; admin and login still render (unit `admin-layout.test.tsx`, `auth-layout.test.tsx`).

### Task 2: Fixture catalogue module
- **Action**: `OfferType = 'free_sample'|'free_trial'|'cashback'|'voucher'|'competition'`; `Offer`, `Category`, `Merchant` types; 6 categories, 8 merchants, 24 offers with `demo: true`, explicit `postage`, `requiresCard`, `eligibility`, `lastVerifiedAt`, `status`, 2 `expired` examples; pure `filterOffers`, `sortOffers`, `paginate`, `parseCatalogueParams`, `toCatalogueHref`.
- **Validate**: unit tests ≥ 90% on `src/lib/catalogue`.

### Task 3: Public shell
- **Action**: `(public)/layout.tsx`, header (logo, nav, search, Log in, Get free alerts pill; 390px: logo + search + menu sheet), footer, mobile tab bar (D8), announcement bar, skip link, `main` landmark.
- **Validate**: keyboard tab order test; 320/390/768/1024/1440 screenshots.

### Task 4: Homepage
- **Action**: hero (cream panel, display 56/64 → fluid), trust strip (4 items, worded as site promises not metrics), category grid, "Freshly found" 8 cards, newsletter band (demo state), footer.
- **Validate**: unit render test; compare to `01_home_desktop.png`, `05_home_mobile.png`.

### Task 5: Catalogue + category pages
- **Action**: search form (GET, preserves other params), desktop sidebar (categories radio, offer type checkboxes, availability incl. "No postage"), mobile chips + drawer, sort select (newest, ending soon, A–Z), link pagination, empty state with "Clear filters", expired offers excluded by default.
- **Validate**: `freebies.spec.ts` journey 2 incl. empty state; URL round-trip unit test.

### Task 6: Offer detail
- **Action**: hero image, type badge, trust panel (verified-at from fixture, labelled demo), CTA → `DemoNotice` dialog (D6), affiliate disclosure line, claim steps, important bits (eligibility / cost & postage / availability / cancellation if trial), related offers, `generateMetadata` + `noindex` (D9), `notFound()` for unknown slug, expired state banner replacing the CTA.
- **Validate**: `offer-detail.spec.ts`; unit: expired offer hides CTA; unknown slug → 404.

### Task 7: Alerts page
- **Action**: two-panel layout, form with Zod (email, ≥1 category, frequency, consent required), inline errors, pending state, demo result (D7), unsubscribe explanation text.
- **Validate**: `alerts-form.test.tsx` validation paths; `alerts.spec.ts`.

### Task 8: Legal + 404 + contact
- **Action**: `LegalPage` wrapper with draft banner; six pages; restyle 404 and contact.
- **Validate**: `public-pages.test.tsx`.

### Task 9: Quality gate + evidence
- **Action**: `npm run lint && npm run typecheck && npm run test:unit && npm run build`; `npm run test:e2e:local -- freebies offer-detail alerts homepage` (needs backend running; if unavailable, report exactly that); built-in browser screenshots at 1440 and 390 for `/`, `/freebies`, `/freebies/[slug]`, `/alerts` saved to `docs/evidence/phase1/`; side-by-side notes vs PNGs; coverage report; docs page; conventional commits; **stop for visual approval**.

## 7. Validation commands

```bash
cd nextjs-frontend && npm run lint && npm run typecheck && npm run test:unit && npm run build
```
```bash
cd nextjs-frontend && npm run test:coverage
```
```bash
cd nextjs-frontend && npm run test:e2e:local -- freebies offer-detail alerts homepage
```
```bash
uvx pre-commit run --from-ref template/main --to-ref HEAD
```

## 8. Phases 2–4 (story-level, not built now)

**Phase 2 — catalogue backend + admin** (after visual approval)
- Models in `app/models/platform/`: `category.py`, `merchant.py`, `offer.py` (+ `OfferType`, `OfferStatus` enums via `enum_column`), `affiliate_link.py`, `click_event.py`, `email_subscriber.py`. Indexes on `offers(slug) unique`, `offers(status, end_at)`, `offers(category_id, status)`, `email_subscribers(email) unique`.
- Migration `0002_freejoy_catalogue` registered in `PLATFORM_REVISIONS`; CI alembic upgrade/check/downgrade.
- Permissions added to `ADMIN_PERMISSIONS`: `offers.read/write/publish`, `categories.write`, `merchants.write`, `subscribers.read`.
- Routers: `catalogue.py` (public, internal key + IP limit), `admin_offers.py`, `admin_categories.py`, `admin_merchants.py` (require_admin + audit). Services/repositories per aggregate. Tests + `*_e2e.py`.
- `commands/seed_catalogue.py` seeding clearly marked dev data (never in production env).
- OpenAPI regen + `src/lib/api/catalogue.ts` (`shared: true`, `unstable_cache` tag `catalogue`), `revalidateTag` from admin publish actions. `src/lib/catalogue/index.ts` switches from fixtures to API; fixtures stay for tests.
- `/admin/offers`, `/admin/offers/new`, `/admin/offers/[id]`, `/admin/categories`, `/admin/merchants`; nav items; status workflow draft → published → expired/archived; `/admin/seo` left as is.

**Phase 3 — affiliate redirect, newsletter, SEO**
- `src/app/go/[offerId]/route.ts`: looks up server-stored destination via backend, validates `https:` + host allowlist, 307 `Cache-Control: no-store`, refuses expired/unpublished, records click via `POST /v1/catalogue/clicks` (no PII, no cookies). Proxy: rate-limit `/go/*`; `/api/*` allowlist untouched.
- `rel="sponsored nofollow"` + disclosure on every outbound CTA.
- Newsletter: provider adapter interface in backend (`app/core/email_provider.py`), Brevo or Resend chosen after confirming double-opt-in support and pricing; `POST /v1/subscribers`, `GET /v1/subscribers/confirm`, `POST /v1/subscribers/unsubscribe`; consent provenance stored; frontend route handler allowlisted in proxy with rate limit; Phase 1 demo state replaced.
- `sitemap.ts` (published only), `robots.ts`, JSON-LD `WebSite`/`BreadcrumbList` only; `SeoMeta` wired for home/catalogue if useful.
- Playwright: anonymous browse → detail → tracked outbound; opt-in lifecycle.

**Phase 4 — backlog**: favourites (D8), approved network feed imports, offer-health monitoring, scheduling, newsletter segmentation, revenue attribution from network reports, paid placements.

## 9. Risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Display-font switch breaks `display-font` tests and the serif look elsewhere (dashboard headings) | High | Update tests in the same commit; dashboard/admin headings inherit Inter 800 which matches the admin mockup (08). |
| Theme preset leaks Freejoy colours into admin in a way that hurts contrast | Medium | Run `theme-contrast` and `button-contrast` tests; keep `--feature` ink sidebar which the admin mockup already uses. |
| Moving `src/app/page.tsx` into `(public)` conflicts with Capacitor/landing touch point in `modules.md` | Low | Update `modules.md` touch-point table. |
| Fixture "freshness"/"verified" labels read as real claims | Medium | D9/D10: demo badge on every card, `noindex`, no dates derived from `Date.now()`. |
| Playwright e2e needs a running backend and Firebase test project | High | Report exactly which specs ran; unit + build are the gate (matches repo CI). |
| Missing SVG kit → icon/illustration fidelity | Medium | Draw simple original SVG shapes; note deviations in the evidence summary. |
| Scope creep into Phase 2 | Medium | Hard stop after Task 9; backend untouched. |

## 10. Acceptance — Phase 1
- [ ] Routes live: `/`, `/freebies`, `/freebies/[slug]`, `/category/[slug]`, `/alerts`, `/about`, `/contact`, `/privacy`, `/cookies`, `/terms`, `/affiliate-disclosure`, 404.
- [ ] No sign-in needed on any of the above; `/login`, `/admin`, `/dashboard` unchanged in behaviour.
- [ ] Filters/search/sort/pagination round-trip through the URL; empty state has a way out.
- [ ] Every fixture offer is visibly labelled demo; no external `href` on offer CTAs; no fabricated metrics.
- [ ] Keyboard: skip link, focus rings, labelled fields, visible validation errors; 44px targets.
- [ ] Lint, typecheck, unit (≥80%), build green; e2e results reported honestly.
- [ ] Screenshots at 1440 and 390 for the four core pages, compared against the PNGs.
- [ ] Nothing pushed to any `main`; no new secrets; no Python changes.

## 11. Jira issues created (project FREEJ, https://storecart.atlassian.net/browse/FREEJ-n)

| Epic | Stories |
| --- | --- |
| FREEJ-1 Phase 0 — bootstrap, tokens, planning | FREEJ-6 repo bootstrap + feature branch · FREEJ-7 theme preset + Inter display font |
| FREEJ-2 Phase 1 — design-first frontend | FREEJ-8 fixture catalogue module · FREEJ-9 public shell · FREEJ-10 homepage · FREEJ-11 catalogue page · FREEJ-12 category pages · FREEJ-13 offer detail · FREEJ-14 alerts page · FREEJ-15 legal/404/contact · FREEJ-16 quality gate + evidence |
| FREEJ-3 Phase 2 — catalogue backend + admin | FREEJ-17 models + Alembic 0002 · FREEJ-18 public catalogue API · FREEJ-19 admin API + permissions + audit · FREEJ-20 dev seed command · FREEJ-21 fixtures → API wrapper · FREEJ-22 admin offers UI |
| FREEJ-4 Phase 3 — affiliate, newsletter, SEO | FREEJ-23 /go redirect + click events · FREEJ-24 newsletter provider + double opt-in · FREEJ-25 sitemap/robots/JSON-LD · FREEJ-26 UK compliance checklist · FREEJ-27 e2e money paths |
| FREEJ-5 Phase 4 — backlog | FREEJ-28 favourites · FREEJ-29 network feed import + health monitoring |

Phase 1 execution order: FREEJ-6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16, then stop for visual approval.
