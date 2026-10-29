// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('next/cache', () => ({
  revalidateTag: mocks.revalidateTag,
  revalidatePath: mocks.revalidatePath,
  unstable_cache: (fn: unknown) => fn,
}));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn() } }));

import { revalidateCatalogue } from '@/lib/catalogue/revalidate';

beforeEach(() => {
  mocks.revalidateTag.mockClear();
  mocks.revalidatePath.mockClear();
});

describe('revalidateCatalogue', () => {
  it('expires the catalogue tag immediately', () => {
    revalidateCatalogue();

    expect(mocks.revalidateTag).toHaveBeenCalledTimes(1);
    expect(mocks.revalidateTag).toHaveBeenCalledWith('catalogue', { expire: 0 });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('also revalidates each path it is given', () => {
    revalidateCatalogue(['/freebies/free-tea', '/']);

    expect(mocks.revalidateTag).toHaveBeenCalledWith('catalogue', { expire: 0 });
    expect(mocks.revalidatePath.mock.calls).toEqual([['/freebies/free-tea'], ['/']]);
  });

  it('accepts a path of letters, digits and the unreserved characters, up to 256 long', () => {
    revalidateCatalogue(['/a-b_c.d~e/f', `/${'a'.repeat(255)}`]);

    expect(mocks.revalidatePath).toHaveBeenCalledTimes(2);
  });

  it.each([
    'freebies/oops',
    '',
    '/freebies/../admin',
    '/freebies?x=1',
    '/freebies#top',
    '/free bies',
    '/freebies	',
    '//..',
    '/freebies/%2e%2e/admin',
    '/a\u0000b',
    '/a\\b',
    '/café',
    `/${'a'.repeat(256)}`,
  ])('rejects %j before changing anything', (path) => {
    expect(() => revalidateCatalogue(['/ok', path])).toThrow(TypeError);

    expect(mocks.revalidateTag).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
