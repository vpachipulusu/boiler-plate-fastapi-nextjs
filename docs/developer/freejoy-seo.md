# Freejoy SEO (FREEJ-25)

How the public site decides what search engines may index, what the sitemap and robots.txt contain,
and which structured data it emits. Code lives in `nextjs-frontend/src/lib/seo/`,
`src/components/seo/json-ld.tsx`, `src/app/sitemap.ts` and `src/app/robots.ts`. Page metadata is set in
the pages under `src/app/(public)/`.

## Indexing policy

Indexability is decided by the catalogue data, not by a flag in the code. The one exception is
`ALERTS_FORM_LIVE` (an environment variable read in `src/app/(public)/alerts/page.tsx`, unset by default): a
deliberate pre-launch hold that keeps `/alerts` noindex, and shows a "not open yet" notice instead of the form,
until `ALERTS_FORM_LIVE=true` is set at build time once a provider is configured. The page has no catalogue
data to decide from.

| Helper (`lib/seo/indexing.ts`) | Rule |
|---|---|
| `isIndexableOffer(offer, today)` | `source === 'api'`, not `demo`, `status === 'published'` and `isLive(offer, today)` |
| `isCatalogueApiBacked(offers)` | at least one offer has `source === 'api'` and is not `demo` |
| `isIndexableCategory(category, offers)` | the category is enabled and the catalogue is API-backed |
| `isRefinedQuery(query)` | any search, category, type, postage, non-default sort, or page above 1 |
| `expiredIndexingPolicy(offer, today)` | see "Expired offers" |

`lib/seo/metadata.ts` turns those answers into Next.js `robots` and `openGraph` values:

| Page | Fixture catalogue (today) | API-backed catalogue |
|---|---|---|
| `/` | `noindex` | `index, follow` |
| `/freebies` page 1, no filter | `noindex` | `index, follow` |
| `/freebies` with any filter, search, sort or page above 1 | `noindex, follow` | `noindex, follow` |
| `/category/[slug]` | `noindex` | `index, follow` |
| `/category/[slug]` with a filter, search, sort or page above 1 | `noindex, follow` | `noindex, follow` |
| `/freebies/[slug]`, live | `noindex` | `index, follow` |
| `/freebies/[slug]`, ended | `noindex, follow` | `noindex, follow` |
| `/alerts` | `noindex` | `noindex` until the form is live |
| Legal pages | not part of this story | not part of this story |

Every refined view canonicalises to its base path (`/freebies`, `/category/<slug>`), so the filter
combinations never compete with the base page.

### How the flip to indexable happens

Nothing needs editing when FREEJ-21 lands. Fixture offers carry `source: 'fixture'` and `demo: true`, so
every helper answers "not indexable". When the facade in `src/lib/catalogue/index.ts` starts returning
offers with `source: 'api'` and `demo: false`:

1. `generateMetadata` on `/`, `/freebies` and `/category/[slug]` reads `getLiveOffers()`, sees an API
   offer and returns indexable robots for the unrefined view.
2. Each live API offer page returns indexable robots through `offerRobots`.
3. `sitemap.xml` starts listing the enabled categories and the indexable offers.

Pages revalidate hourly (`export const revalidate = 3600` on `/`, `/freebies/[slug]` and the sitemap)
so a data change reaches search engines within an hour without a deploy. `/freebies` and
`/category/[slug]` render on demand because they read the URL query.

Two consequences to know about:

- "API-backed" is a property of the whole catalogue (any live, non-demo API offer), as specified for
  FREEJ-25. A category with no live offers is therefore still indexable once the catalogue is
  API-backed. If thin category pages become a problem, tighten `isIndexableCategory` to require an
  indexable offer in that category.
- "API-backed" is derived from the **live** offers list. If the API is in use but there are zero live
  offers (launch day, or a lull between campaigns), the list is empty, the catalogue reads as not
  API-backed, and `/`, `/freebies` and every category go `noindex` until a live offer exists. A test
  pins this. The same happens, deliberately, when the live-offers read fails: the SEO code logs the
  error (`lib/seo/live-offers.ts`) and falls back to `noindex` and a sitemap of the static pages
  only, so a catalogue outage never throws from `generateMetadata` or the sitemap.
  **FREEJ-21 should add a facade function `getCatalogueSource()`** that says whether the catalogue is
  fixture- or API-backed independent of what is live, and `lib/seo` should switch to it. FREEJ-21
  must also make `getToday()` return the **Europe/London calendar date** (not the UTC date), because
  `isLive` and the 30-day expiry policy compare calendar days.

## Expired offers

`expiredIndexingPolicy` returns one of four states:

| State | When | Status | Robots |
|---|---|---|---|
| `live` | published and not past `endAt` | 200 | decided by the data (above) |
| `ended` | expired, or past `endAt`, for up to 30 days (`EXPIRED_NOINDEX_DAYS`) | 200 with the "This offer has ended" state | `noindex, follow` |
| `gone` | more than 30 days after `endAt` | 410 by policy | `noindex` |
| `unavailable` | draft or archived | 404 | n/a |

Edge cases, all pinned by tests:

- An expired offer with no `endAt`, or an `endAt` that is not a readable date (for example `soon`),
  has no date to count from, so it stays `ended`.
- An offer marked `expired` whose `endAt` is still in the future stays `ended`, and only becomes
  `gone` once `today` is more than 30 days after `endAt`.
- Day counting uses calendar dates in UTC arithmetic, so BST starting or ending and year boundaries
  do not shift the count.
- `OfferIndexingPolicy.httpStatus` is reserved for the Phase 3 410 ticket: no page reads it yet.

**What actually ships for `gone`: a 404, not a 410.** A Next.js page cannot set its own status code;
`notFound()` always answers 404. A 410 needs a route handler or the proxy, and the proxy runs without
catalogue access. So for an API-sourced offer more than 30 days past its end date the page calls
`notFound()` (404). Search engines treat a 404 and a 410 almost the same way; a 410 only drops the URL
a little faster. Making it a real 410 is a **Phase 3 follow-up** (for example a catalogue-aware route
handler or a rewrite for offers the API reports as gone). Fixture offers are never "gone" so the design
preview keeps rendering.

## Sitemap and robots.txt

`/sitemap.xml` (`src/app/sitemap.ts`, built by `lib/seo/sitemap.ts`) lists:

- `/` and `/freebies`, always;
- each enabled category, only when the catalogue is API-backed;
- each indexable offer (published, live, API-sourced, not demo), through the facade.

Expired, draft and fixture offers never appear. `lastModified` is the offer's own `lastVerifiedAt`
(or `startAt`) when present; `/`, `/freebies` and a category use the newest of their offers. Nothing
uses the wall clock, and an entry without a date simply has no `lastmod`.

**While fixture-backed the sitemap lists only `/` and `/freebies`**, and both of those answer
`noindex`. That is deliberate (the story asks for the sitemap and robots to serve from day one) but
Search Console will flag "submitted URL marked noindex" if the sitemap is submitted before real data
exists. Do not submit it until the API is live.

Sitemap URLs are built with each path segment percent-encoded, so a slug containing a space, `?` or
`#` cannot change the URL.

`/robots.txt` allows `/` and disallows `/admin`, `/dashboard`, `/settings`, `/profile`, `/security`,
`/go/`, `/api/`, `/login`, `/signup`, `/reset-password` and `/verify-email`, and points at `<site url>/sitemap.xml`. `/go/` is the affiliate redirect that Phase 3 adds.
`robots.txt` is not a security control and it does not remove already indexed URLs; the noindex meta
tags above do that job for public pages.

## Structured data (JSON-LD)

Emitted by `<JsonLd>` (`components/seo/json-ld.tsx`), a server component that serialises with every
`<` replaced by its JSON unicode escape (backslash, `u003c`) so page text such as `</script>` cannot
close the script tag; the U+2028 and U+2029 line separators are escaped the same way. It adds no
visible content.

| Page | Schemas |
|---|---|
| `/` | `WebSite` (with a `SearchAction` to `/freebies?q={search_term_string}`) and `Organization` |
| `/category/[slug]` | `BreadcrumbList` (Home, category) |
| `/freebies/[slug]` | `BreadcrumbList` (Home, category, offer) |

`Organization` has a name and URL only. A `logo` is added only when `buildOrganization` is given the
path of a real brand asset; the current `public/icon-*.png.svg` files are placeholders (a black tile
with the letter "S"), so none is declared.

### Why there is no `Offer` or `Product` schema

Google's `Offer` and `Product` rich results describe something the page sells, with a price,
availability and often ratings. Freejoy sells nothing: it links to other merchants' promotions, the
terms change without notice, and it holds no price, stock level or review that it could state
truthfully. Marking up a free sample as an `Offer` with `price: 0` would claim a transaction the site
cannot honour, and invented availability or ratings would be misleading structured data that can lead
to a manual action. The builders therefore never emit `Offer`, `AggregateOffer`, `Product`, `Review`
or `AggregateRating`, nor any `price`, `priceCurrency`, `availability` or `rating` key; a unit test
walks every builder's output to enforce that. Reconsider only with a Google-documented type that
fits (for example `Event` for a dated competition) and data the editors verify.

## Metadata details

- Canonical and Open Graph (`og:url`, title, description, `en_GB`, site name) are set per page
  through `openGraphFor`. A page-level `openGraph` replaces the root layout's, so the root
  `og-image.png` is not inherited (see the follow-ups: that file does not exist).
- The site origin comes from `NEXT_PUBLIC_APP_URL` (`lib/seo/urls.ts`, read at call time and
  shared by canonicals, the sitemap, robots.txt and JSON-LD). In production off Vercel, rendering
  throws if it is unset, and a value must be a valid https URL (a loopback host is allowed over
  http because CI and the local e2e build use `http://localhost:3000`). On Vercel with it unset the
  deployment URL is used; in development and test it falls back to `http://localhost:3000`. A
  trailing slash is stripped. The Open Graph title on `/freebies` is always "All freebies"; the
  `<title>` still follows the search text.
- Page-level `robots` replaces the root layout's, so indexable pages repeat the snippet and
  image-preview allowances (`INDEXABLE_ROBOTS`).

## Owner follow-ups

These need a human, a public URL or a decision, and were not done in FREEJ-25:

1. **Google Rich Results Test and Search Console.** The Rich Results Test needs a public URL. Once a
   real deployment has API data, run it on `/` (WebSite, Organization) and on one offer and one
   category page (BreadcrumbList), then submit `/sitemap.xml` and spot-check URL Inspection.
2. **Favicons and the share image are missing.** `src/app/layout.tsx` references `/favicon.ico`,
   `/favicon-16x16.png`, `/favicon-32x32.png`, `/apple-touch-icon.png` and `/og-image.png`, none of
   which exist in `public/` (the first three 404 in Lighthouse). Add real brand assets, then pass the
   logo path to `buildOrganization` and an image to `openGraphFor`.
3. **Real 410 for gone offers** (Phase 3): replace the 404 described under "Expired offers".
4. **Unknown `/category/[slug]` answers HTTP 200** with the 404 page (the root `loading.tsx` streams
   the shell first; confirmed with `curl -I /category/nope` on the production build, which answers
   200; see `freejoy-frontend.md`). Fix by scoping or removing that boundary.
5. **Re-run Lighthouse** once the catalogue is API-backed; the SEO score is capped by the deliberate
   noindex today. Numbers so far: `docs/evidence/phase3/lighthouse.md`.
6. Decide whether thin categories (no live offers) should stay indexable.
