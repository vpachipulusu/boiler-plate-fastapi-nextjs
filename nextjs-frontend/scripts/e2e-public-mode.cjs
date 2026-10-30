/**
 * "Public" e2e runs: specs that browse Freejoy anonymously (no login, no Firebase), so they need neither the Firebase
 * TEST project nor the auth setup project. CommonJS so scripts/e2e-local.mjs and the unit tests can both load it.
 *
 * A run is public when E2E_PUBLIC=1, or when every spec named on the command line is a public spec:
 *   npm run test:e2e:local -- outbound alerts-lifecycle
 * E2E_PUBLIC=0 forces the normal run. Write Playwright options as `--name=value` (a bare value after a flag is read as
 * a spec name and makes the run non-public).
 *
 * A public run:
 *  - needs no .env.e2e.local and never reads Firebase values from any env file; the build and the server get obvious
 *    placeholders instead (the frontend never uses the Firebase Admin SDK, and no public page signs anyone in);
 *  - serves the LIVE catalogue (CATALOGUE_SOURCE=api), so it needs a seeded backend (BACKEND_API_URL or BACKEND_PORT,
 *    and BACKEND_INTERNAL_KEY), see docs/developer/local-e2e.md;
 *  - runs only the money-desktop and money-mobile Playwright projects (playwright.local.config.ts), which have no
 *    `setup` dependency, so no login is attempted.
 */

/** Spec file names (without `.spec.ts`) that are public. Keep in step with MONEY_PATH_SPEC in playwright.local.config.ts. */
const PUBLIC_SPECS = ['outbound', 'alerts-lifecycle'];
const PUBLIC_PROJECTS = ['money-desktop', 'money-mobile'];

const PUBLIC_SPEC_ARG = new RegExp(`(^|[\\\\/])(${PUBLIC_SPECS.join('|')})(\\.spec\\.ts)?$`);

/**
 * Not credentials: shaped like Firebase values so the config checks pass, valid for no project. They must differ from
 * anything in .env/.env.local (scripts/e2e-env.cjs drops a real-env value equal to a dev-file value, and the CI
 * placeholders there use zeros), hence the distinctive numbers.
 */
const PLACEHOLDER_PROJECT_ID = 'e2e-public-placeholder';
const FIREBASE_PLACEHOLDERS = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'e2e-public-placeholder',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${PLACEHOLDER_PROJECT_ID}.firebaseapp.com`,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: PLACEHOLDER_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: `${PLACEHOLDER_PROJECT_ID}.appspot.com`,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '424242424242',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:424242424242:web:e2e-public-placeholder',
  FIREBASE_ADMIN_PROJECT_ID: PLACEHOLDER_PROJECT_ID,
  FIREBASE_ADMIN_CLIENT_EMAIL: 'e2e-public-placeholder@example.invalid',
  FIREBASE_ADMIN_PRIVATE_KEY: 'e2e-public-placeholder',
};

/** True when `args` (the arguments after `--`) select only public specs, or E2E_PUBLIC=1 asks for it. */
function isPublicRun(args, env = process.env) {
  if (env.E2E_PUBLIC === '1') return true;
  if (env.E2E_PUBLIC === '0') return false;
  const specs = args.filter((arg) => !arg.startsWith('-'));
  return specs.length > 0 && specs.every((arg) => PUBLIC_SPEC_ARG.test(arg));
}

/** Playwright `--project=` arguments that select the public projects. */
function publicProjectArgs() {
  return PUBLIC_PROJECTS.map((name) => `--project=${name}`);
}

/**
 * The env for a public run: `env` with the Firebase placeholders forced over any real values (so a developer's own
 * Firebase variables can never reach a public build), the live catalogue on, and the alerts form open.
 */
function publicRunEnv(env = process.env) {
  return {
    ...env,
    ...FIREBASE_PLACEHOLDERS,
    E2E_LIVE_CATALOGUE: '1',
    ALERTS_FORM_LIVE: 'true',
    E2E_PUBLIC: '1',
  };
}

module.exports = {
  PUBLIC_SPECS,
  PUBLIC_PROJECTS,
  FIREBASE_PLACEHOLDERS,
  isPublicRun,
  publicProjectArgs,
  publicRunEnv,
};
