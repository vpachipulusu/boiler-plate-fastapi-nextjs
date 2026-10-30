import { test, expect, type Page } from '@playwright/test';
import { waitForPageReady } from './helpers/e2e-utils';

/**
 * interactive controls are at least 44px high (buttons 44, large 48, inputs 44).
 * Written for local/staging runs; E2E stays off in CI.
 */

const MIN_TARGET = 44;
const PATHS = ['/login', '/signup', '/pricing'] as const;

async function shortTargets(page: Page): Promise<string[]> {
  return page.evaluate((min) => {
    const nodes = document.querySelectorAll<HTMLElement>(
      'main button, main input:not([type="hidden"]):not([type="checkbox"]), main [role="button"], header button'
    );
    return Array.from(nodes)
      .filter((el) => {
        const box = el.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && box.height < min - 0.5;
      })
      .map(
        (el) =>
          `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 30)}" ${el.getBoundingClientRect().height}px`
      );
  }, MIN_TARGET);
}

for (const path of PATHS) {
  test(`controls on ${path} are at least 44px high`, async ({ page }) => {
    await page.goto(path);
    await waitForPageReady(page);
    expect(await shortTargets(page)).toEqual([]);
  });
}

test('primary button on /login is 44px and focus ring is a 3px outline', async ({ page }) => {
  await page.goto('/login');
  await waitForPageReady(page);

  const submit = page.locator('button.bg-cta').first();
  const box = await submit.boundingBox();
  expect(box?.height).toBeCloseTo(44, 0);

  const email = page.locator('input[type="email"]').first();
  expect((await email.boundingBox())?.height).toBeCloseTo(44, 0);

  await page.keyboard.press('Tab');
  await submit.focus();
  // Buttons use transition-all, so wait for the outline to finish animating in.
  await expect
    .poll(() =>
      submit.evaluate((el) => {
        const s = getComputedStyle(el);
        return { width: s.outlineWidth, offset: s.outlineOffset, style: s.outlineStyle };
      })
    )
    .toEqual({ width: '3px', offset: '2px', style: 'solid' });
});

/**
 * Keyboard walkthrough: every Tab stop shows exactly one 3px outline at a 2px offset and no ring shadow (light mode).
 * The colour is read from the live token, never hard-coded: `--ring`, or `--cta` inside an `.on-inverse` surface
 * (globals.css). Documentation only: the default `freejoy` theme (src/config/themes.ts) currently resolves them to
 * ink green (162 27% 17%) and coral (8 92% 68%).
 *
 * Two controls draw their outline on a container because the control itself is hidden or stretched: the `sr-only`
 * checkbox/radio inside a `label` (alerts cards) and the title link of an offer `article` (stretched link). For those
 * stops the container must show the outline and the control itself none.
 */
const MAX_TAB_STOPS = 25;
const MAX_TAB_STOPS_WITH_PROXY = 70;
const PROXY_STOPS_TO_VERIFY = 2;

interface OutlineReading {
  width: string;
  style: string;
  color: string;
  offset: string;
  shadow: string;
}

interface StopSnapshot {
  tag: string;
  proxied: boolean;
  expectedColor: string;
  target: OutlineReading;
  controlOutlineVisible: boolean;
}

/** The focused element's outline, or its container's when the control is an sr-only input or a stretched link. */
function readStop(page: Page): Promise<StopSnapshot> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const read = (node: Element): OutlineReading => {
      const s = getComputedStyle(node);
      return {
        width: s.outlineWidth,
        style: s.outlineStyle,
        color: s.outlineColor,
        offset: s.outlineOffset,
        shadow: s.boxShadow,
      };
    };
    const srOnly = el.matches('input') && el.getBoundingClientRect().width <= 1;
    const proxy = srOnly || el.matches('article a') ? el.closest('label, article') : null;
    const target = proxy ?? el;
    // Resolve the live token through a probe so the expectation follows the theme.
    const probe = document.createElement('span');
    probe.style.color = `hsl(var(${target.closest('.on-inverse') ? '--cta' : '--ring'}))`;
    document.body.appendChild(probe);
    const expectedColor = getComputedStyle(probe).color;
    probe.remove();
    const control = read(el);
    return {
      tag: el.tagName.toLowerCase(),
      proxied: proxy !== null,
      expectedColor,
      target: read(target),
      controlOutlineVisible:
        !srOnly &&
        control.style !== 'none' &&
        control.color !== 'rgba(0, 0, 0, 0)' &&
        parseFloat(control.width) > 0,
    };
  });
}

const WALKS = [
  { path: '/login', proxy: null },
  { path: '/pricing', proxy: null },
  { path: '/alerts', proxy: 'sr-only checkbox/radio' },
  { path: '/freebies', proxy: 'offer card title link' },
] as const;

for (const { path, proxy } of WALKS) {
  test(`tab order on ${path} shows one 3px focus outline per stop`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(path);
    await waitForPageReady(page);
    if (path === '/alerts') {
      test.skip(
        (await page.locator('input[type="checkbox"]').count()) === 0,
        'the alerts form only renders when the server runs with ALERTS_FORM_LIVE=true'
      );
    }

    const stops: string[] = [];
    let proxyStops = 0;
    const maxStops = proxy ? MAX_TAB_STOPS_WITH_PROXY : MAX_TAB_STOPS;
    for (let i = 0; i < maxStops && proxyStops < PROXY_STOPS_TO_VERIFY; i++) {
      await page.keyboard.press('Tab');
      const active = page.locator(':focus-visible');
      if ((await active.count()) === 0) break;
      // Past the page content: the TanStack devtools toggle only exists in dev builds.
      if (await active.evaluate((el) => el.className.toString().includes('tsqd'))) break;
      // Outline animates in via transition-all on buttons.
      await expect.poll(async () => (await readStop(page)).target.width).toBe('3px');
      const stop = await readStop(page);
      expect([stop.target.color, stop.target.style, stop.target.offset]).toEqual([
        stop.expectedColor,
        'solid',
        '2px',
      ]);
      // A Tailwind ring is a spread shadow ("0px 0px 0px 2px"); the normal shadow-sm is fine.
      expect(stop.target.shadow).not.toMatch(/0px 0px 0px [1-9]\d*px/);
      if (stop.proxied) {
        // One indicator only: the container carries it, the control itself shows none.
        expect(stop.controlOutlineVisible).toBe(false);
        proxyStops += 1;
      }
      stops.push(stop.tag);
    }
    expect(stops.length).toBeGreaterThan(2);
    if (proxy) expect(proxyStops, `a ${proxy} stop was reached and verified`).toBeGreaterThan(0);
  });
}
