import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { MENU_ITEM_FOCUS } from '@/components/ui/menu-item-focus';

/**
 * FREEJ-35 (WCAG 1.4.11): Radix roving-focus rows keep the `focus:bg-accent` fill (mint on white is 1.16:1) and add
 * a 2px inset --ring outline on keyboard focus. The class contract is checked here; the computed style and the 3:1
 * ratio are checked in the browser (touch-targets.spec.ts).
 */

// Radix Select measures and scrolls its listbox; jsdom has neither.
window.HTMLElement.prototype.scrollIntoView = () => {};
window.HTMLElement.prototype.hasPointerCapture = () => false;
window.HTMLElement.prototype.releasePointerCapture = () => {};
window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const OUTLINE_UTILITIES = [
  'focus-visible:[outline:2px_solid_hsl(var(--ring))]',
  'focus-visible:-outline-offset-2',
];

function expectKeyboardOutline(row: HTMLElement) {
  expect(row).toHaveClass(...OUTLINE_UTILITIES);
  // The fill stays; the outline is not switched off or replaced by a ring.
  expect(row.className).toMatch(/(^|\s)focus:bg-accent(\s|$)/);
  expect(row.className).not.toMatch(/outline-(none|0|transparent|hidden)/);
  expect(row.className).not.toMatch(/(^|[\s:])ring(-|\s|$)/);
  // Not on mere hover or highlight: the outline marks keyboard focus only.
  expect(row.className).not.toMatch(/(hover|data-\[highlighted\]):(outline|-outline)/);
}

describe('MENU_ITEM_FOCUS', () => {
  it('is the 2px inset --ring outline under focus-visible, in the form tailwind-merge keeps', () => {
    expect(MENU_ITEM_FOCUS.split(' ')).toEqual(OUTLINE_UTILITIES);
  });
});

describe('DropdownMenu rows', () => {
  it('give every kind of row the keyboard outline and keep the fill', () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Plain item</DropdownMenuItem>
          <DropdownMenuCheckboxItem checked>Checkbox item</DropdownMenuCheckboxItem>
          <DropdownMenuRadioGroup value="a">
            <DropdownMenuRadioItem value="a">Radio item</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Sub trigger</DropdownMenuSubTrigger>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    for (const name of ['Plain item', 'Checkbox item', 'Radio item', 'Sub trigger']) {
      expectKeyboardOutline(screen.getByText(name).closest<HTMLElement>('[role^="menu"]')!);
    }
  });

  it('keeps a consumer className without dropping the outline (tailwind-merge)', () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    const row = screen.getByRole('menuitem', { name: 'Delete' });
    expect(row).toHaveClass('text-destructive');
    expectKeyboardOutline(row);
  });
});

describe('Select options', () => {
  it('give the option the keyboard outline and keep the fill', () => {
    render(
      <Select open value="a">
        <SelectTrigger>Pick</SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
          <SelectItem value="b">Option B</SelectItem>
        </SelectContent>
      </Select>
    );

    for (const option of screen.getAllByRole('option')) expectKeyboardOutline(option);
  });
});
