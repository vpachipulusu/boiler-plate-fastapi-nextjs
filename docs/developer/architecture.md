# Architecture

Every design decision is recorded in [docs/adr](../adr/README.md).

## Monorepo layout

```
<repo>/
├── nextjs-frontend/     Next.js 16 app (App Router). Vercel service nextjs-frontend (public).
├── fastapi_backend/     FastAPI service (uv). Vercel service fastapi_backend (internal, entrypoint app.main:app).
├── docs/adr/            Architecture decision records.
├── docs/developer/      This documentation.
├── vercel.json          One Vercel project with the two services above (ADR-011).
└── .claude/             Agent instructions and the git guard hook.
```

Key folders:

- `nextjs-frontend/src/`: `app/` (route groups `(admin)`, `(auth)`, plus `actions/`, `api/`, `dashboard/`, `pricing/`), `components/`, `lib/` (`api/`, `auth/`, `firebase/`, `middleware/`, `stripe/`), `config/`, `hooks/`, `proxy.ts`, `__tests__/` (`unit/`, `e2e/`).
- `fastapi_backend/`: `app/` (layered, below), `commands/` (OpenAPI generation and check), `alembic_migrations/`, `tests/`.

## The two apps, one direction

```
Browser
   |  pages, server actions, route handlers (only Next.js is reachable)
   v
Next.js server  (nextjs-frontend)
   |  X-Internal-Key + X-Session-Token            (ADR-003)
   v
FastAPI  (fastapi_backend)
   |  SQLAlchemy 2 async, NullPool
   v
Platform Postgres
```

- The browser calls only the Next.js server. The backend allows no browser origins ([ADR-003](../adr/0003-nextjs-to-fastapi-authentication.md)).
- The frontend holds no database credentials and no server secrets beyond the Firebase Admin credentials and the internal key.
- Responses use the envelope `{ success, data?, error? }` ([ADR-008](../adr/0008-api-client-generation.md)).

### Request flow

1. The browser sends a request to Next.js: a page load, a server action POST, or a route handler call.
2. The Next.js server reads the `session` cookie and calls FastAPI through the generated typed client ([ADR-008](../adr/0008-api-client-generation.md)) via `callBackend` (`src/lib/api/server.ts`). It sends `X-Internal-Key` (proves the caller is our Next.js server) and `X-Session-Token` (the forwarded Firebase session cookie, which proves the user).
3. FastAPI checks the service key first, before any other work. It then verifies the Firebase session, including revocation, and resolves the user and, where needed, their organisation membership. The layering follows [ADR-004](../adr/0004-backend-layering.md).
4. FastAPI returns the envelope. Next.js renders the page or returns the action result. The browser never sees FastAPI.

### Auth flow

1. The Firebase client SDK signs the user in and sends the ID token to the `verifyTokenAction` server action (`src/app/actions/auth-actions.ts`).
2. `verifyTokenAction` calls `POST /v1/auth/session`; the backend verifies the token with Firebase Admin, syncs the user row, records login history and returns the session cookie value (5 days). The action sets it as the httpOnly `session` cookie and returns `claimsEmailVerified` from the verified token.
   2a. `refreshSessionAction` (Firebase token refresh, `/verify-email`) calls `POST /v1/auth/session/refresh` through `refreshBackendSession` (`src/lib/api/account.ts`): the API needs the current session and a same-UID ID token, issues the new cookie and records no login history. If the API refuses (for example a revoked or mismatched session), the action deletes the `session` cookie and returns `data.signInRequired`; `useSessionRefresh` then signs out of Firebase and goes to `/login`. An outage or rate limit keeps the current cookie and the next refresh retries.
3. `src/proxy.ts` (the Next.js 16 proxy; the exported function is `proxy`) only checks that a credential exists. The protected pages (`/dashboard`, `/settings`, `/profile`, `/security`) and `/admin` need a `session` cookie; `/api/*` (except `/api/health`) needs a `session` cookie or any `Bearer` header. It does not verify either value: the edge cannot verify Firebase tokens.
   3a. Email verification is enforced server-side, from the signed `email_verified` claim in the session cookie, by `src/lib/auth/verified-session.ts` (`verifyVerifiedSessionCookie` always checks revocation; `getVerifiedUserId` is for server actions). The dashboard and admin layouts, the dashboard page, the user, notification and subscription actions and the admin actions all go through it. An unverified user is sent to `/verify-email` (pages) or gets `Unauthorized` (actions). The verify-email page re-mints the session cookie once Firebase reports the email verified.
4. The admin role is verified server-side: the admin layout (`src/app/(admin)/admin/layout.tsx`) and each admin server action (`src/app/actions/admin/*`) verify the session and check the admin grant through the backend.
5. Vercel service bindings such as `BACKEND_API_URL` are not available in the proxy ([ADR-011](../adr/0011-single-vercel-project-with-services.md)).

Details: [backend-auth.md](backend-auth.md), [backend-totp.md](backend-totp.md).

## Backend layout (ADR-004)

```
fastapi_backend/app/
├── main.py              create_app(): request ID and error envelope, JSON logging, Sentry, mounts the v1 router; `app` is the entrypoint
├── core/                config (pydantic-settings), base (declarative Base), database (NullPool engine, SessionProvider),
│                        logging, errors, request_id, rate_limit, permissions, plans, firebase, ids, platform_schema, stripe_* (module)
├── api/
│   ├── deps.py          FastAPI dependencies: get_session_provider, get_session, service factories
│   ├── auth.py          require_internal_key, current user and verified-session dependencies
│   ├── rate_limit.py    limit_by_subject / limit_by_ip dependencies over core.rate_limit policies
│   └── v1/              routers: health, auth, me, me_export, notifications, totp, organizations, settings,
│                        admin_users, admin_audit_logs, admin_analytics; billing module: webhooks, admin_subscriptions, org_billing
├── services/            business logic and transaction boundaries, no FastAPI imports
├── repositories/        SQLAlchemy queries, one aggregate each; receive an AsyncSession, never create one
└── models/platform/     SQLAlchemy models (see platform-models.md)
```

Import direction is one way: routers may import services, schemas and `core`; services may import repositories and
`core`; repositories may import `core` and models only.

**Session seam.** Repositories take an `AsyncSession` in their constructor. The session comes from a `SessionProvider`
(a `Protocol` in `core/database.py` with `session()`, an async context manager). `api/deps.get_session_provider()`
returns the default provider (the platform database, NullPool). Tests override that one dependency with a fake
provider (`tests/fakes.py`).

**Alembic.** One baseline revision `0001`; `env.py` connects with `DATABASE_URL_DIRECT` when set, else `DATABASE_URL`.
No deploy or build step runs `alembic upgrade head` (ADR-011); the backend workflow runs upgrade, `alembic check`
and downgrade against a throwaway Postgres 17 service container. See [platform-models.md](platform-models.md).

**OpenAPI.** `commands/generate_openapi_schema.py` writes `nextjs-frontend/openapi.json`; `npm run generate:client`
produces `src/lib/api/generated/`; `commands/check_openapi_schema.py` and `npm run check:client` fail when either is
stale (pre-commit and CI).

## Feature areas

- **Accounts** (`src/app/dashboard/`): overview, `profile`, `settings`, `security` (password, 2FA, login history,
  data export, account deletion). Backend: `/v1/me`, `/v1/me/export`, `/v1/notifications`, `/v1/totp`.
- **Organisations**: `/v1/organizations` with memberships and roles ([backend-organizations.md](backend-organizations.md)).
  The frontend reads them for billing; it ships no organisation management page.
- **Admin portal** (`src/app/(admin)/admin/`): `users`, `audit-logs`, `settings` (general, theme, feature flags),
  `seo` (placeholder), and with the billing module `subscriptions` and `analytics`. An admin needs an admin grant in
  the backend (`POST /v1/admin/users/{user_id}/admin`). Admin actions are written to the audit log.
- **Billing module** (`src/app/actions/subscription-actions.ts`): `createCheckoutSessionAction` starts a Stripe
  Checkout session, the backend webhook (`POST /webhooks/stripe`, [backend-billing-webhook.md](backend-billing-webhook.md))
  updates the organisation's subscription, `createBillingPortalSessionAction` opens the billing portal. The pricing page
  adapts its call-to-action to the sign-in state. Everything the module owns: [modules.md](modules.md).

## Deployment health

The backend has no public route. `GET /api/health` on the frontend (`src/app/api/health/route.ts`) fetches
`${BACKEND_API_URL}/health` server-side (3 s timeout, no cache) and returns `200 {"status":"ok"}`, or
`503 {"status":"unavailable"}` with no detail when `BACKEND_API_URL` is unset, the backend is unreachable or it returns
non-200; the cause is logged server-side. `src/proxy.ts` leaves it unauthenticated and exempt from rate limiting.
`.github/workflows/post-deploy-smoke.yml` curls it after each successful production deployment. The compose smoke test
(`scripts/compose-smoke.sh`) asserts the same two states locally and in CI.

## Data

- **Platform database:** accounts, organisations, memberships, admin settings, billing state and the audit log.
  Migrations run deliberately, never at deploy (ADR-011).
- **Logs:** Winston on the frontend (`src/lib/logger.ts`, daily files in `logs/`), JSON logging on the backend
  (`app/core/logging.py`), both with redaction of secret-looking values. Errors go to Sentry when a DSN is set.
- **Rate limits:** Upstash Redis counters, keyed per ADR-007; disabled when not configured.

## Architecture decision records

| ADR | Topic |
| --- | --- |
| [001](../adr/0001-adopt-nextjs-fastapi-template.md) | Adopt the nextjs-fastapi-template backend |
| [003](../adr/0003-nextjs-to-fastapi-authentication.md) | Next.js to FastAPI authentication: internal key plus forwarded session |
| [004](../adr/0004-backend-layering.md) | Backend layering: routers, services, repositories |
| [006](../adr/0006-docker-role.md) | Role of Docker: local stack and CI smoke, not production |
| [007](../adr/0007-rate-limit-keys.md) | Rate limit keys and fail modes |
| [008](../adr/0008-api-client-generation.md) | Generated OpenAPI client and response envelope |
| [011](../adr/0011-single-vercel-project-with-services.md) | Single Vercel project with services |
