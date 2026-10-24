'use server';

import { DEFAULT_THEME } from '@/config/themes';

/**
 * The active theme name. The admin theme setting is switched off until its API exists, so
 * the root layout always renders the default theme and no database read happens here.
 */
export async function getActiveTheme(): Promise<string> {
  return DEFAULT_THEME;
}
