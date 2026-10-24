# Keeping a project in step with the template

Projects created from this template diverge quickly: they add features, rename the brand and remove modules.
This page describes how to pull template improvements into such a project, and how to feed fixes back.

## Pulling template changes into a project

1. Add the template as a remote once:

   ```bash
   git remote add template https://github.com/vpachipulusu/boiler-plate-fastapi-nextjs.git
   git fetch template
   ```

2. Review what changed since you last synced (tag the point you synced to, for example `template-sync-2026-10`):

   ```bash
   git log --oneline template-sync-2026-10..template/main
   git diff --stat template-sync-2026-10..template/main
   ```

3. Cherry-pick the commits you want, or apply the diff of a folder you have not customised:

   ```bash
   git cherry-pick <sha>
   # or, for an area such as CI:
   git diff template-sync-2026-10..template/main -- .github | git apply -3
   ```

   Areas that usually merge cleanly: `.github/`, `.pre-commit-config.yaml`, `fastapi_backend/app/core/`,
   `nextjs-frontend/src/proxy.ts`, `nextjs-frontend/src/lib/api/server.ts`, the docs. Areas that usually
   conflict: anything you rebranded, pages you redesigned, and the Alembic baseline (take schema changes as a
   new revision in your project instead of editing `0001`).

4. Regenerate the OpenAPI client if backend routes changed, run the full check set, tag the new sync point.

## Feeding fixes back to the template

The template is kept generic. A change belongs in the template when it would help any project built from it:
a security fix, a dependency bump, a CI improvement, a bug in the auth or organisation flows, a clearer doc.
Product features do not.

1. Branch the template, apply the change without product branding or product-specific identifiers.
2. Keep the brand placeholder (`Your App`, `yourapp`), env placeholders only, and no real project names, hosts
   or ids in docs or tests.
3. Open a PR; `CI gate` must be green. A fresh clone must still install, lint, typecheck, test and build with the
   placeholder env.

## How this template was produced

The template is the platform half of a product repository (accounts, organisations, admin, billing, platform
plumbing), exported by a script that copies the tracked files, deletes the product-only ones, replaces the brand
and ticket references, and leaves a repository with a fresh history. Re-running that export produces a new
candidate; differences against this repository are then reviewed and applied as ordinary commits, so the
template's history stays readable. Changes made directly in the template (such as the docs in this folder) are
not fed back into the product automatically.
