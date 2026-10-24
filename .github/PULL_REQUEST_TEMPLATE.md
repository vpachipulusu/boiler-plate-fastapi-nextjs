## Summary

What changed and why. If this closes an issue, link it (`Closes #n`).

## Verification

Commands you ran and their results. CI runs lint, typecheck, unit tests and the backend checks, but **E2E is off in CI**, so E2E specs must be run locally.

- [ ] Frontend: `npm run lint`, `npm run typecheck`, `npm run test:unit`, prettier on changed files
- [ ] Backend: `uv run ruff check .`, `uv run ruff format --check .`, `uv run mypy`, `uv run pytest --cov`
- [ ] E2E / real-route tests run locally and passing: `<exact command>` → `<result>` (if something could not run, say exactly what blocked it)

## Review

- [ ] Security-sensitive changes (auth, payments, secrets, SQL, external calls) reviewed with extra care
- [ ] No secrets, connection strings or personal data in code, logs or error messages
- [ ] Migrations: `alembic upgrade head`, `alembic check` and `downgrade base` run against a database you own

## Notes for the reviewer

Migrations, new environment variables, deploy steps, files outside the change's area, or follow-ups.
