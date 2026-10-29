# Freejoy affiliate redirect (`/go/[offerId]`)

Every public call to action on a real offer links to `/go/<offerId>` on Freejoy, never straight to the brand. The
route records one privacy-preserving click and redirects to the destination stored on the offer's affiliate link.
Code: `src/app/go/[offerId]/route.ts`, `src/lib/outbound/` (decision and checks), `src/lib/api/outbound.ts` (backend
call), `app/api/v1/catalogue_click.py`, `app/services/outbound_clicks.py`, `app/core/affiliate_hosts.py`. The
affiliate-disclosure copy and the compliance rules behind it are in
[`../compliance/uk-affiliate-checklist.md`](../compliance/uk-affiliate-checklist.md) (A1, A2, A5).

## The flow

```
visitor clicks <a href="/go/<id>" rel="sponsored nofollow noopener">
  -> proxy.ts                        rate limit (general policy), security headers
  -> GET /go/[offerId]               Next.js route handler (server only)
       validate the id; ignore every query parameter
       POST /v1/catalogue/offers/{id}/click   (X-Internal-Key, no session)
            offer public?  active link?  destination valid and on an allowed host?
            -> insert ONE click_events row, commit, return the destination
       re-check the destination is https; build the Location from a URL object
  <- 307  Location: <destination>   Cache-Control: no-store   Referrer-Policy: strict-origin-when-cross-origin
```

The browser never calls FastAPI. The destination is never in a page, a script or a query string: it exists only in
the `affiliate_links` row, the backend response to the Next.js server, and the `Location` header.

## Responses

| Outcome | `/go/<id>` answers | Backend answer | Click row |
|---|---|---|---|
| Live offer, usable link | `307` to the destination | `200 {"success": true, "data": {"destination_url": ...}}` | one |
| Offer that was public and has ended | `302` to `/freebies/<slug>?ended=1` | `410` with `expired: true` and the slug (same body as `GET /v1/catalogue/offers/{slug}`) | none |
| Unknown, draft, archived, never-live, hidden category or inactive merchant | `404` | `404 Offer not found` (one identical body) | none |
| Live offer with no usable link (none active, bad URL, host not allowed) | `404` | the same `404 Offer not found` | none |
| Malformed id | `404`, backend not called | `422` if called | none |
| Rate limited | `429` with `Retry-After` | `429` | none |
| Backend down, key missing, bad response | `503` plain text, no backend text | any other status | none |
| Speculative load (`Sec-Purpose: prefetch`) | `204` | not called | none |
| `HEAD` | `405` | not called | none |

Every response is `Cache-Control: no-store`. "Public" is decided by `CatalogueService` (`get_offer_by_id`), the same
code and the same published, not-ended, enabled-category, active-merchant rule as the public catalogue API
([backend-catalogue.md](backend-catalogue.md)), so the redirect can never follow an offer the site would not show.
`/go/` is disallowed in `robots.txt` and not in the sitemap.

## Validation rules

Applied twice, in the backend and again in the route, so a bug in one layer is not an open redirect.

1. **Only the path id counts.** It must match `^[A-Za-z0-9_-]{1,64}$`. `?url=`, `?to=`, `?redirect=`, `//evil.com`
   and every other query parameter are never read. No header, cookie or body chooses the destination.
2. **The stored URL is re-validated** with `validate_https_url` (`app/core/catalogue_urls.py`): at most 2048 ASCII
   characters; no whitespace, control or format characters, backslash or percent-encoded control character (no CRLF
   header splitting); scheme exactly `https` (so `javascript:`, `data:`, `http:` and `//host` fail); an authority is
   required (`https:host` fails); no user info (`https://good.com@evil.com` fails); no IPv6 literal; port 443 only;
   a DNS name with at least two labels whose last label is not a number (no IPv4 in any spelling, no `localhost`).
3. **The host must be allowed for the link's provider** (next section). A link that fails is skipped; the oldest
   active link that passes is used; if none passes the answer is the 404.
4. **The route repeats the https check** (`parseHttpsDestination`): a clean absolute `https:` URL with a host, no
   user info, default port, none of the forbidden characters. The `Location` is built from the resulting `URL`
   object, never by string concatenation. The ended-offer redirect uses a slug checked against the slug pattern and
   a cloned `nextUrl`, so it can only be `/freebies/<slug>?ended=1`.

The backend logs a link id and a reason code for a refused link, never the destination. The route logs the offer id
only. Neither logs query strings, headers or request bodies.

## What a click stores, and what it does not

`click_events` has exactly these columns (a test asserts it against the live schema):

| Column | Content |
|---|---|
| `id` | generated id |
| `offer_id` | the offer |
| `affiliate_link_id` | the link followed (set to null if the link is deleted) |
| `occurred_at` | the time **truncated to the minute** by the database default, so it cannot be joined to an access-log line |
| `referrer_host` | the host name of the `Referer` header only (for example `www.google.co.uk`); no path, query, port or credentials. Checked again in the backend: anything that is not a DNS name (or is an IP address) becomes null |
| `user_agent_class` | `DESKTOP`, `MOBILE`, `TABLET`, `BOT` or `OTHER`, computed in the route from the `User-Agent` header. The raw user agent is never sent to the backend |

**Not stored, anywhere:** IP address, cookie or device id, user id, session id, email, raw user agent, full referrer
URL, query string, destination URL. The client address reaches the backend only as `X-Client-IP` for the rate limit
(from `x-vercel-forwarded-for` on Vercel and nowhere else; see `getBackendClient`), and the rate limiter keeps a
counter, not a click. The backend request body accepts only `referrer_host` and `user_agent_class`
(`extra="forbid"`), so a caller cannot add more.

## No cookie

The route handler sets no cookie, reads no identifier from the device and writes no storage. The backend click
response sets none either. This is tested at three levels: the route unit test checks `Set-Cookie` is absent for
every outcome, the backend tests check the same, and the Playwright spec checks the browser's cookie jar is empty
after a click. A visitor's own cookies are not forwarded to the backend (`withSession: false`).

## Clicks are not conversions

A `click_events` row means "a visitor was sent to a provider through Freejoy". It is not a sale, a sign-up, a
claim, an approved commission or proof the visitor qualified. Bots, double clicks and visitors who abandon the
provider page all count as clicks, and nothing here deduplicates them. The provider's network reports are the only
source for conversions and commission. Do not present click counts as "claimed" or "redeemed" numbers anywhere.

## Provider host allowlist

`app/core/affiliate_hosts.py` decides which hosts a link may point to, from the link's `provider` text (the admin
API only allows `^[a-z0-9][a-z0-9_-]{0,39}$`). A host matches an entry when it is that host or a subdomain of it
(`www.awin1.com` matches `awin1.com`; `awin1.com.evil.example` does not).

| Provider | Allowed hosts |
|---|---|
| `awin` | `awin1.com` |
| `cj` | `anrdoezrs.net`, `dpbolvw.net`, `jdoqocy.com`, `kqzyfj.com`, `tkqlhce.com` |
| `partnerize` | `prf.hn` |
| `rakuten` | `linksynergy.com` |
| `tradedoubler` | `tradedoubler.com` |
| `direct` | the host of the **merchant's stored website** (or a subdomain; a leading `www.` is ignored). A merchant with no website cannot have a `direct` link followed |
| `sample` | `example.com`, and only when `ENVIRONMENT` is `local`/`test` or Vercel is `preview`/`development` (what `commands.seed_catalogue` writes) |
| anything else | never followed |

The hosts above are the networks' tracking domains as commonly used; **confirm each against the network's own
documentation or your account before relying on it** (they are unverified here). Networks that use a vanity domain
per publisher (for example Impact) are deliberately not listed: add the exact domain you were given.

**Add a provider:**

1. Get the exact tracking host(s) from the network (not a guess, not a wildcard for a shared domain).
2. Add an entry to `PROVIDER_HOSTS` in `app/core/affiliate_hosts.py` and a row to the table above. This is a code
   change, reviewed in a pull request, on purpose: the allowlist is the control that keeps `/go/` from being an open
   redirect if an admin account or a database row is ever wrong.
3. Add a test in `tests/core/test_affiliate_hosts.py` (the parametrised test covers every registered provider
   automatically) and, for a real link shape, a case in `tests/services/test_outbound_clicks.py`.
4. Create the affiliate link in the admin with `provider` set to the new key. The admin API validates the URL shape
   when it is saved, and the redirect checks the host every time it is followed.

The admin API does not check the host against the provider at save time (it cannot tell a typo from a new network);
a link with a host that is not allowed saves fine and simply is not followed (the offer's `/go/` answers 404 and the
backend logs `affiliate link <id> refused: host not allowed`). Watch for that log line after adding links.

## Rate limits

- `src/proxy.ts` rate limits every `/go/*` request with the general policy (200 per minute per client, in-memory,
  keyed by `x-vercel-forwarded-for` on Vercel and one shared bucket elsewhere). `/api/*` rules are unchanged.
- The backend limits `POST .../click` with `OUTBOUND_CLICK_POLICY` (60 per minute per forwarded client IP, fails
  open like the other public catalogue routes).

## Running and testing it locally

Unit tests: `npm run test:unit` (route, wrapper, validation, CTA, proxy) and `uv run pytest` in the backend. The
`*_e2e.py` tests (`tests/api/test_catalogue_click_e2e.py`) need `TEST_DATABASE_URL`: they prove one row per
successful click, no row for any refusal, the column set, hostile stored destinations and the allowlist.

Playwright (`src/__tests__/e2e/go-redirect.spec.ts`) needs a production build, a running backend with seeded data and
the offer ids, so it skips unless they are set:

```bash
# backend (fastapi_backend/), against a local *_test or dev database you own
uv run alembic upgrade head && uv run python -m commands.seed_catalogue
uv run uvicorn app.main:app --port 8172 --no-access-log        # ENVIRONMENT=local, BACKEND_INTERNAL_KEY set
# ids: a live offer, an ended one (status EXPIRED), a draft
psql ... -c "select id, slug, status from offers where slug in ('coffee-discovery-pack','laundry-sheets-sample','cat-pouch-tasting-sample')"

# frontend (nextjs-frontend/)
npm run build && BACKEND_API_URL=http://127.0.0.1:8172 BACKEND_INTERNAL_KEY=<same key> npx next start -p 3190
GO_E2E_LIVE_OFFER_ID=<id> GO_E2E_ENDED_OFFER_ID=<id> GO_E2E_DRAFT_OFFER_ID=<id> \
  E2E_BASE_URL=http://localhost:3190 npm run test:e2e:go
```

`test:e2e:go` uses `playwright.go.config.ts`: chromium only, no login project and no web server.
`npm run test:e2e:local -- src/__tests__/e2e/go-redirect.spec.ts` also works if the ids are exported, but it runs the auth
setup project first and therefore needs `.env.e2e.local` ([local-e2e.md](local-e2e.md)).

## Known limits and follow-ups

- Fixture (demo) offers keep the "Demo offer" dialog: their ids have no row, so `/go/` would answer 404. The CTA
  switches to the link when a page passes `offerId` (`OfferHero` does so for `demo: false` offers).
- The "Ad" label and the sentence "Freejoy is paid a commission by the brand if you take up this offer through this
  link." are from the compliance checklist and still need the reviewer's sign-off on wording. Offer cards do not
  carry the label yet (checklist A1.3).
- The `Referrer-Policy` of the redirect is `strict-origin-when-cross-origin` (the story); checklist A5.3 says
  `no-referrer`. Networks usually want the origin; decide with the compliance reviewer.
- Each valid request writes a row; nothing deduplicates repeated clicks, and old rows are not pruned. Decide a
  retention period before launch.
