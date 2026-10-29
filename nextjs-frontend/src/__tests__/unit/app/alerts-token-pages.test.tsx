import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/app/actions/alerts-actions', () => ({
  confirmAlertsAction: vi.fn(),
  unsubscribeFromAlertsAction: vi.fn(),
}));

import ConfirmAlertsPage, { metadata as confirmMetadata } from '@/app/(public)/alerts/confirm/page';
import UnsubscribeAlertsPage, {
  metadata as unsubscribeMetadata,
} from '@/app/(public)/alerts/unsubscribe/page';

describe.each([
  ['confirm', confirmMetadata],
  ['unsubscribe', unsubscribeMetadata],
])('%s page metadata', (_name, metadata) => {
  it('is never indexed or followed', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('sends no referrer, so a token in the address cannot leak', () => {
    expect(metadata.referrer).toBe('no-referrer');
  });

  it('has no canonical or social URL that could repeat the token', () => {
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph).toBeUndefined();
  });
});

describe('confirm page', () => {
  it('names the step and the 24 hour window, with a button that waits to be pressed', async () => {
    render(<ConfirmAlertsPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Confirm your free alerts' })
    ).toBeInTheDocument();
    expect(screen.getByText(/works for 24 hours/i)).toBeInTheDocument();
  });
});

describe('unsubscribe page', () => {
  it('asks for one press and says what happens to the address', () => {
    render(<UnsubscribeAlertsPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Unsubscribe from Freejoy alerts' })
    ).toBeInTheDocument();
    expect(screen.getByText(/press the button/i)).toBeInTheDocument();
  });
});
