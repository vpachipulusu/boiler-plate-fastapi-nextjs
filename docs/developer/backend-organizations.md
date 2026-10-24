# Backend: organisations

Authenticated routes in `fastapi_backend` to create, list and update organisations. Every route needs
`X-Internal-Key`, a verified session (`X-Session-Token`, verified email) and is rate limited by subject
(`API_POLICY`). Responses use `{"success": true, "data": ...}` with `Cache-Control: no-store`; errors use the usual
`{"success": false, "error": "..."}` envelope. Code: `app/api/v1/organizations.py`, `app/services/organizations.py`,
`app/repositories/organizations.py`, `app/core/slugs.py`.

## Routes

| Method and path | Who | Purpose |
| --- | --- | --- |
| `GET /v1/organizations` | any caller | **The caller's own organisations only**, each with their `role`; paginated (`limit` 1 to 100, `offset`) |
| `POST /v1/organizations` | any caller | Create an organisation; the caller becomes its `OWNER` in the same transaction (201) |
| `GET /v1/organizations/{id}` | member | One organisation with the caller's role |
| `PATCH /v1/organizations/{id}` | name: OWNER or ADMIN; slug: OWNER | Rename and/or change the slug (at least one field) |

Roles are `OWNER`, `ADMIN`, `STAFF` (`memberships` table). A non-member gets **404**, not 403, so the id space
leaks nothing; a member without the right role gets **403**.

## Rules

- **Name:** 1 to 100 characters after trimming, no control characters (422 otherwise).
- **Slug:** ASCII only, lower-cased, 3 to 63 characters of `a-z`, `0-9` and single hyphens, no hyphen at either
  end, no consecutive hyphens (`xn--` is therefore impossible). Reserved names (`www`, `admin`, `api`, `app`,
  `billing`, `pricing`, `dashboard`, `support`, ... in `RESERVED_SLUGS`) are refused with 422. A slug that another
  organisation already has is **409** `Slug is already taken` (unique index; the race is caught on the
  `IntegrityError`).
- **Ownership limit:** a user may own at most 10 organisations; the eleventh `POST` is **409**
  `Organization limit reached`.
- Only an `OWNER` changes the slug, because the slug is the organisation's public identity.
- Every create and update writes an `audit_logs` row (`org.create`, `org.update` with
  before/after name and slug), carrying the request id.

## Frontend

The frontend reads `GET /v1/organizations` for billing (`src/lib/api/billing.ts` picks the organisation the
user owns or administers). It ships no page to create or rename an organisation yet: call `POST /v1/organizations`
from a server action, or create an organisation for each new user on first sign-in, whichever fits your product.

## Tests

- `tests/api/test_organizations_e2e.py` runs against Postgres (`TEST_DATABASE_URL`): slug uniqueness under a
  real unique index, membership rows, the ownership limit, audit rows.
