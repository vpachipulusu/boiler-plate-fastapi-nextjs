import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

const referrerPolicy = async (path: string) =>
  (await proxy(new NextRequest(`http://localhost${path}`))).headers.get('Referrer-Policy');

describe('proxy referrer policy for emailed links', () => {
  it.each(['/alerts/confirm', '/alerts/unsubscribe', '/alerts/unsubscribe/one-click'])(
    'sends no referrer from %s, where the address carries a token',
    async (path) => {
      expect(await referrerPolicy(path)).toBe('no-referrer');
    }
  );

  it.each(['/alerts', '/freebies', '/alerts/confirmation-help'])(
    'keeps the default policy elsewhere (%s)',
    async (path) => {
      expect(await referrerPolicy(path)).toBe('strict-origin-when-cross-origin');
    }
  );

  it('does not require sign-in for the alerts pages or the one-click endpoint', async () => {
    const response = await proxy(
      new NextRequest('http://localhost/alerts/unsubscribe/one-click', { method: 'POST' })
    );

    expect(response.status).toBe(200);
  });
});
