/**
 * Keyboard-focus indicator for Radix roving-focus items (menu rows, select options). The `focus:bg-accent` fill
 * alone is mint on white (1.16:1; WCAG 1.4.11 asks 3:1), so the row also gets a 2px outline in the theme `--ring`
 * token, drawn inside the row (negative offset) so neighbouring rows and the popup edge do not clip it. In the
 * freejoy preset the outline is at least 3:1 against both the fill and the popup; a preset whose accent equals its
 * ring would rely on the popup contrast alone, which is why the e2e check asks for 3:1 against either.
 *
 * Applied under `focus-visible`, so it marks keyboard focus. Radix also moves DOM focus to the row under the pointer
 * (pointermove), and once the browser counts that as keyboard-modality focus (after keyboard navigation, in
 * Chromium also on first hover) the outline follows the pointer too. That is platform behaviour, left as is.
 *
 * The arbitrary-property form is deliberate: tailwind-merge in `cn()` drops a plain `outline` (style) utility that
 * sits next to a width utility, so the plain-utility spelling never reaches the DOM.
 */
export const MENU_ITEM_FOCUS =
  'focus-visible:[outline:2px_solid_hsl(var(--ring))] focus-visible:-outline-offset-2';
