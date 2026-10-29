// @vitest-environment node
/** RFC 8058 one-click unsubscribe: a POST from a mail provider, answered with a bare status. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ unsubscribe: vi.fn() }));
vi.mock('@/app/actions/alerts-actions', () => ({
  unsubscribeFromAlertsAction: mocks.unsubscribe,
}));

import { GET, POST } from '@/app/(public)/alerts/unsubscribe/one-click/route';

const URL_BASE = 'https://freejoy.test/alerts/unsubscribe/one-click';

function post(search: string, body = 'List-Unsubscribe=One-Click') {
  return POST(
    new NextRequest(`${URL_BASE}${search}`, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  );
}

beforeEach(() => {
  mocks.unsubscribe.mockReset();
  mocks.unsubscribe.mockResolvedValue({ success: true });
});

describe('one-click POST', () => {
  it('unsubscribes with the token from the address and answers 200 with no body', async () => {
    const response = await post('?token=tok.en-1_2');

    expect(mocks.unsubscribe).toHaveBeenCalledExactlyOnceWith('tok.en-1_2');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it.each([
    ['invalid_link', 400],
    ['invalid_input', 400],
    ['rate_limited', 429],
    ['unavailable', 503],
  ])('answers %s with status %i and no body text', async (code, status) => {
    mocks.unsubscribe.mockResolvedValue({ success: false, code, error: 'curated text' });

    const response = await post('?token=tok');

    expect(response.status).toBe(status);
    expect(await response.text()).toBe('');
  });

  it('passes a missing token on, so the action refuses it', async () => {
    await post('');

    expect(mocks.unsubscribe).toHaveBeenCalledWith(null);
  });

  it.each([
    ['no body', ''],
    ['the wrong value', 'List-Unsubscribe=Unsubscribe'],
    ['an unrelated field', 'other=One-Click'],
  ])('refuses %s with 400 and never reaches the backend', async (_name, body) => {
    const response = await post('?token=tok', body);

    expect(response.status).toBe(400);
    expect(await response.text()).toBe('');
    expect(mocks.unsubscribe).not.toHaveBeenCalled();
  });

  it('refuses a body that is not a form with 400', async () => {
    const response = await POST(
      new NextRequest(`${URL_BASE}?token=tok`, {
        method: 'POST',
        body: '{"List-Unsubscribe":"One-Click"}',
        headers: { 'Content-Type': 'application/json' },
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.unsubscribe).not.toHaveBeenCalled();
  });
});

describe('one-click GET', () => {
  const get = (search: string) => GET(new NextRequest(`${URL_BASE}${search}`));

  it('sends a person to the unsubscribe page, which waits for a button press', async () => {
    const response = get('?token=tok.en-1_2');

    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe(
      'https://freejoy.test/alerts/unsubscribe?token=tok.en-1_2'
    );
    expect(mocks.unsubscribe).not.toHaveBeenCalled();
  });

  it.each(['', '?token=', '?token=has space', `?token=${'a'.repeat(513)}`, '?token=a<b'])(
    'drops a missing or odd token (%s) instead of echoing it',
    (search) => {
      const response = get(search);

      expect(response.headers.get('Location')).toBe('https://freejoy.test/alerts/unsubscribe');
    }
  );
});
