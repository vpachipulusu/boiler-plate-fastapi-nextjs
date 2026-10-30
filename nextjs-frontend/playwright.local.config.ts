import os from 'node:os';
import { defineConfig, devices } from '@playwright/test';
import baseConfig from './playwright.config';

/**
 * Local E2E, used by `npm run test:e2e:local` (scripts/e2e-local.mjs).
 *
 * The script owns the server lifecycle (free port, production build, warm-up, cleanup), so this config has no
 * webServer. It runs chromium (plus the auth setup project it depends on) and the two money-path projects; CI keeps
 * using playwright.config.ts.
 *
 * The money-path specs (FREEJ-27) browse anonymously, so their projects have NO `setup` dependency: selecting them
 * never runs the Firebase login. `npm run test:e2e:local -- outbound alerts-lifecycle` selects exactly these two
 * projects (scripts/e2e-public-mode.cjs). The `chromium` project ignores the two specs so a full run does not run
 * them a second time behind the login.
 */
const MONEY_PATH_SPEC = /[\\/](outbound|alerts-lifecycle)\.spec\.ts$/;
const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;

const MAX_LOCAL_WORKERS = 4;
const CPUS_PER_WORKER = 2;

// Beyond ~4 workers the browser and `next start` compete for CPU and tests time out in page.goto (run 4).
const workers = Math.max(
  1,
  Math.min(MAX_LOCAL_WORKERS, Math.floor(os.cpus().length / CPUS_PER_WORKER))
);

export default defineConfig({
  ...baseConfig,
  workers,
  reporter: [['list']],
  projects: [
    ...(baseConfig.projects ?? [])
      .filter((project) => project.name === 'setup' || project.name === 'chromium')
      .map((project) =>
        project.name === 'chromium' ? { ...project, testIgnore: MONEY_PATH_SPEC } : project
      ),
    {
      name: 'money-desktop',
      testMatch: MONEY_PATH_SPEC,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Chromium with a 390px touch viewport and a mobile user agent (the backend classes the click as MOBILE).
      name: 'money-mobile',
      testMatch: MONEY_PATH_SPEC,
      use: { ...devices['Pixel 7'], viewport: MOBILE_VIEWPORT },
    },
  ],
  webServer: undefined,
});
