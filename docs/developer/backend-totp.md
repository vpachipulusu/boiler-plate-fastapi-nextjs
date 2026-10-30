# Backend TOTP

Two-factor authentication (TOTP, authenticator app codes) has two halves: enrolment and disabling under
`/v1/me/totp`, and the check at sign-in on `POST /v1/auth/session`. All of it runs through the server-only backend
client; the browser never calls the backend.

## Sign-in

`POST /v1/auth/session` accepts `{ "id_token": "...", "totp_code": "123456" }`. `totp_code` is optional plain bounded
text (at most 64 characters), so a malformed code is refused as `totp_invalid` (401), not 422. A blank code counts as
no code. The check is in `app/services/signin_totp.py` and runs before any session cookie is minted or login recorded:

| Account state                                                       | Request                 | Result                                                                      |
| ------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------- |
| No user row yet (sign-up), or 2FA not enabled                       | any                     | Signs in as before. A pending enrolment (not yet confirmed) is not enforced |
| 2FA enabled                                                         | no code                 | 401, body `code: "totp_required"`                                           |
| 2FA enabled                                                         | wrong or malformed code | 401, body `code: "totp_invalid"`                                            |
| 2FA enabled                                                         | right code              | Session cookie issued, login recorded                                       |
| 2FA enabled, secret missing or undecryptable, or key not configured | any                     | 503: sign-in is refused (fails closed)                                      |

The error body keeps the usual envelope plus a stable `code` (`AuthChallengeErrorResponse` in `app/core/errors.py`).
Clients branch on `code`, never on the message. `POST /v1/auth/session/refresh` does not ask for a code: it needs the
current session cookie, which already passed the check.

**Rate limits.** The route keeps the `AUTH_POLICY` limits (client IP, then verified email: 5 per 15 minutes each) and
adds `TOTP_SIGNIN_POLICY` (5 per 15 minutes, keyed by user id) for every request that carries a code. It is counted
before the code is checked, so a guess costs budget even when it is right; a request without a code spends none of it.
It fails closed (503) when Redis is down. Over the limit the answer is 429 with `Retry-After`. Every request to
`POST /v1/auth/session`, the first step and each code attempt, also counts once against the IP and email limits, so at
most four codes can be tried per window.

**Fresh sign-in.** The ID token must still have been issued by a sign-in within the last five minutes
(`REAUTH_MAX_AGE_SECONDS`). Someone who takes longer to type the code gets a plain 401 without a `code`.

### What the website does

The browser never sees the backend text. `verifyTokenAction(idToken, totpCode?)`
(`nextjs-frontend/src/app/actions/auth-actions.ts`) calls `createBackendSession` (`src/lib/api/account.ts`) and maps the
answers to typed flags on the action result:

| Backend answer                                       | Action result `data`       | What the form does                                                    |
| ---------------------------------------------------- | -------------------------- | --------------------------------------------------------------------- |
| 401 `totp_required`                                  | `totpRequired: true`       | Opens the code step (`TotpChallengeForm`) and keeps the same ID token |
| 401 `totp_invalid`, or a code that is not six digits | `totpInvalid: true`        | "That code did not work", field cleared                               |
| 429                                                  | `rateLimited: true`        | "Too many attempts", wait a few minutes                               |
| 5xx, unreachable, backend not configured             | `serviceUnavailable: true` | "Sign-in is unavailable right now"                                    |
| other 401                                            | none (generic)             | Closes the code step, signs the browser out of Firebase, and shows "Your sign-in timed out. Sign in again." on the first step |

The form checks that the code is six digits before it calls the action, and the action checks again: a non-six-digit
code that bypasses the form is refused without calling the backend, so a typo never spends the per-user code budget
(`totpCodeSchema` in `src/lib/utils/validation.ts` is the one rule). The code and ID token are never logged. For
two-factor refusals the action logs only the status and the stable `code`; the generic failure path also logs the
backend's error text.

Leaving the code step without signing in (Back, a sign-in too old to finish, the page going away) signs the Firebase
client out of the browser, so an abandoned sign-in leaves no refresh token behind. Once the first sign-in is too old
(five minutes) every retry would fail and still count against the sign-in limit, so the step closes instead of retrying.

If the page is left while the code request is still running, the browser is signed out of Firebase but the server may
still set the session cookie. That fails safe: the person has a session, not a stray Firebase refresh token.

Changing a password signs a 2FA user out: `restoreSessionWithNewPassword` (`src/lib/firebase/reauth.ts`) signs in again
with the new password and calls `verifyTokenAction(idToken)` without a code, gets `totpRequired` and returns false, so
the Security page signs the person out and sends them to `/login`, where they sign in with a code.
The code step finishes through the panel's `useCompleteSignIn(redirectTo)`, so a `?redirect=` page (FREEJ-41) is still
honoured after the code, and after Back and a new sign-in. The code step also serves Google and GitHub sign-in (`LoginPanel` hands over the ID token from either). The sign-up page
has no code step: a 2FA account that starts a provider sign-in there is told to sign in on the login page.

There are **no backup or recovery codes**. An account that loses its authenticator cannot sign in, and no admin screen
or API turns another person's 2FA off (it can only be cleared in the database: `users.two_factor_enabled` and
`users.two_factor_secret`). This is why the setup screen stays hidden (see below).

## Enrolment and disabling

All `/v1/me/totp` POST routes require a valid internal service key, a revoked-checked Firebase session with verified
email, and the fail-closed authentication limiter keyed by Firebase UID. Responses use `Cache-Control: no-store`.

- `/enroll`: supply `id_token` from recent Firebase reauthentication. It must belong to the same UID, have verified
  email, and have `auth_time` within the last five minutes. Returns `data.secret` and `data.uri` once for that
  enrolment.
- `/verify`: supply the six-digit `token` to enable the pending enrolment.
- `/disable`: supply a recent same-user `id_token` and a valid `token`. Disabling clears the stored secret.

The website has a **Disable 2FA** button on the Security page (`disableTwoFactorAction`) and shows the status, but **no
setup screen**: nothing in the UI calls `/enroll` or `/verify`. It stays hidden on purpose, because enabling 2FA without
backup codes can lock people out. Until a recovery path exists, enabling 2FA means calling the two routes by hand with
that person's own session and a fresh sign-in (an engineering task, not a user feature).

TOTP uses SHA-1, six digits, a 30-second period and a one-period drift window, matching the existing authenticator
setup. Already-enabled users cannot replace their secret through enrolment. Re-enrolment before confirmation replaces
the pending secret. Verification and disabling return only `success`; no profile, status or error response returns the
secret or provisioning URI.

## Storage and operations

The existing `two_factor_secret` column holds Fernet ciphertext. Configure a separate backend `TOTP_ENCRYPTION_KEY`
using a securely generated Fernet key. Missing configuration and undecryptable ciphertext fail closed with 503 (sign-in
for that account too; accounts without 2FA are unaffected). An invalid configured key prevents startup. Preserve this
key securely across deployments: replacing it without migrating ciphertext makes existing enrolments unusable, and those
accounts cannot sign in. No plaintext fallback is allowed. Do not log keys, secrets, codes, ID tokens or provisioning
URIs.

Each mutation runs in a service-owned transaction and locks the user's row before checking and changing enrolment state.
Repositories never commit or create a session. Unit tests use fake identity providers, transactions and repositories; no
real Firebase, Redis or database is contacted.
