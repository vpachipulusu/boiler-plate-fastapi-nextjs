/**
 * The offer row menu, the edit page's lifecycle buttons and the category/merchant toggle: which steps each
 * status offers, the archive confirmation, and how an outcome is announced.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  offerLifecycleAction: vi.fn(),
  setCategoryEnabledAction: vi.fn(),
  setMerchantActiveAction: vi.fn(),
  toast: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/app/actions/admin/offer-actions', () => ({
  offerLifecycleAction: mocks.offerLifecycleAction,
}));
vi.mock('@/app/actions/admin/category-actions', () => ({
  setCategoryEnabledAction: mocks.setCategoryEnabledAction,
}));
vi.mock('@/app/actions/admin/merchant-actions', () => ({
  setMerchantActiveAction: mocks.setMerchantActiveAction,
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }),
}));

import { OfferRowActions } from '@/app/(admin)/admin/offers/_components/offer-row-actions';
import { OfferLifecycleButtons } from '@/app/(admin)/admin/offers/_components/offer-lifecycle-buttons';
import { StateToggleButton } from '@/app/(admin)/admin/_components/state-toggle-button';

const ok = { success: true as const, data: {} };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.offerLifecycleAction.mockResolvedValue(ok);
  mocks.setCategoryEnabledAction.mockResolvedValue(ok);
  mocks.setMerchantActiveAction.mockResolvedValue(ok);
});

async function openMenu(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(screen.getByRole('button', { name: `Open menu for ${title}` }));
  return screen.findByRole('menu');
}

describe('OfferRowActions', () => {
  it.each([
    ['DRAFT', ['Edit', 'Mark verified', 'Publish', 'Archive']],
    ['PUBLISHED', ['Edit', 'Mark verified', 'Unpublish', 'Expire', 'Archive']],
    ['EXPIRED', ['Edit', 'Mark verified', 'Publish', 'Archive']],
    ['ARCHIVED', ['Edit']],
  ])('offers the right steps for a %s offer', async (status, expected) => {
    const user = userEvent.setup();
    render(<OfferRowActions offerId="o1" offerTitle="Free coffee" status={status as 'DRAFT'} />);

    const menu = await openMenu(user, 'Free coffee');

    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual(expected);
    expect(within(menu).getByRole('menuitem', { name: 'Edit' })).toHaveAttribute(
      'href',
      '/admin/offers/o1'
    );
  });

  it('runs a step through the server action, announces it and refreshes', async () => {
    const user = userEvent.setup();
    render(<OfferRowActions offerId="o1" offerTitle="Free coffee" status="DRAFT" />);

    await openMenu(user, 'Free coffee');
    await user.click(screen.getByRole('menuitem', { name: 'Mark verified' }));

    await waitFor(() => expect(mocks.offerLifecycleAction).toHaveBeenCalledWith('o1', 'verify'));
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith({
        title: 'Offer marked as verified',
        description: 'Free coffee',
      })
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('shows the curated reason in a destructive toast when a step is refused', async () => {
    mocks.offerLifecycleAction.mockResolvedValue({
      success: false,
      error: 'This offer cannot be published yet: it has not been verified.',
    });
    const user = userEvent.setup();
    render(<OfferRowActions offerId="o1" offerTitle="Free coffee" status="DRAFT" />);

    await openMenu(user, 'Free coffee');
    await user.click(screen.getByRole('menuitem', { name: 'Publish' }));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: 'Could not publish',
        description: 'This offer cannot be published yet: it has not been verified.',
      })
    );
  });

  it('asks before archiving, and archives only after confirmation', async () => {
    const user = userEvent.setup();
    render(<OfferRowActions offerId="o1" offerTitle="Free coffee" status="PUBLISHED" />);

    await openMenu(user, 'Free coffee');
    await user.click(screen.getByRole('menuitem', { name: 'Archive' }));

    const dialog = await screen.findByRole('dialog', { name: 'Archive this offer?' });
    expect(mocks.offerLifecycleAction).not.toHaveBeenCalled();
    expect(within(dialog).getByText(/cannot be undone/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(mocks.offerLifecycleAction).not.toHaveBeenCalled();

    await openMenu(user, 'Free coffee');
    await user.click(screen.getByRole('menuitem', { name: 'Archive' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Archive offer' })
    );
    await waitFor(() => expect(mocks.offerLifecycleAction).toHaveBeenCalledWith('o1', 'archive'));
  });
});

describe('a server action call that throws', () => {
  it('toasts a curated failure instead of crashing', async () => {
    mocks.offerLifecycleAction.mockRejectedValue(new Error('SECRET'));
    const user = userEvent.setup();
    render(<OfferLifecycleButtons offerId="o1" offerTitle="Free coffee" status="DRAFT" />);
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: 'Could not publish',
        description: 'Something went wrong. Please try again.',
      })
    );
  });
});

describe('OfferLifecycleButtons', () => {
  it('shows the steps as buttons in a named group', () => {
    render(<OfferLifecycleButtons offerId="o1" offerTitle="Free coffee" status="PUBLISHED" />);
    const group = screen.getByRole('group', { name: 'Offer status actions' });
    expect(
      within(group)
        .getAllByRole('button')
        .map((b) => b.textContent)
    ).toEqual(['Mark verified', 'Unpublish', 'Expire', 'Archive']);
  });

  it('publishes through the server action', async () => {
    const user = userEvent.setup();
    render(<OfferLifecycleButtons offerId="o1" offerTitle="Free coffee" status="EXPIRED" />);
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(mocks.offerLifecycleAction).toHaveBeenCalledWith('o1', 'publish'));
  });

  it('says an archived offer cannot change and offers no button', () => {
    render(<OfferLifecycleButtons offerId="o1" offerTitle="Free coffee" status="ARCHIVED" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/archived and cannot be changed/)).toBeInTheDocument();
  });
});

describe('StateToggleButton', () => {
  it('disables an enabled category and names it for screen readers', async () => {
    const user = userEvent.setup();
    render(<StateToggleButton kind="category" id="c1" name="Beauty" on />);

    await user.click(screen.getByRole('button', { name: 'Disable Beauty' }));

    await waitFor(() => expect(mocks.setCategoryEnabledAction).toHaveBeenCalledWith('c1', false));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ title: 'Beauty disabled' }));
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('activates an inactive merchant', async () => {
    const user = userEvent.setup();
    render(<StateToggleButton kind="merchant" id="m1" name="Acme" on={false} />);

    await user.click(screen.getByRole('button', { name: 'Activate Acme' }));

    await waitFor(() => expect(mocks.setMerchantActiveAction).toHaveBeenCalledWith('m1', true));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ title: 'Acme activated' }));
  });

  it('reports a refusal with the curated message', async () => {
    mocks.setCategoryEnabledAction.mockResolvedValue({
      success: false,
      error: 'You do not have permission to do that',
    });
    const user = userEvent.setup();
    render(<StateToggleButton kind="category" id="c1" name="Beauty" on />);

    await user.click(screen.getByRole('button', { name: 'Disable Beauty' }));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: 'Could not change Beauty',
        description: 'You do not have permission to do that',
      })
    );
  });
});
