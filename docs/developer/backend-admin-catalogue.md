# Backend admin catalogue API

Server-authorised create, edit and publish actions for the Freejoy catalogue (categories, merchants, offers,
affiliate links). Authorisation is `require_admin(<permission>)` and the audit trail is `AdminAuditor`
(see [backend-auth.md](backend-auth.md), [backend-audit-logs.md](backend-audit-logs.md) and
[platform-models.md](platform-models.md)). The browser never calls these routes: the Next.js server does, behind
the internal service key and the admin's session.

Code: routers `app/api/v1/admin_offers.py`, `admin_categories.py`, `admin_merchants.py` (schemas in
`admin_offers_schemas.py`, shared pieces in `admin_catalogue_common.py`); services `app/services/admin_offers.py`,
`admin_categories.py`, `admin_merchants.py`, `offer_lifecycle.py`, `offer_rules.py`; repositories
`app/repositories/admin_offers.py`, `admin_categories.py`, `admin_merchants.py`; URL rules
`app/core/catalogue_urls.py`; slugs `app/core/slugs.py`. The public read API is a separate story.

## Permissions

`ADMIN_PERMISSIONS` (`app/core/permissions.py`) is a closed registry. These six were added; nothing in a request can
widen a grant, and `assert_can_grant` refuses to hand out a permission the granting admin does not hold, so an
editor cannot give themselves or anyone else `offers.publish`.

| Permission | Allows |
| --- | --- |
| `offers.read` | List and read offers, categories and merchants (the offer editor needs the pick lists) |
| `offers.write` | Create and edit offers, create and edit affiliate links |
| `offers.publish` | Publish, unpublish, expire, archive and verify an offer (they change what the public sees or the "Last checked" claim) |
| `categories.write` | Create, edit, enable and disable categories |
| `merchants.write` | Create, edit, activate and deactivate merchants |
| `subscribers.read` | Registered only. No subscriber endpoint exists yet; the later subscriber story uses it |

A request without the permission is 403 with the generic `Forbidden` body, before the body is validated and before
any service runs. An unauthenticated request is 401.

## Routes

All responses are `{"success": true, "data": ...}` with `Cache-Control: no-store`; errors use the standard envelope
plus a stable `code` (below). Lists take `limit` (1 to 100) and `offset`.

| Route | Permission | Notes |
| --- | --- | --- |
| `GET /v1/admin/offers` | `offers.read` | `search` (title, slug, summary; `%` and `_` are literal), `status`, `category_id`, newest update first |
| `POST /v1/admin/offers` | `offers.write` | 201. Always creates a `DRAFT`. `slug` optional |
| `GET /v1/admin/offers/{id}` | `offers.read` | Offer with its affiliate links (admin view: includes `destination_url` and `publisher_notes`) |
| `PATCH /v1/admin/offers/{id}` | `offers.write` | Partial. The slug and the status cannot be changed; nullable fields clear with `null` |
| `POST /v1/admin/offers/{id}/publish` | `offers.publish` | See the publish rules |
| `POST /v1/admin/offers/{id}/unpublish` | `offers.publish` | `PUBLISHED` to `DRAFT` |
| `POST /v1/admin/offers/{id}/expire` | `offers.publish` | `PUBLISHED` to `EXPIRED` |
| `POST /v1/admin/offers/{id}/archive` | `offers.publish` | Terminal |
| `POST /v1/admin/offers/{id}/verify` | `offers.publish` | Sets `last_verified_at` to now. Optional body `{"note"}` (audit only) |
| `POST /v1/admin/offers/{id}/links` | `offers.write` | 201. `provider`, `destination_url`, `tracking_id?`, `active?` |
| `PATCH /v1/admin/offers/{id}/links/{link_id}` | `offers.write` | Links are deactivated, never deleted (click counts keep their link) |
| `GET /v1/admin/categories`, `GET .../{id}` | `offers.read` | `search`, `enabled` |
| `POST /v1/admin/categories`, `PATCH .../{id}` | `categories.write` | 201 on create. Slug from `name` unless supplied |
| `POST /v1/admin/categories/{id}/enable`, `/disable` | `categories.write` | |
| `GET /v1/admin/merchants`, `GET .../{id}` | `offers.read` | `search`, `active` |
| `POST /v1/admin/merchants`, `PATCH .../{id}` | `merchants.write` | 201 on create. `website` and `logo_url` must be https |
| `POST /v1/admin/merchants/{id}/activate`, `/deactivate` | `merchants.write` | |

Affiliate link routes are not in the original story text; they exist because the publish rule needs an "active
affiliate link" and nothing else could create one.

## Status table

Rows are the current status, columns the action. `-` is refused with **409 `illegal_transition`** and nothing is
written. `verify` never changes the status.

| Current | publish | unpublish | expire | archive | verify |
| --- | --- | --- | --- | --- | --- |
| `DRAFT` | `PUBLISHED` | - | - | `ARCHIVED` | stays `DRAFT` |
| `PUBLISHED` | - | `DRAFT` | `EXPIRED` | `ARCHIVED` | stays `PUBLISHED` |
| `EXPIRED` | `PUBLISHED` | - | - | `ARCHIVED` | stays `EXPIRED` |
| `ARCHIVED` | - | - | - | - | - |

`ARCHIVED` is terminal: an archived offer cannot be edited, verified or given links (409). There is no unarchive
route; restoring one is a database operation for now. The table is code (`TRANSITIONS` in
`app/services/offer_lifecycle.py`) and is pinned by a test.

## Publish rules

Publishing (and re-publishing an `EXPIRED` offer) needs all of:

1. the category is enabled,
2. the merchant is active,
3. at least one active affiliate link, or a `source_url`,
4. `end_at` is null or in the future,
5. `last_verified_at` is set.

If any fails the answer is **422 `publish_blocked`** and the message lists every unmet rule in fixed words.

**Decision: publish rejects, it does not auto-verify.** "Last checked" is a public claim, so stamping it as a side
effect of publishing would let an unchecked offer look checked. The editor calls `verify` (which records who and when
in the audit trail, with the optional note) and then `publish`. The database CHECK `ck_offers_published_is_verified`
is the backstop. There is no staleness window: an old `last_verified_at` still publishes. Add one if the
compliance review asks for it.

A published offer must keep meeting rules 1 to 5 at write time: a `PATCH` that would set a past `end_at`, remove the
last destination or point it at a disabled category or inactive merchant is refused (422 `publish_blocked`), and so
is deactivating the last active link of a published offer without a `source_url`. Disabling a category or
deactivating a merchant does **not** unpublish its offers; the public read API must hide offers whose category is
disabled or merchant inactive.

## Slugs

`app/core/slugs.py`: `slugify` folds accents, turns every other run of characters into one hyphen and cuts at 80
characters on a word edge; `validate_catalogue_slug` accepts lower-case ASCII, digits and single hyphens, 2 to 80
characters. A slug is derived from the title or name unless the request supplies `slug`. It cannot be changed
afterwards (public URLs depend on it). A taken slug is **409 `slug_taken`**: the service checks first and a unique
violation under a race maps to the same answer. A generated slug is never suffixed silently; send an explicit `slug`
to resolve a clash.

## URLs

`app/core/catalogue_urls.py`, applied in the services on every write to `source_url`, `destination_url`, merchant
`website` and `logo_url`: https only; ASCII only (punycode hosts); at most 2048 characters; no whitespace, control or
format characters, no backslash and no percent-encoded control character; no user info (`https://good@evil`); no
IPv6 literal; port 443 or none; the host is a DNS name with at least two labels whose last label is not all digits
(so `127.0.0.1`, `2130706433` and `localhost` fail). The scheme and host are lower-cased. Anything else is
**422 `invalid_url`**. Open-redirect style inputs are covered in `tests/core/test_catalogue_urls.py` and the e2e
suite.

## Errors

| Status | `code` | When |
| --- | --- | --- |
| 401 | | No valid session |
| 403 | | Not an admin, or the permission is missing (body is just `Forbidden`) |
| 404 | `not_found` | Unknown offer, link, category or merchant |
| 409 | `slug_taken` | The slug exists |
| 409 | `illegal_transition` | The status table refuses the action, or the offer is archived and edited |
| 422 | `publish_blocked` | A publish rule is unmet |
| 422 | `invalid_url`, `invalid_slug`, `invalid_postage`, `invalid_window`, `unknown_category`, `unknown_merchant` | A value the service rejects |
| 422 | none | Schema validation (`Invalid request`): unknown fields, wrong types, control characters, lengths |

`postage_amount_minor` and `postage_currency` (3 upper-case letters) are present exactly when `postage_kind` is
`COST`; `end_at` must be after `start_at`; timestamps must carry a timezone.

## Audit

Every write stages one `audit_logs` row on the request's session and commits once after `record`, so the change and
its audit row commit or roll back together (a test makes the audit write fail and checks the offer is not stored).
Actions: `admin.offers.create|update|publish|unpublish|expire|archive|verify`, `admin.offer_links.create|update`,
`admin.categories.create|update|enable|disable`, `admin.merchants.create|update|activate|deactivate` (resources
`offers`, `affiliate_links`, `categories`, `merchants`). Rows hold ids, enums, flags and dates (`before` and `after`),
and the names of changed free-text fields, never their content. Link rows record the destination **host** only (the
path and query can carry tracking ids), never the URL or `tracking_id`. The `verify` note is stored in `details`. No
subscriber data is written. Enabling a category that is already enabled (and the merchant equivalent) is a no-op that
writes nothing and stages no audit row. Denied requests write no row.

## Tests

- `tests/core/test_catalogue_urls.py`: URL and slug rules.
- `tests/services/test_offer_lifecycle.py`, `test_admin_offers.py`, `test_admin_categories_merchants.py`: rules
  with in-memory fakes (`tests/fakes_admin_catalogue.py`).
- `tests/api/test_admin_catalogue.py`: every route for 401, 403 (no record, missing permission, read-only) and the
  error mapping, with fakes behind the real dependency chain.
- `tests/api/test_admin_catalogue_e2e.py`, `test_admin_categories_merchants_e2e.py`: real Postgres through the
  Alembic migrations (helpers in `tests/catalogue_e2e_support.py`); they run only with `TEST_DATABASE_URL`.
