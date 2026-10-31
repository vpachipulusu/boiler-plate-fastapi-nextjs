import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('@/app/actions/alerts-actions', () => ({ subscribeToAlertsAction: vi.fn() }));

// Each test re-imports the page and the catalogue; that is slow when the whole suite runs in parallel.
vi.setConfig({ testTimeout: 30_000 });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadPage(live: boolean) {
  vi.stubEnv('ALERTS_FORM_LIVE', live ? 'true' : '');
  vi.resetModules();
  return import('@/app/(public)/alerts/page');
}

/** Metadata is built per request, so the switch is read when it is asked for, not when the module loads. */
async function robotsFor(live: boolean) {
  const { generateMetadata } = await loadPage(live);
  return (await generateMetadata()).robots;
}

describe('alerts page switch (ALERTS_FORM_LIVE)', () => {
  it('shows the form with one checkbox per category and starts empty when the switch is true', async () => {
    const { default: AlertsPage } = await loadPage(true);

    render(await AlertsPage());

    const group = screen.getByRole('group', { name: /interested in/i });
    expect(within(group).getAllByRole('checkbox')).toHaveLength(6);
    expect(screen.getByLabelText(/email address/i)).toHaveValue('');
    expect(screen.queryByText(/alerts aren.t open yet/i)).toBeNull();
  });

  it('is indexable only when the switch is true', async () => {
    expect(await robotsFor(true)).not.toEqual({ index: false });
    expect(await robotsFor(false)).toEqual({ index: false });
  });

  it.each(['', 'false', '1', 'TRUE'])('stays closed for ALERTS_FORM_LIVE=%j', async (value) => {
    vi.stubEnv('ALERTS_FORM_LIVE', value);
    vi.resetModules();
    const { default: AlertsPage } = await import('@/app/(public)/alerts/page');

    render(await AlertsPage());

    expect(screen.getByText(/alerts aren.t open yet/i)).toBeInTheDocument();
  });
});
