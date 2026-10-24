# Optional modules

Two parts of the template are modules: self-contained features you can delete without touching the rest.
Each section lists what the module owns, the few places where core code mentions it (the touch points), and
the removal steps. Run the full check set afterwards (`workflow.md`, "Before you push"): every leftover shows up
as a lint, type or test failure.

## Stripe Billing

Subscription tiers (`free`, `pro`, `enterprise`) per organisation, Stripe Checkout and Billing Portal, the
webhook that is the only writer of subscription state, admin subscription management and revenue analytics.
Docs: `backend-org-billing.md`, `backend-billing-webhook.md`, `backend-admin-subscriptions.md`,
`backend-admin-analytics.md`.

Stays in core when the module is removed: `app/core/plans.py` and `app/services/plan_limits.py` (plan names
and the member limit; every organisation is on `free` without Stripe), the `organizations` columns
`stripe_*`, `subscription_*` and `granted_*` (part of the single Alembic baseline; harmless when unused), and
`currencies.ts` / the public `currency` setting.

### Backend files (`fastapi_backend/`)

```
app/api/v1/org_billing.py            app/services/org_billing.py          app/repositories/org_billing.py
app/api/v1/webhooks.py               app/services/stripe_webhook.py       app/repositories/billing.py
app/api/v1/admin_subscriptions.py    app/services/admin_subscriptions.py  app/repositories/admin_subscriptions.py
app/api/v1/admin_analytics.py        app/services/admin_subscription_sync.py
                                     app/services/admin_analytics.py      app/repositories/admin_analytics.py
                                     app/services/plan_prices.py
                                     app/services/price_cache.py
app/core/stripe_billing.py  app/core/stripe_admin.py  app/core/stripe_prices.py
app/core/stripe_signature.py  app/core/stripe_sync.py  app/core/stripe_webhook_body.py
app/models/platform/stripe_event.py
tests: tests/api/test_org_billing*.py, tests/api/test_stripe_webhook*.py, tests/api/test_plan_prices.py,
       tests/api/admin_subscriptions/, tests/api/admin_analytics/, tests/core/test_stripe_*.py,
       tests/services/test_org_billing.py, test_stripe_webhook.py, test_plan_prices.py, test_price_cache.py,
       test_admin_analytics.py, tests/fakes_billing.py, tests/fakes_admin_subscriptions.py,
       tests/fakes_admin_analytics.py, tests/core/test_vercel_routing.py (the webhook rewrite)
```

Backend touch points:

| Where | What |
| --- | --- |
| `app/api/v1/router.py` | the three `include_router` lines under the "Stripe Billing module" comment, plus `admin_analytics` |
| `app/core/config.py` | the Stripe settings block (`STRIPE_*`, `BILLING_RETURN_URL_ORIGINS`) |
| `app/api/v1/settings.py` | the `/plan-prices` route and `PlanPricesService` dependency |
| `app/core/permissions.py` | the `subscriptions.*` permissions |
| `app/core/rate_limit.py` | `ADMIN_SYNC_POLICY` |
| `app/api/v1/me_export.py` and its service | the subscription fields in the personal data export |
| `app/models/platform/__init__.py` | `StripeEvent` import; `stripe_events` table in the baseline (`alembic_migrations/versions/0001_baseline.py`) |
| `.env.example` | the "Stripe Billing module" block |

### Frontend files (`nextjs-frontend/`)

```
src/app/pricing/**                               src/components/pricing/**
src/app/dashboard/settings/billing/**            src/components/dashboard/billing/**
src/components/dashboard/plan-usage-meter.tsx    src/components/dashboard/subscription-success-handler.tsx
src/app/actions/subscription-actions.ts          src/app/actions/admin/analytics-actions.ts
src/lib/api/billing.ts  src/lib/api/plan-prices.ts  src/lib/api/admin-subscriptions.ts  src/lib/api/admin-analytics.ts
src/lib/stripe/**  src/lib/billing-status.ts  src/config/subscriptions.ts
src/app/(admin)/admin/subscriptions/**  src/app/(admin)/admin/analytics/**
scripts/e2e-stripe-listen.mjs
src/__tests__/e2e/{subscription,subscription-simple,billing-management,pricing,admin-analytics}.spec.ts, SUBSCRIPTION_TESTS.md
src/__tests__/unit/**: every test whose name contains billing, pricing, subscription, plan-usage or analytics
```

Frontend touch points:

| Where | What |
| --- | --- |
| `src/app/dashboard/page.tsx` | the Plan panel (`fetchBillingSummary`, `describePlanStatus`) |
| `src/components/dashboard/nav-items.ts` | the Billing entry |
| `src/components/admin/admin-nav-items.ts` | the Subscriptions and Analytics entries |
| `src/app/(admin)/admin/settings/page.tsx` | the `stripe_events` row in the system counts |
| `package.json` | `@stripe/stripe-js`, the `test:e2e:subscription` script |
| `.env.example` | the "Stripe Billing module" block |
| `.github/workflows/frontend.yml` | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` placeholder in the build step |
| `.github/workflows/e2e.yml` | the Stripe steps and `E2E_STRIPE` variable |
| root `vercel.json` | the `/webhooks/stripe` rewrite to `fastapi_backend` |

### Removing it

1. Delete the files listed above in both apps.
2. Remove each touch point; `npm run typecheck` and `uv run mypy` point at anything you missed.
3. Regenerate the OpenAPI schema and client (`workflow.md`), then run the full check set.
4. Optionally drop the Stripe columns and `stripe_events` from the baseline with a new Alembic revision.

## Capacitor (mobile shells)

Wraps the web app in iOS and Android projects. Nothing in the web code depends on it.

| Where | What |
| --- | --- |
| `nextjs-frontend/capacitor.config.ts` | the config (reads `APP_ID`, `APP_NAME`) |
| `nextjs-frontend/package.json` | `@capacitor/*` dependencies, `@capacitor/cli`, the `cap:*`, `build:mobile`, `ios:build`, `android:build` scripts |
| `nextjs-frontend/.env.example` | the "Capacitor mobile module" block |
| root `.gitignore` | the `nextjs-frontend/ios/`, `android/`, `capacitor.config.json` lines |
| `src/app/page.tsx` | the "Capacitor" item in the tech list on the landing page |

Removing it: delete `capacitor.config.ts`, `npm uninstall` the `@capacitor/*` packages, remove the scripts,
env block, gitignore lines and landing-page item. Using it: `npm run cap:add:ios` / `cap:add:android` once,
then `npm run ios:build` or `android:build` (needs Xcode / Android Studio).
