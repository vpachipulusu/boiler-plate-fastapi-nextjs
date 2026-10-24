# ADR-001: Adopt the nextjs-fastapi-template backend

- **Status:** Accepted by the product owner, 2026-10-12
- **Date:** 2026-10-11

## Context

The frontend started as a Next.js boilerplate that read Postgres directly, from server actions and from
some pages. Keeping secrets and data access out of the frontend needs a separate backend. Building one from scratch would take weeks that the project budget
does not have.

[vintasoftware/nextjs-fastapi-template](https://github.com/vintasoftware/nextjs-fastapi-template) (MIT)
already provides a FastAPI service with uv, async SQLAlchemy, Alembic, OpenAPI client generation, Docker
Compose, pre-commit and a Vercel serverless entry point.

## Decision

Adopt the template's backend as `fastapi_backend/` and keep the template's folder names
(`nextjs-frontend/`, `fastapi_backend/`) so upstream changes stay easy to compare.

Keep:
- the uv project (`pyproject.toml`, `uv.lock`), renamed to Your App, with its old pins upgraded (for example
  ruff `<0.2`) before anything is built on it;
- `api/index.py`; the template's `vercel.json` and `vercel.prod.json` are replaced by the root `vercel.json` ([ADR-011](0011-single-vercel-project-with-services.md));
- the `NullPool` engine (serverless-friendly);
- `generate_openapi_schema` and `watcher.py` (see [ADR-008](0008-api-client-generation.md));
- Docker Compose, pre-commit, Makefile and GitHub workflows, adapted (see [ADR-006](0006-docker-role.md)).
  These live at the upstream template's root and were copied into this repo.

Tooling: uv, ruff, mypy, pytest with pytest-asyncio, pre-commit hooks, Docker Compose for local
development, and Sentry.

Remove or change:

| Template piece | Change | Reason |
|---|---|---|
| fastapi-users (`users.py`, auth routes, `User` table, JWT secrets) | Remove | Firebase stays ([ADR-003](0003-nextjs-to-fastapi-authentication.md)) |
| fastapi-mail and `email_templates/` | Remove | Transactional email is left to the project; Firebase sends verification and reset mail |
| `Item` model, routes, migrations | Remove; new Alembic baseline | Example code |
| `Dockerfile` (root user, `curl … \| sh` uv install) | Harden: pinned uv image, non-root user | Supply-chain and container safety |
| `CORS_ORIGINS=["*"]` with credentials | Restrict (in practice, no browser origins) | The browser never calls the backend |
| `print()` in the user manager | Structured logging | Goes with fastapi-users anyway |
| `database.py` rebuilds the URL and drops its query string | Pass TLS settings through asyncpg `connect_args` | A hosted Postgres's `sslmode` is otherwise lost, and asyncpg ignores it anyway |

The upstream MIT licence is kept in `fastapi_backend/`.

## Alternatives considered

- **Write a FastAPI service from scratch.** Full control, but rebuilds what the template already solves
  (serverless entry point, OpenAPI pipeline, Compose).
- **Keep everything in Next.js (server actions + an ORM).** No second service, but data access,
  background jobs and secret isolation would all live in the frontend.
- **Use the template whole, including fastapi-users.** Would mean migrating every user account off
  Firebase for no product gain.

## Consequences

- The backend starts from a working skeleton; the adaptation is mostly deleting and hardening, not writing.
- We own the fork. Upstream fixes are compared and copied by hand; no automatic sync.
- Old pins and the template's insecure defaults (Dockerfile, CORS) were known debts, paid before feature work.
