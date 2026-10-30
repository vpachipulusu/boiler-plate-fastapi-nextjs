import { defineConfig, devices } from '@playwright/test';

/**
 * Config for the `/go/[offerId]` redirect spec only (`npm run test:e2e:go`).
 *
 * The spec needs no login, so there is no auth setup project and no `webServer`: start a production build
 * (`next start`) and a seeded backend yourself and point E2E_BASE_URL at the app. See
 * docs/developer/freejoy-affiliate.md.
 */
export default defineConfig({
  testDir: './src/__tests__/e2e',
  testMatch: /go-redirect\.spec\.ts/,
  reporter: [['list']],
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3190',
    ...devices['Desktop Chrome'],
  },
});
