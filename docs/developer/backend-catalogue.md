# Public catalogue API

Internal-key-only read endpoints that let the Next.js server render real published offers without a visitor
session. Code: `app/api/v1/catalogue.py` (routes), `app/api/v1/catalogue_schemas.py` (public response models),
`app/services/catalogue.py` (`CatalogueService`), `app/repositories/catalogue.py` (`CatalogueRepository`). Tables:
[platform-models.md](platform-models.md).

## Contract

| | |
|---|---|
| Auth | `X-Internal-Key` only (the browser never calls FastAPI). No user session; 401 without the key. |
| Rate limit | `PUBLIC_CATALOGUE_POLICY`: 120 requests per 60 s per client IP (`X-Client-IP`). Fails open; 429 with `Retry-After`. |
| Envelope | `{"success": true, "data": ...}` on success, `{"success": false, "error": "..."}` on error (422 is `"Invalid request"`). |
| Cache | `Cache-Control: private, max-age=60` plus a content-hash `ETag` on list, detail and categories (also on the 410). 304 with an empty body when `If-None-Match` matches. 401, 404, 422, 429 and 500 carry no cache header. |

### `GET /v1/catalogue/offers`

Published, non-expired offers with the total before paging.

| Parameter | Rule |
|---|---|
| `q` | Up to 100 characters. Case-insensitive match on title, summary or merchant name. `%`, `_` and `\` are matched literally (escaped before the `ILIKE`). Blank is ignored. |
| `category` | Category slug, up to 100 characters. An unknown or disabled category gives an empty list, not an error. |
| `type` | `free_sample`, `free_trial`, `cashback`, `voucher`, `competition`. May repeat (any of). Anything else is 422. |
| `postage` | `free` keeps only offers with no postage. Anything else is 422. |
| `featured` | `true` only featured, `false` only the rest, absent both. |
| `sort` | `newest` (default: start date, falling back to creation, newest first), `ending_soon` (soonest end date first, open-ended last), `a_z` (title). Ties break on the id, so paging is stable. |
| `limit` | 1 to 50, default 12. |
| `offset` | 0 to 10000, default 0. An offset past the end gives an empty `items` and the real `total`. |

```json
{"success": true, "data": {"items": [ <offer> ], "total": 31, "limit": 12, "offset": 0}}
```

### `GET /v1/catalogue/offers/{slug}`

- **200** the offer (`{"success": true, "data": <offer>}`).
- **404** `{"success": false, "error": "Offer not found"}` for an unknown slug **and** for a `DRAFT` or `ARCHIVED`
  offer, with an identical body, so a visitor cannot probe for unpublished content.
- **410 Gone** for an offer that has ended: published with an `end_at` in the past, or marked `EXPIRED` by an editor.

### `GET /v1/catalogue/categories`

Enabled categories in display order (`sort_order`, then name), each with `offer_count`, the number of live offers
(the same rule as the list, so a count always matches what `GET /offers?category=` returns). A category with no live
offers is returned with `0`.

## Decision: how an expired offer is answered

The detail route answers **HTTP 410 Gone** with the error envelope extended by `expired: true` and a small stub:

```json
{
  "success": false,
  "error": "This offer has ended",
  "expired": true,
  "data": {"slug": "...", "title": "...", "category": {"slug": "...", "name": "..."}, "ended_at": "2026-05-31T23:59:00Z"}
}
```

Why a real 410 and not a 200 flag: a crawler and a CDN learn that the page is gone for good, and the frontend treats it
as a distinct, typed outcome (the generated client types the 410 body as `ReadOfferErrors[410]`). Why a stub and not 404:
an ended offer page is still useful ("this offer has ended, see similar offers in Category"), and it was public before.
The stub carries only the slug, title, category and end date, never the offer details (eligibility, steps, terms), so
an expired offer stops advertising its terms. `ended_at` is `null` for an offer an editor marked `EXPIRED` with no end
date. The 410 is cacheable like the 200.

## The expiry rule

`CatalogueService.is_live`: `status == PUBLISHED and (end_at is null or end_at > now)`. `now` comes from the service
clock (UTC), is passed to the repository, and the same rule is applied in SQL by `live_conditions`; the e2e tests prove
both agree. `start_at` is not a filter: an editor who publishes an offer with a future start date has chosen to show it.
`DRAFT`, `ARCHIVED` and (for list and counts) `EXPIRED` offers never appear in lists or counts.

## Visibility beyond status

An offer whose **category is disabled** or whose **merchant is inactive** is hidden everywhere (list, detail 404,
category counts), because the public pages name both and a disabled category is not browsable. Enable the category or
reactivate the merchant to show its offers again.

## What is public

The offer shape is the allowlist `OfferData` in `app/api/v1/catalogue_schemas.py`: `id` (needed for the later `/go/[id]`
redirect), `slug`, `title`, `summary`, `description` paragraphs, `category {slug, name}`, `merchant {slug, name,
logo_url}`, `offer_type`, `featured`, `image {tint, label, alt}`, `postage {kind, amount_minor, currency}`,
`requires_card`, `subscription_terms`, `eligibility`, `availability`, `start_at`, `end_at`, `last_verified_at`,
`freshness`, `steps`. Enum values are lower-case, as in `nextjs-frontend/src/lib/catalogue/types.ts`; the database
stores the upper-case names.

Never exposed: `publisher_notes`, `status`, category and merchant ids, `source_url`, timestamps other than the ones
above, and anything from `affiliate_links` (destinations are resolved server-side by the later redirect story). The
repository selects an explicit column list, so those columns never leave the database layer, and the response models
are a second, independent allowlist. To expose another field, add it to `OfferRecord`, the select list, `OfferData` and
the allowlist test together.

## Tests

- `tests/services/test_catalogue.py`: the expiry rule matrix and what each status becomes.
- `tests/repositories/test_catalogue.py`: the SQL built through `FakeSessionProvider`: bound parameters, `ILIKE`
  escaping, limit clamping, sort orders, live and visibility conditions, no editorial columns selected.
- `tests/api/test_catalogue.py`: routes over a fake repository: envelope, empty list, 404, 410, 422 for every invalid
  parameter, ETag/304, 401, 429, rate-limit key, 500, and the privacy allowlist tests.
- `tests/api/test_catalogue_e2e.py`: real Postgres (`TEST_DATABASE_URL`, see [testing.md](testing.md)): visibility,
  every filter, sorts, paging, search escaping, detail 200/404/410, category counts, and that notes and links never
  appear in a response.

## Consumers

The Next.js wrappers belong to a later story. Call the generated SDK (`listOffers`, `readOffer`, `listCategories`)
only through `src/lib/api/` and `callBackend`. The 120/min limit is keyed by the forwarded client IP, so forward the
visitor's address in `X-Client-IP`; a server-side call without it shares one bucket.
