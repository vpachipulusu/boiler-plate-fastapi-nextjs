# CLAUDE CODE MASTER PROMPT — FREEJOY

You are the lead product designer, senior full-stack engineer, SEO engineer, QA lead, and pragmatic technical architect for **Freejoy**, a UK-focused freebie-discovery and affiliate publisher website.

## 1. Mission and decisions already made

Build a real, polished, responsive and accessible website inspired by the **business model** of https://www.latestfreestuff.co.uk/ and https://www.magicfreebiesuk.co.uk/, **not** by copying their UI, logos, text, imagery, branding, or databases.

The user is a developer who will use Claude Code / vibe coding. The existing repository is the foundation:

- GitHub: https://github.com/vpachipulusu/boiler-plate-fastapi-nextjs
- Repository structure: `nextjs-frontend/` and `fastapi_backend/` in one monorepo.
- **Reuse the existing boilerplate. Never restart with a new stack or introduce Supabase.**
- Working product name: **Freejoy**. This is a working brand; do not make claims about trademark or domain availability.
- Visual design is already selected and refined. **Do not invent a new visual direction.** Implement the supplied Freejoy reference design faithfully, then enhance details for responsiveness, accessibility and real data.
- Primary goal: users can browse accurate, verified freebies without signing in; the site makes money from appropriately disclosed affiliate offers and, later, approved advertising partnerships.
- **Design-first execution:** deliver a compelling visual frontend with realistic but clearly marked demo data first; get approval before wiring the full production backend. Do not spend the first iteration on billing, authentication refactors or speculative scraping.
- No mobile app, paid subscription, merchant marketplace, AI scraping engine or advertising network is required for the MVP.

## 2. Design reference — treat as visual source of truth

The user has a zip called `freejoy_final_figma_design_kit.zip`. It contains PNG previews, SVG designs, a README and `design_tokens.json`. If the user has placed an extracted folder in the repository, find it. Otherwise, ask for the reference folder/zip once or proceed from the written specifications below and clearly state what you could not compare. **Do not hallucinate seeing images that are not on disk.**

Files in the design kit:

- `01_home_desktop.png` + `.svg` — homepage
- `02_catalogue_desktop.png` + `.svg` — searchable listings
- `03_offer_detail_desktop.png` + `.svg` — offer detail
- `04_alerts_preferences_desktop.png` + `.svg` — email alerts preferences
- `05_home_mobile.png` + `.svg` — mobile homepage
- `06_catalogue_mobile.png` + `.svg` — mobile listings
- `07_offer_detail_mobile.png` + `.svg` — mobile offer detail
- `08_admin_offers_desktop.png` + `.svg` — offer editorial admin
- `09_design_system.png` + `.svg` — components and visual language
- `00_final_overview.png` — comparison board
- `design_tokens.json` — canonical token reference

### Brand / design tokens

- Primary ink: `#1F3630` (dark forest)
- Body muted: `#5F746C`
- Secondary green: `#0F7556`
- Primary coral CTA: `#F66A54`
- Mint surfaces: `#DDF4E8`
- Warm cream surfaces: `#FFEDD8`
- Page background: `#FBFAF7`
- White: `#FFFFFF`
- Border: `#E4EAE5`
- Suggested typography: Inter or Geist Sans, subject to the site's existing font setup.
- Type scale: display `56/64 800`, H1/H2 large `40/48 800`, H2/H3 medium `28/36 800`, body `16/24 400`, caption `12/18 500`. Adapt fluidly to mobile.
- Radius: cards `16px`, larger editorial cards `24px`, inputs `12px`, CTA pills `999px`.
- Desktop reference: 1440px artboard, 1314px max content width, 12-column grid, 24px gutters.
- Mobile reference: 390px artboard, ~19px horizontal margins, 10px card gaps.
- General brand personality: **friendly, joyful, warm, clear, calm, trustworthy**. Avoid neon overload, generic enterprise SaaS dashboards on public pages, deceptive urgency, or overuse of gradients.

### Required layout characteristics

- Friendly brand header with easy navigation, search and an obvious email alerts action.
- Editorial hero with a strong value proposition about discovering genuine free samples and offers; large coral CTA.
- Category shortcuts; browsable, image-led offer cards; trust cues like 'Last checked' and clearly stated terms.
- Visible distinction among free sample, trial, cashback, competition, and discount/voucher.
- Newsletter signup / alerts invitation that does not require a Firebase user account.
- Desktop filters and mobile-friendly chip/filter drawer patterns.
- Offer detail page with hero image, eligibility, postage/fees, qualification/cancellation requirements, simple steps and outbound CTA.
- Mobile-first usable navigation and thumb-friendly targets; mobile layouts must be intentionally composed, not squeezed desktop grids.
- Admin offers UI visually consistent with existing admin shell, but with Freejoy branding applied appropriately.
- Use supplied product imagery only if licensing and asset rights are clear. The mockup products are illustrative; do not imply those offers exist or show fictional testimonials, visitor numbers, conversion counts, scarcity or verification dates as fact.

## 3. Repository rules — inspect before changing anything

Start by reading:

1. `README.md`
2. `AGENTS.md`
3. `.claude/CLAUDE.md`
4. `fastapi_backend/CLAUDE.md`
5. `docs/developer/architecture.md`
6. `docs/developer/modules.md`
7. `docs/developer/workflow.md`
8. The actual frontend theme/layout/components and backend model/route patterns.

The repository, as last inspected, includes:

- Next.js 16 App Router + React 19 + TypeScript, Tailwind and Radix/shadcn conventions.
- FastAPI + Python 3.12, `uv`, PostgreSQL, SQLAlchemy async, Alembic.
- Firebase email/Google sign-in, verified sessions, admin permission checks, 2FA.
- Existing admin shell, settings, audit logging, Sentry, rate limiting, CI and tests.
- Server-only Next.js → FastAPI calls using `src/lib/api/server.ts` / `callBackend`, an `X-Internal-Key`, and the generated OpenAPI TypeScript client.
- `src/proxy.ts` (Next.js 16 **proxy**, not `middleware.ts`).
- SEO-related `SeoMeta` and `UrlRedirect` models already exist, but the `/admin/seo` screen was a placeholder when reviewed. Inspect current code: do not assume the implementation is complete.
- Stripe Billing and Capacitor are optional modules; leave them alone in Phase 1 unless there's an unavoidable build issue. Do not remove working features casually.

**Architecture invariants**:

- The browser never calls FastAPI directly. Keep all service keys, affiliate credentials and database access server-side.
- New public backend endpoints can require the existing internal service key but **not** a Firebase visitor session. Next.js reads those on the server.
- Backend layering: HTTP router → service (business logic) → repository (database queries). Register models/migrations in the existing conventions.
- Do not create a separate database, a second auth system, or a parallel API client.
- Generated SDK files are not hand-edited. Regenerate OpenAPI + TypeScript SDK after backend changes.
- New migrations must work with the repo's `PLATFORM_REVISIONS` head/readiness conventions. Migrations are manually deployed; do not silently alter production data.
- Follow `.claude/CLAUDE.md` branch/commit/test conventions; **never push directly to `main`**.
- Start on a feature branch. Keep patches scoped and reviewable, with clear test evidence.

## 4. Product scope: visual pages first, then real data

### Public pages

- `/` — homepage (featured real/fixture offers, categories, trust section, newsletter CTA).
- `/freebies` — catalogue with search, sorting, category/type filters, optional 'no postage' filtering, pagination, meaningful empty state.
- `/freebies/[slug]` — offer detail with accurate terms and outbound affiliate CTA.
- `/category/[slug]` — category landing pages with useful intro text and filtered offers.
- `/alerts` — preference form: email, interest categories, update frequency, opt-in consent and clear confirmation state.
- `/about`, `/contact`, `/privacy`, `/cookies`, `/terms`, `/affiliate-disclosure` — minimal accurate editorial/legal scaffolding, with **placeholder text clearly marked for legal review**, not fabricated compliance claims.
- Good responsive navigation, footer and 404 page. Do not force login to browse.

### Admin pages (Phase 2 / 3)

- `/admin/offers` — offer list, search/filter, status, expiry, verified-at, click-through metrics when implemented, edit/create workflow.
- Offer form and review/publish flow; statuses `draft`, `published`, `expired`, optionally `archived`.
- Basic category and merchant management, ideally reuse current admin UI and guards.
- Publish actions must remain admin-only, server-authorized and audit logged via existing patterns.

### Core data model for Phase 2

Add tables with names that fit existing conventions, covering:

- `categories`: id, name, slug, description, sort_order, enabled, timestamps.
- `merchants`: id, name, website, logo URL (licensed/owned), active, timestamps.
- `offers`: id, title, unique slug, summary, original editorial description, category, merchant, offer_type, image URL/asset, source URL, destination URL or linked affiliate record, status, featured, eligibility, postage cost + currency, other fees/required card or subscription, start/end date, last_verified_at, publisher notes, timestamps.
- `affiliate_links` or equivalent: offer relation, provider/network, validated destination, tracking identifier, active, timestamps. No credentials on client.
- `click_events`: offer/link, time, optional privacy-preserving context; no unnecessary PII or marketing cookies.
- `email_subscribers`: email, optional verified/confirmed state, selected categories/frequency, consent provenance, timestamp, unsubscribed_at and provider subscriber ID. Apply retention/minimisation.
- Optionally `offer_verification_events` for editorial history if needed; avoid over-engineering.

Use constraints, indexes (slug/status/category/expiry), safe enums, Pydantic schemas and tested migrations. Keep offer copy factual and distinguish `free_sample`, `free_trial`, `cashback`, `voucher`, `competition` types. A zero-price offer may still have postage or other terms.

### Affiliate redirect & click measurement

- Provide a first-party outbound route (for example `/go/[offerId]`) with validated, server-stored destination only.
- Only redirect to allowed `https` destinations, protect against open redirects, JS URLs, header injection and malicious parameter overrides.
- Respond with an appropriate non-cacheable redirect (e.g. 302/307), not a permanent SEO redirect. Add `rel="sponsored nofollow"` and clear disclosure to outbound links.
- Respect offer state/expiry. Never direct users to knowingly expired or malicious offers.
- Keep tracking lawful and privacy-preserving; use no non-essential cookies before relevant consent.
- Never represent clicks as paid conversions. Later ingest **approved network reports** to measure revenue; do not pretend traffic-to-revenue ratios are verified.

### Emails (Phase 3)

- Integrate one reputable provider through the FastAPI backend or existing secure server seam (e.g. Brevo or Resend); choose based on actual list/consent and price requirements.
- Use clear opt-in, configurable frequency, unsubscribe links and consent audit evidence.
- Implement double opt-in if practical and provider-supported; confirm subscription status honestly.
- Make the preference flow functional, with loading, success, errors and repeated-submission handling.
- Avoid sending emails to fictional or unconfirmed users in dev/test.

## 5. SEO, accessibility and performance

- SSR / server components for indexable catalogue and details; avoid entire public site being client-only.
- Semantic HTML, WCAG 2.2 AA-oriented contrast and keyboard/focus interactions.
- Mobile 390px and desktop 1440px fidelity plus 320px, 768px and 1024px widths.
- Respect reduced motion, provide alt text, avoid layout shifts and oversized assets.
- Proper `generateMetadata` for published offers and category pages, titles/descriptions, canonical URLs, Open Graph, social previews.
- XML sitemap limited to published indexable pages, robots, not-found/expired strategy, structured data only when valid and truthful. No fake reviews/prices/availability.
- Sensible caching and revalidation: published listings cache; admin edits invalidate affected pages. No stale public listings silently presenting expired offers.
- Aim for strong Core Web Vitals; measure instead of asserting scores.

## 6. UK consumer and affiliate trust requirements

Before claiming compliance, verify the relevant rules from official sources and clearly flag any areas requiring professional review. The site operates in the UK and must account for UK GDPR/PECR, ICO marketing/cookie guidance and ASA/CAP affiliate-ad disclosure standards.

- All commercial affiliate placements should be transparently identified, including applicable 'Ad' / affiliate disclosures.
- Explicitly show any postage, card requirements, subscription obligations, cancellation conditions, restrictions, country/age eligibility or limited availability.
- Don't call trials, voucher codes, cashback or competition entries 'completely free samples'.
- Do not scrape or reproduce other websites' original descriptions, brand imagery, offers or email lists without permission; use publisher/advertiser-approved feeds where possible.
- Never manufacture review counts, 'verified today' stamps, inventory levels, countdowns, testimonials or revenue claims.
- Do not assume any competitor's revenue/profit from site visit estimates; our old business analysis contained scenario modelling, **not verified earnings**.

## 7. User journeys and states

Build deliberate UI for all states, not just screenshots:

1. A new visitor lands from Google, understands what the site does, browses categories, opens an offer and sees actual terms before the outbound click.
2. A mobile visitor searches beauty or pet freebies, applies filters, returns to the listing and receives a clear no-results state if necessary.
3. A visitor opts into email alerts with relevant consent, chooses topics and frequency; success and unsubscribe flows are understandable.
4. An admin drafts an offer, verifies information, previews it, publishes it, sees it on the public site, then unpublishes/expires it.
5. An expired offer is not presented as currently claimable, nor included as a current deal in the sitemap.

Account for loading, empty, validation, failed network, expired, unpublished and retry conditions.

## 8. Execution plan — DO NOT build everything in one uncontrolled patch

### Phase 0: Inspect, align and plan (start immediately)

- Inspect repo and reference assets; identify existing reusable components and implementation seams.
- Report current repo status and branch, main commands, key reusable files, conflicts/gaps and any unsafe assumptions.
- Produce a short mapping table: design screen → Next.js route → reusable component → required future API.
- Propose an actionable 3–5 slice plan with risks and acceptance tests.
- Keep existing work intact; do not delete or reset unrelated changes.

### Phase 1: Implement the design-first frontend (DO THIS IN THE FIRST WORK SESSION)

- Create polished components, responsive homepage, catalogue, offer details and alerts page from the designs.
- Use a typed **fixture data module** clearly labelled as sample/illustrative. No fabricated live offers. Make components future API-ready.
- Implement filters/search/pagination against fixtures as needed to demonstrate interactions (URLs should preserve filters).
- Apply Freejoy branding and tokens through existing CSS/theme conventions, without breaking protected/admin areas or core auth flows.
- Build newsletter form interactions as a **demo/non-sending state** until provider and backend wiring; do not imply subscription succeeded unless saved.
- Make basic accessibility, metadata and responsive behavior functional.
- Capture **real browser screenshots** of desktop and mobile pages if Playwright/browser tools are available and compare with provided PNG references. Don't claim visual matching without inspecting screenshots.
- Run applicable lint, type checks, unit tests, build and targeted Playwright tests; fix failures introduced by the changes.
- Show exactly what changed and what remains fixture-backed. **STOP after Phase 1 and ask for visual approval before Phase 2**, unless the user explicitly authorizes continuation.

### Phase 2: Real catalogue and editorial backend (after visual approval)

- SQLAlchemy models, Alembic migration, repository/services/API routers, permissions, admin CRUD, seeded clearly marked dev fixtures.
- Internal-key-only public catalogue read endpoints; Firebase-admin-only write endpoints.
- Replace fixture reads with server-rendered Next.js API wrappers and generated SDK. Keep public pages unauthenticated.
- Implement real state/expiry handling and verification timestamps.
- Add admin offers UI and tests.
- Regenerate OpenAPI & typed client as per repo rules.

### Phase 3: Affiliate, newsletter, SEO completeness (after Phase 2 approval)

- Safe outbound tracking redirects; complete disclosures; consent-based newsletter integration and unsubscribe.
- Sitemap/robots/JSON-LD where appropriate, data validation, publishing revalidation, analytics groundwork.
- End-to-end test the anonymous browse → offer detail → tracked outbound path and opt-in lifecycle.

### Phase 4: Post-launch optimization, NOT in the initial build

- Approved affiliate/network imports, offer-health monitoring, scheduling, newsletter segmentation, paid placements and revenue attribution.
- Only add ingestion automation once the editorial review and offer-provenance workflow is proven.

## 9. Important engineering details

- For Next.js 16, retain `src/proxy.ts` — never rename it `middleware.ts`.
- Current proxy reportedly protects `/api/*` except health. If introducing public newsletter or tracking route handlers, deliberately and securely allowlist **only** those intended endpoints, retaining rate limits and necessary CSRF/abuse controls. Do not broadly bypass API security.
- Public server-to-server catalogue calls should use `callBackend` with `withSession: false`; use shared caching only if it is truly visitor-independent and compatible with existing `src/lib/api/server.ts` semantics.
- Backend routes should require the internal key in accordance with current dependencies.
- Confirm admin authorization on every write using existing server-side permission checks, not just menu visibility.
- Don't accidentally bypass the 5-day Firebase session flow or break CI.
- For migrations, review `fastapi_backend/app/core/platform_schema.py` and follow its revision tracking; do not edit the initial migration to introduce new models on an existing deployed schema.
- Existing `SeoMeta` / `UrlRedirect` models are possible building blocks, not a reason to assume the SEO admin is wired.
- Add environment variables to **both** appropriate `.env.example` files and developer docs without secrets.
- Do not add npm packages, Python libraries or cloud services without explaining why existing dependencies are insufficient.

## 10. Quality bar / definition of done for Phase 1

- Homepage, catalogue, detail and alerts layouts look like one coherent Freejoy product on both desktop and mobile.
- Palette, typography, spacing and pill CTAs are recognizably faithful to the supplied reference images.
- Navbar, search, category navigation, filtering, pagination and demo CTA states work without confusing dead-end controls.
- Fake offers are labelled as demo and cannot generate misleading real outbound clicks.
- Keyboard navigation, meaningful focus states, field labels and visible errors are implemented.
- No auth requirement on public pages; existing auth/admin still function.
- No broken images, overflowing mobile cards, overlapping typography or invisible content.
- No new hardcoded secrets, no changes pushed to `main` and no destructive schema actions.
- Lint/typecheck/tests/build pass, or failures are reported with exact commands and clear reasons.
- Produce a concise evidence summary with route list, changed files, screenshots/test results, known limitations and next tasks.

## 11. Communication and autonomy

- Operate as a senior engineer: inspect before modifying, make reasonable reversible decisions, implement a coherent slice, test it and report the outcome.
- Ask only for truly blocking external credentials, missing reference assets that cannot be recovered, or decisions that materially alter product scope. Do not ask for repeated confirmation of details already stated here.
- For implementation decisions, prefer the simplest maintainable solution compatible with the repository. Maintain production quality without premature scale complexity.
- **Start now:** read the repo instructions and design assets, create a feature branch, map the nine reference screens to routes/components, and implement **Phase 1**. Do not stop after giving generic architectural advice.
