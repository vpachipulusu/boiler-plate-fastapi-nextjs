import { test, expect, type Page } from '@playwright/test';
import { waitForPageReady } from './helpers/e2e-utils';
import { MENU_ITEM_FOCUS } from '../../components/ui/menu-item-focus';

/**
 * FREEJ-35: the focus indicators that the page walks in touch-targets.spec.ts cannot reach without a login.
 *
 *  - Radix menu rows and select options (WCAG 1.4.11): the `focus:bg-accent` fill is 1.16:1 on white, so the row also
 *    gets a 2px inset --ring outline (MENU_ITEM_FOCUS). No public page renders a Radix menu or select (the sort control
 *    is a native <select>; the menus live in the signed-in and admin areas), so the rows are rebuilt from the real
 *    class contract in the live page, where the compiled stylesheet and the theme tokens are the real ones.
 *  - The focus-proxy outline (sr-only control in a label, stretched link in an article) on an inverse surface, in
 *    forced-colors mode, and the fallback for browsers without :has().
 * Colours are read from the live tokens (--ring, or --cta on an `.on-inverse` surface), never hard-coded.
 */

const MIN_NON_TEXT_CONTRAST = 3;
const SCHEMES = ['light', 'dark'] as const;
const ROW_CLASS = `flex rounded-xl px-3 py-2.5 text-sm focus:bg-accent ${MENU_ITEM_FOCUS}`;
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

/** Appends static test markup (never user data) to the page. */
async function mount(page: Page, html: string): Promise<void> {
  await page.evaluate((markup) => {
    const host = document.createElement('div');
    host.className = 'p-4';
    host.innerHTML = markup;
    document.body.appendChild(host);
  }, html);
}

interface FocusReading {
  outline: { width: string; style: string; color: string; offset: string };
  shadow: string;
  tokenColor: string;
  /** Contrast of the outline colour against the focused element's fill and against the surface behind it. */
  vsFill: number;
  vsSurface: number;
}

/** The focused element's outline and its contrast, or its container's when the control is a focus proxy. */
function readFocus(page: Page, token: '--ring' | '--cta', surfaceSelector: string) {
  return page.evaluate(
    ({ token, surfaceSelector }): FocusReading => {
      const active = document.activeElement as HTMLElement;
      const target = active.closest<HTMLElement>('label, article') ?? active;
      const style = getComputedStyle(target);
      // Resolve the live token through a probe so the expectation follows the theme.
      const probe = document.createElement('span');
      probe.style.color = `hsl(var(${token}))`;
      document.body.appendChild(probe);
      const tokenColor = getComputedStyle(probe).color;
      probe.remove();
      const luminance = (css: string) => {
        const [r, g, b] = (css.match(/[\d.]+/g) ?? []).slice(0, 3).map((v) => {
          const c = Number(v) / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const ratio = (a: string, b: string) => {
        const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
      };
      const surface = getComputedStyle(
        document.querySelector(surfaceSelector) as HTMLElement
      ).backgroundColor;
      // A transparent surface would make the contrast meaningless (the colour behind it is unknown).
      if (surface === 'rgba(0, 0, 0, 0)') throw new Error(`${surfaceSelector} has no background`);
      return {
        outline: {
          width: style.outlineWidth,
          style: style.outlineStyle,
          color: style.outlineColor,
          offset: style.outlineOffset,
        },
        shadow: style.boxShadow,
        tokenColor,
        vsFill: ratio(style.outlineColor, style.backgroundColor),
        vsSurface: ratio(style.outlineColor, surface),
      };
    },
    { token, surfaceSelector }
  );
}

/** Tab from the control before the widget onto the next focusable element (keyboard modality, so :focus-visible). */
async function tabFrom(page: Page, beforeId: string): Promise<void> {
  await page.locator(`#${beforeId}`).focus();
  await page.keyboard.press('Tab');
}

async function openWithScheme(page: Page, scheme: 'light' | 'dark', path = '/login') {
  await page.emulateMedia({ colorScheme: scheme });
  await page.goto(path);
  await waitForPageReady(page);
  expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(
    scheme === 'dark'
  );
}

for (const scheme of SCHEMES) {
  test.describe(`menu rows and select options (${scheme})`, () => {
    test.beforeEach(async ({ page }) => {
      await openWithScheme(page, scheme);
      await mount(
        page,
        `<button id="fx-before" type="button">before</button>
         <div id="fx-popup" role="menu" class="w-64 rounded-xl border bg-popover p-1">
           <div role="menuitem" tabindex="0" class="${ROW_CLASS}">Menu row</div>
           <div role="option" aria-selected="false" tabindex="0" class="${ROW_CLASS}">Select option</div>
         </div>`
      );
    });

    for (const [role, tabs] of [
      ['menuitem', 1],
      ['option', 2],
    ] as const) {
      test(`a focused ${role} shows a 2px inset --ring outline at 3:1 against its fill and the popup`, async ({
        page,
      }) => {
        await tabFrom(page, 'fx-before');
        if (tabs === 2) await page.keyboard.press('Tab');
        await expect(page.locator(`[role="${role}"]:focus-visible`)).toHaveCount(1);

        const reading = await readFocus(page, '--ring', '#fx-popup');
        expect(reading.outline).toEqual({
          width: '2px',
          style: 'solid',
          color: reading.tokenColor,
          offset: '-2px',
        });
        expect(reading.shadow).not.toMatch(/0px 0px 0px [1-9]\d*px/);
        // The fill alone is the failing indicator this story fixes; the outline must carry the 3:1. Against either
        // neighbour: a preset whose accent equals its ring (the luxury dark preset) can only contrast with the popup.
        expect(Math.max(reading.vsFill, reading.vsSurface)).toBeGreaterThanOrEqual(
          MIN_NON_TEXT_CONTRAST
        );
      });
    }

    test('an unfocused row shows no outline', async ({ page }) => {
      const outline = await page
        .locator('[role="menuitem"]')
        .evaluate((el) => getComputedStyle(el).outlineStyle);
      expect(outline).toBe('none');
    });
  });
}

/** Inverse surfaces (sidebar, featured plan) draw the proxy outline in --cta; normal surfaces use --ring. */
const PROXY_SURFACES = [
  { name: 'inverse surface', surface: 'on-inverse bg-feature', token: '--cta' },
  { name: 'page surface', surface: 'bg-background', token: '--ring' },
] as const;

for (const scheme of SCHEMES) {
  for (const { name, surface, token } of PROXY_SURFACES) {
    test(`focus-proxy outline uses ${token} at 3:1 on the ${name} (${scheme})`, async ({
      page,
    }) => {
      await openWithScheme(page, scheme);
      await mount(
        page,
        `<button id="fx-before" type="button">before</button>
         <div id="fx-surface" class="${surface} p-6">
           <label class="relative flex min-h-11 items-center gap-3 px-3"><input type="checkbox" class="peer sr-only" />Card</label>
           <article class="focus-proxy relative p-4"><a href="#fx" class="after:absolute after:inset-0 focus-visible:outline-none">Link</a></article>
         </div>`
      );

      await tabFrom(page, 'fx-before');
      for (const control of ['label card', 'article card']) {
        const reading = await readFocus(page, token, '#fx-surface');
        expect(reading.outline, `${control} outline`).toEqual({
          width: '3px',
          style: 'solid',
          color: reading.tokenColor,
          offset: '2px',
        });
        expect(reading.vsSurface, `${control} against the surface`).toBeGreaterThanOrEqual(
          MIN_NON_TEXT_CONTRAST
        );
        await page.keyboard.press('Tab');
      }
    });
  }
}

test.describe('forced colors', () => {
  test.beforeEach(async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'forced colors emulation is Chromium/Firefox only');
    await page.emulateMedia({ forcedColors: 'active', colorScheme: 'light' });
    await page.goto('/freebies');
    await waitForPageReady(page);
    // Both tests rest on this premise; without it they would pass vacuously.
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
  });

  test('the menu row outline survives; a box-shadow ring does not', async ({ page }) => {
    await mount(
      page,
      `<button id="fx-before" type="button">before</button>
       <div role="menu" class="w-64 p-1">
         <div role="menuitem" tabindex="0" class="${ROW_CLASS}">Menu row</div>
       </div>
       <button id="fx-ring" type="button" style="box-shadow: 0 0 0 3px rgb(255, 0, 0)">Ring</button>`
    );

    await tabFrom(page, 'fx-before');
    const row = await page.locator('[role="menuitem"]:focus-visible').evaluate((el) => {
      const s = getComputedStyle(el);
      return { width: s.outlineWidth, style: s.outlineStyle, color: s.outlineColor };
    });
    expect(row).toMatchObject({ width: '2px', style: 'solid' });
    expect(row.color).not.toBe(TRANSPARENT);
    // The premise of the rule: forced colors drop shadows, so only an outline can carry a focus indicator.
    const shadow = await page.locator('#fx-ring').evaluate((el) => getComputedStyle(el).boxShadow);
    expect(shadow).toBe('none');
  });

  test('an offer card shows one outline: the card draws it and the stretched link none', async ({
    page,
  }) => {
    const link = page.locator('article a').first();
    await link.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();

    const outlines = await link.evaluate((el) => {
      const read = (node: Element) => {
        const s = getComputedStyle(node);
        return { width: s.outlineWidth, style: s.outlineStyle, color: s.outlineColor };
      };
      return { link: read(el), card: read(el.closest('article') as HTMLElement) };
    });
    expect(outlines.card).toMatchObject({ width: '3px', style: 'solid' });
    expect(outlines.card.color).not.toBe(TRANSPARENT);
    expect(outlines.link.style).toBe('none');
  });
});

/**
 * Browsers with :focus-visible but without :has() (Chrome 86-104, Firefox 85-120) drop the proxy rules. Chromium here
 * supports :has(), so the old browser is simulated on the real pages: the proxy `:has()` rules are removed from the
 * live stylesheet and the `@supports not selector(:has(*))` blocks are applied unconditionally.
 */
test.describe('without :has()', () => {
  const OUTLINE = { width: '3px', style: 'solid', offset: '2px' };
  const CONTROLS = [
    ['checkbox', 'input.peer.sr-only[type="checkbox"]'],
    ['radio', 'input.peer.sr-only[type="radio"]'],
  ] as const;

  /** Removes only the proxy selectors (label with an sr-only child, focus-proxy article) and applies the fallbacks. */
  async function simulateNoHas(page: Page) {
    await page.evaluate(() => {
      const isProxyRule = (selector: string) =>
        /label:has\(> \.sr-only|article\.focus-proxy:has\(/.test(selector);
      for (const sheet of Array.from(document.styleSheets)) {
        for (const rule of Array.from(sheet.cssRules)) {
          if (rule instanceof CSSSupportsRule && /not.*selector\(:has\(/.test(rule.conditionText)) {
            for (const inner of Array.from(rule.cssRules)) {
              sheet.insertRule(inner.cssText, sheet.cssRules.length);
            }
          }
        }
        for (let i = sheet.cssRules.length - 1; i >= 0; i--) {
          const rule = sheet.cssRules[i];
          if (rule instanceof CSSStyleRule && isProxyRule(rule.selectorText)) sheet.deleteRule(i);
        }
      }
    });
  }

  async function focusFirst(page: Page, input: string) {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/alerts');
    await waitForPageReady(page);
    test.skip(
      (await page.locator('input[type="checkbox"]').count()) === 0,
      'the alerts form only renders when the server runs with ALERTS_FORM_LIVE=true'
    );
    await page.locator(input).first().focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(page.locator(`${input}:focus-visible`)).toBeFocused();
  }

  const outlineOf = (page: Page, selector: string) =>
    page.locator(selector).evaluate((el) => {
      const s = getComputedStyle(el);
      return { width: s.outlineWidth, style: s.outlineStyle, offset: s.outlineOffset };
    });

  for (const [kind, input] of CONTROLS) {
    const focused = `${input}:focus-visible`;

    test(`with :has() the ${kind} card draws one outline and the fallback stays off`, async ({
      page,
    }) => {
      await focusFirst(page, input);

      expect(await outlineOf(page, `label:has(> ${focused})`)).toEqual(OUTLINE);
      expect((await outlineOf(page, `${focused} + *`)).style).toBe('none');
    });

    test(`without :has() the ${kind} keeps a 3px outline through peer-focus-visible`, async ({
      page,
    }) => {
      await focusFirst(page, input);
      await simulateNoHas(page);

      const label = await page
        .locator(focused)
        .evaluate((el) => getComputedStyle(el.closest('label') as HTMLElement).outlineStyle);
      expect(label).toBe('none');
      expect(await outlineOf(page, `${focused} + *`)).toEqual(OUTLINE);
    });
  }

  test('without :has() the stretched offer link draws its own 3px outline and the card none', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/freebies');
    await waitForPageReady(page);
    const link = page.locator('article.focus-proxy a').first();
    await simulateNoHas(page);
    await link.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();

    expect(await outlineOf(page, 'article.focus-proxy a:focus-visible')).toEqual(OUTLINE);
    expect((await outlineOf(page, 'article.focus-proxy:has(a:focus-visible)')).style).toBe('none');
  });
});
