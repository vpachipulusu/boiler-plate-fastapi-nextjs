/**
 * Keyboard-focus indicator for Radix roving-focus items (menu rows, select options). The `focus:bg-accent` fill
 * alone is mint on white (1.16:1; WCAG 1.4.11 asks 3:1), so the row also gets a 2px outline in the theme `--ring`
 * token, drawn inside the row (negative offset) so neighbouring rows and the popup edge do not clip it.
 *
 * `focus-visible` rather than `focus` or `data-[highlighted]`: Radix focuses the row under the pointer too, and the
 * outline should mark keyboard navigation, not mouse hover.
 *
 * The arbitrary-property form is deliberate: tailwind-merge in `cn()` drops a plain `outline` (style) utility that
 * sits next to `outline-2`, so `focus-visible:outline focus-visible:outline-2` never reaches the DOM.
 */
export const MENU_ITEM_FOCUS =
  'focus-visible:[outline:2px_solid_hsl(var(--ring))] focus-visible:-outline-offset-2';
