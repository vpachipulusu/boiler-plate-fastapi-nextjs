# Lighthouse: public pages (FREEJ-25)

Measured 2026-10-29 on branch `feat/freej-25-seo-completeness`, fixture catalogue.

## How it was run

- `npm run build`, then `npx next start -p 3100` from `nextjs-frontend/` (port 3100 instead of the
  default 3000; the page canonicals still say `http://localhost:3000` because `NEXT_PUBLIC_APP_URL`
  comes from `.env.local`).
- `npx lighthouse@12` (version 12.8.2, not added to `package.json`), mobile form factor, simulated
  throttling, categories performance, accessibility, best-practices and SEO, headless Google Chrome.
  Exact command, run once per page with `CHROME_PATH` pointing at the installed Chrome:

  ```bash
  npx --yes lighthouse@12 http://localhost:3100/<path> --form-factor=mobile \
    --only-categories=performance,accessibility,best-practices,seo \
    --chrome-flags="--headless=new --no-sandbox" --output=json --output-path=<file>.json --quiet
  ```

- Chrome version: `HeadlessChrome/156.0.0.0`, read from the report's `environment.hostUserAgent`.
  `chrome --version` could not be used: on this Windows machine it hands off to the already running
  browser instead of printing a version.
- One run per page, on a developer laptop. Performance numbers vary by a few points between runs;
  treat them as a baseline, not a guarantee.

## Scores (0 to 100)

| Page | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| `/` | 89 | 96 | 96 | 66 |
| `/freebies` | 91 | 96 | 96 | 66 |
| `/freebies/coffee-discovery-pack` | 91 | 96 | 96 | 66 |

## Timings (mobile, simulated)

| Page | FCP | LCP | TBT | CLS | Speed Index |
|---|---|---|---|---|---|
| `/` | 1.6 s | 3.6 s | 110 ms | 0 | 1.6 s |
| `/freebies` | 1.5 s | 3.4 s | 120 ms | 0.001 | 1.5 s |
| `/freebies/coffee-discovery-pack` | 1.5 s | 3.3 s | 90 ms | 0.002 | 1.5 s |

## What is not at 100, and why

- **SEO 66, "Page is blocked from indexing" (`is-crawlable`)**: expected. Every page is fixture data,
  so it answers `<meta name="robots" content="noindex">` on purpose. This is the only SEO audit that
  fails; the other SEO audits (title, description, canonical, viewport, link text, valid robots.txt)
  pass. When the catalogue turns API-backed the home page, `/freebies` and live offers become
  indexable by themselves and this audit will pass. Re-run Lighthouse then to record the real score.
- **Best practices 96, `errors-in-console`**: three 404s for `/favicon.ico`, `/favicon-16x16.png` and
  `/favicon-32x32.png`. `src/app/layout.tsx` declares them but `public/` does not contain them. This
  predates FREEJ-25 and is outside its scope; listed as a follow-up in `docs/developer/freejoy-seo.md`.
- **Accessibility 96, `color-contrast`**: one `span` (a small label badge, `font-display font-extrabold`)
  fails the contrast ratio on all three pages. It is existing Phase 1 design and was not touched here.
- **Performance 89 to 91**: LCP of 3.3 to 3.6 s is the main cost. Not investigated in this story.

## Not done

- The Google Rich Results Test and the Search Console URL Inspection need a public URL and a human.
  They are listed as owner follow-ups in `docs/developer/freejoy-seo.md`.
- Desktop-mode and repeat runs were not taken.
