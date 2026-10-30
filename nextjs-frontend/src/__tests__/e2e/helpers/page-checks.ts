import { expect, type Page } from '@playwright/test';

/** The page must not scroll sideways (a 1 px rounding difference is allowed). */
export async function expectNoHorizontalOverflow(page: Page, where: string): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, `horizontal overflow on ${where}`).toBeLessThanOrEqual(1);
}
