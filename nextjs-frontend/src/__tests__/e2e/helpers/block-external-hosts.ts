/**
 * Chromium launch arguments that make every host except the local server fail to resolve, so a spec can follow a real
 * outbound redirect in a real browser and still never reach the provider: the request is issued (and can be observed,
 * with its `redirectedFrom()` chain) but it dies at name resolution, before anything leaves the machine.
 *
 * `page.route()` cannot do this job: Chromium does not send the target of a redirect through it, so a stub registered
 * with page.route for the provider's origin never answers a redirected navigation and the real provider is contacted.
 *
 * Use it with `test.use({ launchOptions: { args: BLOCK_EXTERNAL_HOSTS } })` and assert that the provider request failed
 * with ERR_NAME_NOT_RESOLVED, which proves the block was in force.
 */
export const BLOCK_EXTERNAL_HOSTS = [
  '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost , EXCLUDE 127.0.0.1',
];

export const NAME_NOT_RESOLVED = 'ERR_NAME_NOT_RESOLVED';
