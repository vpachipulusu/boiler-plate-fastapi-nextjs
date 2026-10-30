/**
 * The category slug (for example "health-wellness") may wrap at its hyphens but never in the middle of a word.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  requireAdminPage: vi.fn(),
  fetchAdminCategories: vi.fn(),
}));

vi.mock('@/app/(admin)/admin/_lib/require-admin-page', () => ({
  requireAdminPage: mocks.requireAdminPage,
}));
vi.mock('@/lib/api/admin-categories', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/admin-categories')>(
    '@/lib/api/admin-categories'
  );
  return { ...actual, fetchAdminCategories: mocks.fetchAdminCategories };
});
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/app/(admin)/admin/_components/state-toggle-button', () => ({
  StateToggleButton: () => <button type="button">Toggle</button>,
}));

import AdminCategoriesPage from '@/app/(admin)/admin/categories/page';

describe('admin categories table slug cell', () => {
  beforeEach(() => {
    mocks.requireAdminPage.mockResolvedValue(undefined);
    mocks.fetchAdminCategories.mockResolvedValue({
      success: true,
      data: {
        total_count: 1,
        categories: [
          {
            id: 'c1',
            name: 'Health and wellness',
            slug: 'health-wellness',
            short_name: 'Health',
            description: 'Care',
            intro: 'Intro',
            tint: 'green',
            sort_order: 1,
            enabled: true,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z',
          },
        ],
      },
    });
  });

  it('wraps only at hyphens: normal word breaking, never break-all', async () => {
    render(await AdminCategoriesPage());

    const cell = screen.getByText('health-wellness');
    expect(cell.className).toContain('break-words');
    expect(cell.className).not.toContain('break-all');
    expect(cell).toHaveAttribute('data-label', 'Slug');
  });
});
