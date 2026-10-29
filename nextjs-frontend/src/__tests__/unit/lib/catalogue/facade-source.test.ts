// @vitest-environment node
/** The facade picks its source per call from CATALOGUE_SOURCE and passes outages through. */
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const fn = () => vi.fn();
  return {
    api: {
      getToday: fn(),
      getCategories: fn(),
      getCategoryBySlug: fn(),
      getMerchants: fn(),
      getMerchantBySlug: fn(),
      lookupOffer: fn(),
      getLiveOffers: fn(),
      getFeaturedOffers: fn(),
      searchOffers: fn(),
      getRelatedOffers: fn(),
    },
  };
});
vi.mock('@/lib/catalogue/api-source', () => ({ apiSource: mocks.api }));

import {
  CatalogueUnavailableError,
  DEFAULT_QUERY,
  getCatalogueSource,
  getCategories,
  getCategoryBySlug,
  getFeaturedOffers,
  getLiveOffers,
  getMerchantBySlug,
  getMerchants,
  getRelatedOffers,
  getToday,
  lookupOffer,
  searchOffers,
  settle,
} from '@/lib/catalogue';
import { FIXTURE_TODAY, OFFERS } from '@/lib/catalogue/fixtures';

afterEach(() => {
  vi.unstubAllEnvs();
  for (const mock of Object.values(mocks.api)) mock.mockReset();
});

describe('getCatalogueSource', () => {
  it('says fixture under test and api when CATALOGUE_SOURCE=api, whatever is live', async () => {
    expect(await getCatalogueSource()).toBe('fixture');

    vi.stubEnv('CATALOGUE_SOURCE', 'api');
    expect(await getCatalogueSource()).toBe('api');
    expect(mocks.api.getLiveOffers).not.toHaveBeenCalled();
  });
});

describe('with CATALOGUE_SOURCE=api', () => {
  it('answers every read from the API source', async () => {
    vi.stubEnv('CATALOGUE_SOURCE', 'api');
    const offer = OFFERS[0];
    mocks.api.getToday.mockResolvedValue('2026-11-02');
    mocks.api.getCategories.mockResolvedValue([{ slug: 'pets' }]);
    mocks.api.getCategoryBySlug.mockResolvedValue({ slug: 'pets' });
    mocks.api.getMerchants.mockResolvedValue([]);
    mocks.api.getMerchantBySlug.mockResolvedValue(null);
    mocks.api.lookupOffer.mockResolvedValue({ kind: 'found', offer });
    mocks.api.getLiveOffers.mockResolvedValue([offer]);
    mocks.api.getFeaturedOffers.mockResolvedValue([offer]);
    mocks.api.searchOffers.mockResolvedValue({ total: 1 });
    mocks.api.getRelatedOffers.mockResolvedValue([offer]);

    expect(await getToday()).toBe('2026-11-02');
    expect(await getCategories()).toEqual([{ slug: 'pets' }]);
    expect(await getCategoryBySlug('pets')).toEqual({ slug: 'pets' });
    expect(await getMerchants()).toEqual([]);
    expect(await getMerchantBySlug('x')).toBeNull();
    expect(await lookupOffer('a')).toEqual({ kind: 'found', offer });
    expect(await getLiveOffers()).toEqual([offer]);
    expect(await getFeaturedOffers()).toEqual([offer]);
    expect(await searchOffers(DEFAULT_QUERY)).toEqual({ total: 1 });
    expect(await getRelatedOffers(offer)).toEqual([offer]);
    expect(mocks.api.getFeaturedOffers).toHaveBeenCalledWith(8);
    expect(mocks.api.getRelatedOffers).toHaveBeenCalledWith(offer, 4);
  });

  it('does not touch the fixtures', async () => {
    vi.stubEnv('CATALOGUE_SOURCE', 'api');
    mocks.api.getToday.mockResolvedValue('2026-11-02');

    expect(await getToday()).not.toBe(FIXTURE_TODAY);
  });

  it('passes an outage through for the page to turn into an error state', async () => {
    vi.stubEnv('CATALOGUE_SOURCE', 'api');
    mocks.api.getCategories.mockRejectedValue(new CatalogueUnavailableError());

    await expect(getCategories()).rejects.toBeInstanceOf(CatalogueUnavailableError);
    expect(await settle(getCategories())).toEqual({ ok: false });
  });
});

describe('with the fixtures', () => {
  it('never calls the API source', async () => {
    await getCategories();
    await searchOffers(DEFAULT_QUERY);
    await lookupOffer('glow-boosting-face-cream-sample');
    await getRelatedOffers(OFFERS[0]);

    for (const mock of Object.values(mocks.api)) expect(mock).not.toHaveBeenCalled();
  });

  it('ignores a category in the URL that the fixtures do not have', async () => {
    const everything = await searchOffers(DEFAULT_QUERY);
    const unknown = await searchOffers({ ...DEFAULT_QUERY, category: 'cars' });

    expect(unknown.total).toBe(everything.total);
  });
});

describe('settle', () => {
  it('returns the data of a successful read', async () => {
    expect(await settle(Promise.resolve(42))).toEqual({ ok: true, data: 42 });
  });

  it('turns only a catalogue outage into a failure', async () => {
    expect(await settle(Promise.reject(new CatalogueUnavailableError()))).toEqual({ ok: false });
    await expect(settle(Promise.reject(new Error('bug')))).rejects.toThrow('bug');
  });
});
