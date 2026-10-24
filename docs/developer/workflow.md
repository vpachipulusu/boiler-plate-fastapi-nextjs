# Development workflow

## Branches, commits, pull requests

- Branch from `main`: `<type>/<short-slug>` (`feat/org-invites`, `fix/session-refresh`).
- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `ci:`, `perf:`.
- Open a pull request with the template in `.github/PULL_REQUEST_TEMPLATE.md`: what changed, how you verified it
  (commands and results, including any Playwright specs you ran locally), what reviewers should look at.
- Protect `main` so that only the `CI gate` check is required and merges go through pull requests.

## Before you push

```bash
# frontend (nextjs-frontend/)
npm run lint && npm run typecheck && npm run test:unit && npm run build
# backend (fastapi_backend/)
uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest --cov
# both, on changed files only
uvx pre-commit run --from-ref origin/main --to-ref HEAD
```

Install the git hook once with `uvx pre-commit install` if you want these to run on every commit.

## CI

`.github/workflows/ci.yml` detects which paths changed and runs only the matching workflows:

- `frontend.yml`: lint, typecheck, unit tests with coverage, a server-only-package grep, production build with
  placeholder Firebase env.
- `backend.yml`: ruff, mypy, pytest (including the Postgres-backed `*_e2e.py` tests against a service
  container), coverage floor, and an Alembic job that runs `upgrade head`, `alembic check` and `downgrade base`.
- Pre-commit on the files changed by the PR, and a Docker Compose smoke test.
- `CI gate` always runs last and passes when every needed job succeeded or was skipped by the path filter.

`e2e.yml` (Playwright) is separate and off until you create a Firebase test project and set the `e2e-test`
environment secrets; see [local-e2e.md](local-e2e.md) for running specs locally in the meantime.

## The generated API client

The frontend calls the backend through a typed client generated from `nextjs-frontend/openapi.json`. After
changing a route, schema or error response in the backend:

```bash
cd fastapi_backend && uv run python -m commands.generate_openapi_schema
cd ../nextjs-frontend && npm run generate:client && npm run check:client
```

Commit `openapi.json` and `src/lib/api/generated/` together with the backend change. Never edit the generated
files by hand; pre-commit and CI fail when they are stale.

## Database migrations

One Alembic head at a time. After changing a model:

```bash
cd fastapi_backend
uv run alembic revision --autogenerate -m "<what changed>"
# add the new revision id to PLATFORM_REVISIONS in app/core/platform_schema.py
uv run alembic upgrade head && uv run alembic check && uv run alembic downgrade base && uv run alembic upgrade head
```

Run migrations yourself before or right after deploying (no deploy does it for you); `GET /health/ready`
answers 503 `migrations_pending` until then. Details: [platform-models.md](platform-models.md).

## Dependencies

- Frontend: `npm install <pkg>` from `nextjs-frontend/`; commit `package-lock.json`.
- Backend: edit `pyproject.toml`, then `uv lock` and
  `uv export --frozen --no-dev --no-hashes --quiet -o requirements.txt` (pre-commit checks the export).
- Dependabot opens weekly grouped updates for npm, pip and GitHub Actions (`.github/dependabot.yml`).

## Keeping the template's structure

- Module code stays behind the touch points in [modules.md](modules.md) so the module remains removable.
- Record a design decision as an ADR (`docs/adr/`, template in its README) when it changes how the apps talk
  to each other, where data lives, or how requests are authenticated.
