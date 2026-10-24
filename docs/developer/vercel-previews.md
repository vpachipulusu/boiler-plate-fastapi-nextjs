# Vercel deployments: only `main` deploys, previews are manual

The root `vercel.json` deploys one Vercel project with two services (ADR-011): `nextjs-frontend` (public) and
`fastapi_backend` (internal, reached through the `BACKEND_API_URL` service binding). Only `main` deploys
automatically; branch pushes and pull requests create no deployment at all, so the `CI gate` check is the only
thing a merge waits for and the Hobby plan's limit of 100 deployments per day is not spent on previews.

## What builds

| Push | Vercel creates a deployment? |
| --- | --- |
| `main` | Yes (production) |
| Any other branch or PR | No deployment record at all |
| `vercel deploy` from the CLI | Yes (not Git-triggered, so Git settings do not apply) |

The setting is in both `vercel.json` files (root and `fastapi_backend/`):

```json
"git": { "deploymentEnabled": { "main": true, "**": false } }
```

`deploymentEnabled` is per branch and cannot read the commit message, so there is no commit-message opt-in; a
preview is made by hand.

## Getting a preview on purpose

Deploy by hand from your checkout (does not use Git, so it always creates one deployment):

```bash
npm run vercel:pull && npm run vercel:build && npm run vercel:preview
```

Each manual preview counts toward the daily limit. Preview deployments need their own preview environment variables
(never production secrets); one built without them answers 503 on the routes that need them.
`.github/workflows/vercel-preview.yml` does the same from a manual workflow run when `VERCEL_TOKEN`,
`VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` are set as repository secrets.

## Fallback: Ignored Build Step

`scripts/vercel-ignore-build.sh` is kept as a fallback for projects that cannot use `deploymentEnabled`: set it as the
dashboard Ignored Build Step (`bash scripts/vercel-ignore-build.sh`), or as `ignoreCommand` in a per-service
`vercel.json`. It builds `main` always and other branches only when the latest commit message contains
`[deploy preview]`. Two constraints:

- A `vercel.json` that defines `services` cannot carry a top-level `ignoreCommand`: Vercel rejects the deploy because
  the owning service is ambiguous. Put it in the service's own `vercel.json` (as `fastapi_backend/vercel.json` does).
- A script outside a service's Root Directory needs **Include source files outside of the Root Directory in the Build
  Step** turned on in the project settings.

Dry-run test of the script (exit codes, hostile commit messages, both `vercel.json` files parse):

```bash
bash scripts/vercel-ignore-build.test.sh
```

## Production checklist

1. Production branch `main`; Git fork protection on.
2. Production environment variables for both services (names in the two `.env.example` files); the service binding
   provides `BACKEND_API_URL`.
3. Run `uv run alembic upgrade head` against the production database before or right after the first deploy
   ([platform-models.md](platform-models.md)); `GET /health/ready` answers 503 until then.
4. `.github/workflows/post-deploy-smoke.yml` curls `/api/health` after each production deployment.
