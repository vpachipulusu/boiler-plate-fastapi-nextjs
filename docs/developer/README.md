# Developer docs

Start here, then follow the links. Root-level overview: [`../../README.md`](../../README.md). Agent rules:
[`../../.claude/CLAUDE.md`](../../.claude/CLAUDE.md).

## Setup and workflow

| Doc | What it covers |
| --- | --- |
| [getting-started.md](getting-started.md) | Prerequisites, env variables, running both apps, Docker Compose |
| [workflow.md](workflow.md) | Branches, commits, PRs, CI gate, pre-commit, the OpenAPI client, migrations |
| [modules.md](modules.md) | The optional Stripe Billing and Capacitor modules: files, env, touch points, removal |
| [template-sync.md](template-sync.md) | Keeping a project in step with this template (and feeding fixes back) |
| [testing.md](testing.md) | Unit, integration and e2e tests in both apps; coverage rules |
| [local-e2e.md](local-e2e.md) | Running Playwright locally against a production build and a real backend |
| [security.md](security.md) | Secrets, server-only code, session and CSRF rules, e2e accounts |
| [vercel-previews.md](vercel-previews.md) | Deploying with Vercel services (frontend + backend in one project) |

## Architecture

| Doc | What it covers |
| --- | --- |
| [architecture.md](architecture.md) | The two apps, the auth flow, the backend layering, data, logging |
| [platform-models.md](platform-models.md) | SQLAlchemy models and the Alembic baseline |
| [backend-auth.md](backend-auth.md) | Session endpoints, Firebase verification, internal key |
| [backend-totp.md](backend-totp.md) | Two-factor authentication |
| [backend-profile.md](backend-profile.md) | `/v1/me`, password change, data export, account deletion |
| [backend-organizations.md](backend-organizations.md) | Organisations and memberships |
| [backend-plan-limits.md](backend-plan-limits.md) | Plan definitions and limit checks |
| [backend-public-settings.md](backend-public-settings.md) | Public settings read by the frontend |
| [backend-frontend-seams.md](backend-frontend-seams.md) | Endpoints that keep `stripe` and `firebase-admin` out of the frontend |
| [backend-audit-logs.md](backend-audit-logs.md) | Audit log model and admin API |
| [backend-admin-users.md](backend-admin-users.md) | Admin user management |
| [admin-settings.md](admin-settings.md) | The admin settings area (general, theme, feature flags) |

## Stripe Billing module

| Doc | What it covers |
| --- | --- |
| [backend-org-billing.md](backend-org-billing.md) | Checkout, Billing Portal and subscription state per organisation |
| [backend-billing-webhook.md](backend-billing-webhook.md) | `POST /webhooks/stripe`, idempotency, production checklist |
| [backend-admin-subscriptions.md](backend-admin-subscriptions.md) | Admin subscription list and grants |
| [backend-admin-analytics.md](backend-admin-analytics.md) | Admin analytics and Stripe sync |

Decisions: [`../adr/README.md`](../adr/README.md).
