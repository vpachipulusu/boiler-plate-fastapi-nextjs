import { describe, expect, it } from 'vitest';
import { CATEGORIES, FIXTURE_TODAY, MERCHANTS, OFFERS } from '@/lib/catalogue/fixtures';
import { OFFER_TYPES, type Freshness, type OfferType } from '@/lib/catalogue/types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const countType = (offerType: OfferType): number =>
  OFFERS.filter((offer) => offer.offerType === offerType).length;

describe('FIXTURE_TODAY', () => {
  it('is a fixed ISO date', () => {
    expect(FIXTURE_TODAY).toBe('2026-10-29');
  });
});

describe('CATEGORIES', () => {
  it('contains the six launch categories in sort order', () => {
    // Arrange
    const slugs = CATEGORIES.map((category) => category.slug);

    // Assert
    expect(slugs).toEqual([
      'beauty',
      'food-drink',
      'home-cleaning',
      'baby-kids',
      'pets',
      'health-wellness',
    ]);
    expect(CATEGORIES.map((category) => category.sortOrder)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('uses the short names and tints from the design', () => {
    expect(CATEGORIES.map((category) => category.shortName)).toEqual([
      'Beauty',
      'Food & drink',
      'Home',
      'Baby & kids',
      'Pets',
      'Health',
    ]);
    expect(CATEGORIES.map((category) => category.tint)).toEqual([
      'blush',
      'mint',
      'butter',
      'lavender',
      'sky',
      'sage',
    ]);
  });

  it('enables every category and gives each a description and an intro', () => {
    for (const category of CATEGORIES) {
      expect(category.enabled).toBe(true);
      expect(category.description.length).toBeGreaterThan(20);
      expect(category.intro.length).toBeGreaterThan(40);
    }
  });

  it('makes no claims about counts or verification in category copy', () => {
    for (const category of CATEGORIES) {
      expect(`${category.description} ${category.intro}`).not.toMatch(/\d|verified/i);
    }
  });
});

describe('MERCHANTS', () => {
  it('contains the eight fictional brands without logos', () => {
    expect(MERCHANTS.map((merchant) => [merchant.slug, merchant.name])).toEqual([
      ['soft-kind', 'Soft & Kind'],
      ['good-beans', 'Good Beans'],
      ['happy-paws', 'Happy Paws'],
      ['glow-club', 'Glow Club'],
      ['little-bites', 'Little Bites'],
      ['fresh-home', 'Fresh Home'],
      ['tiny-days', 'Tiny Days'],
      ['tea-time', 'Tea Time'],
    ]);
    expect(MERCHANTS.every((merchant) => merchant.logoUrl === null)).toBe(true);
  });
});

describe('OFFERS identity', () => {
  it('has exactly 24 offers with sequential ids', () => {
    expect(OFFERS).toHaveLength(24);
    expect(OFFERS.map((offer) => offer.id)).toEqual(
      Array.from({ length: 24 }, (_, index) => `offer-${String(index + 1).padStart(2, '0')}`)
    );
  });

  it('has unique kebab-case slugs', () => {
    const slugs = OFFERS.map((offer) => offer.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(KEBAB_CASE);
  });

  it('resolves every category and merchant reference', () => {
    const categorySlugs = new Set(CATEGORIES.map((category) => category.slug));
    const merchantSlugs = new Set(MERCHANTS.map((merchant) => merchant.slug));

    for (const offer of OFFERS) {
      expect(categorySlugs.has(offer.categorySlug)).toBe(true);
      expect(merchantSlugs.has(offer.merchantSlug)).toBe(true);
    }
  });

  it('includes the design titles with their merchants and categories', () => {
    const find = (title: string) => OFFERS.find((offer) => offer.title === title);

    expect(find('Glow-boosting face cream sample')).toMatchObject({
      merchantSlug: 'soft-kind',
      categorySlug: 'beauty',
    });
    expect(find('Coffee discovery pack')).toMatchObject({
      merchantSlug: 'good-beans',
      categorySlug: 'food-drink',
    });
    expect(find('Treats for happy pups')).toMatchObject({
      merchantSlug: 'happy-paws',
      categorySlug: 'pets',
    });
    expect(find('Mini hydrating lip balm')).toMatchObject({
      merchantSlug: 'glow-club',
      categorySlug: 'beauty',
    });
    expect(find('Crunchy snack selection')).toMatchObject({
      merchantSlug: 'little-bites',
      categorySlug: 'food-drink',
      offerType: 'voucher',
    });
    expect(find('Fresh home cleanser trial')).toMatchObject({
      merchantSlug: 'fresh-home',
      categorySlug: 'home-cleaning',
      offerType: 'free_trial',
    });
    expect(find('Gentle baby wash sample')).toMatchObject({
      merchantSlug: 'tiny-days',
      categorySlug: 'baby-kids',
    });
    expect(find('Everyday tea tasting kit')).toMatchObject({
      merchantSlug: 'tea-time',
      categorySlug: 'food-drink',
    });
  });
});

describe('OFFERS coverage', () => {
  it('represents all five offer types with the required minimums', () => {
    for (const offerType of OFFER_TYPES) expect(countType(offerType)).toBeGreaterThan(0);
    expect(countType('free_sample')).toBeGreaterThanOrEqual(10);
    expect(countType('free_trial')).toBeGreaterThanOrEqual(4);
    expect(countType('cashback')).toBeGreaterThanOrEqual(3);
    expect(countType('voucher')).toBeGreaterThanOrEqual(4);
    expect(countType('competition')).toBeGreaterThanOrEqual(3);
  });

  it('gives every category at least three offers', () => {
    for (const category of CATEGORIES) {
      const count = OFFERS.filter((offer) => offer.categorySlug === category.slug).length;
      expect(count).toBeGreaterThanOrEqual(3);
    }
  });

  it('features at least eight offers', () => {
    expect(OFFERS.filter((offer) => offer.featured).length).toBeGreaterThanOrEqual(8);
  });

  it('never features an expired or draft offer', () => {
    const featuredInactive = OFFERS.filter(
      (offer) => offer.featured && offer.status !== 'published'
    );

    expect(featuredInactive).toEqual([]);
  });

  it('has exactly two expired offers that ended before the fixture date and one draft', () => {
    const expired = OFFERS.filter((offer) => offer.status === 'expired');
    const drafts = OFFERS.filter((offer) => offer.status === 'draft');
    const published = OFFERS.filter((offer) => offer.status === 'published');

    expect(expired).toHaveLength(2);
    for (const offer of expired) {
      expect(offer.endAt).not.toBeNull();
      expect((offer.endAt as string) < FIXTURE_TODAY).toBe(true);
    }
    expect(drafts).toHaveLength(1);
    expect(published).toHaveLength(21);
  });

  it('keeps every published offer open on the fixture date', () => {
    for (const offer of OFFERS.filter((entry) => entry.status === 'published')) {
      expect(offer.endAt === null || offer.endAt >= FIXTURE_TODAY).toBe(true);
    }
  });

  it('covers the postage variants', () => {
    const cost = OFFERS.filter((offer) => offer.postage.kind === 'cost');
    const checkTerms = OFFERS.filter((offer) => offer.postage.kind === 'check_terms');
    const free = OFFERS.filter((offer) => offer.postage.kind === 'free');

    expect(cost.length).toBeGreaterThanOrEqual(3);
    expect(checkTerms.length).toBeGreaterThanOrEqual(4);
    expect(free.length).toBeGreaterThan(0);
    for (const offer of cost) {
      expect(offer.postage).toMatchObject({ currency: 'GBP' });
      expect([199, 299, 349]).toContain(
        offer.postage.kind === 'cost' ? offer.postage.amountMinor : 0
      );
    }
  });

  it('spreads freshness across all five labels plus null', () => {
    const labels = new Set<Freshness | null>(OFFERS.map((offer) => offer.freshness));

    expect(labels).toEqual(
      new Set<Freshness | null>([
        'new_today',
        'just_added',
        'popular',
        'ends_soon',
        'limited',
        null,
      ])
    );
  });
});

describe('OFFERS trust and wording rules', () => {
  it('requires a card and spells out subscription terms for every free trial', () => {
    const trials = OFFERS.filter((offer) => offer.offerType === 'free_trial');

    expect(trials.length).toBeGreaterThan(0);
    for (const trial of trials) {
      expect(trial.requiresCard).toBe(true);
      expect(trial.subscriptionTerms).toMatch(/\d+ days/);
      expect(trial.subscriptionTerms).toMatch(/cancel/i);
    }
  });

  it('does not ask for a card or state subscription terms on non-trial offers', () => {
    for (const offer of OFFERS.filter((entry) => entry.offerType !== 'free_trial')) {
      expect(offer.requiresCard).toBe(false);
      expect(offer.subscriptionTerms).toBeNull();
    }
  });

  it('explains in cashback descriptions that the visitor pays first and is refunded', () => {
    const cashback = OFFERS.filter((offer) => offer.offerType === 'cashback');

    for (const offer of cashback) {
      expect(offer.description.join(' ')).toMatch(/pay/i);
      expect(offer.description.join(' ')).toMatch(/refund/i);
    }
  });

  it('states the closing date in every competition availability', () => {
    for (const offer of OFFERS.filter((entry) => entry.offerType === 'competition')) {
      expect(offer.availability).toMatch(/\d{1,2} \w+ 2026/);
    }
  });

  it('mentions UK residency in eligibility and 18+ for competitions and trials', () => {
    for (const offer of OFFERS) {
      expect(offer.eligibility).toMatch(/UK/);
      if (offer.offerType === 'competition' || offer.offerType === 'free_trial') {
        expect(offer.eligibility).toMatch(/18 or over/);
      }
    }
  });

  it('never calls a trial, voucher, cashback or competition completely free', () => {
    const nonSamples = OFFERS.filter((offer) => offer.offerType !== 'free_sample');

    for (const offer of nonSamples) {
      const copy = [offer.title, offer.summary, ...offer.description].join(' ');
      expect(copy).not.toMatch(/completely free/i);
    }
  });

  it('never claims verification today', () => {
    for (const offer of OFFERS) {
      const copy = [offer.title, offer.summary, offer.availability, ...offer.description].join(' ');
      expect(copy).not.toMatch(/verified today/i);
    }
  });
});

describe('OFFERS structure', () => {
  it('has three claim steps with the first titled "Check the details"', () => {
    for (const offer of OFFERS) {
      expect(offer.steps).toHaveLength(3);
      expect(offer.steps[0]?.title).toBe('Check the details');
      for (const step of offer.steps) {
        expect(step.title.length).toBeGreaterThan(0);
        expect(step.detail.length).toBeGreaterThan(0);
      }
    }
  });

  it('words the steps differently for each offer type', () => {
    const details = new Set(
      OFFER_TYPES.map((offerType) => {
        const offer = OFFERS.find((entry) => entry.offerType === offerType);
        return offer?.steps[0]?.detail;
      })
    );

    expect(details.size).toBe(OFFER_TYPES.length);
  });

  it('does not share step objects between offers', () => {
    const first = OFFERS[0];
    const second = OFFERS[1];

    expect(first?.steps[0]).not.toBe(second?.steps[0]);
  });

  it('has two or three short description paragraphs', () => {
    for (const offer of OFFERS) {
      expect(offer.description.length).toBeGreaterThanOrEqual(2);
      expect(offer.description.length).toBeLessThanOrEqual(3);
    }
  });

  it('keeps image labels to two or three words and gives each illustration alt text', () => {
    for (const offer of OFFERS) {
      const words = offer.image.label.trim().split(/\s+/);
      expect(words.length).toBeGreaterThanOrEqual(2);
      expect(words.length).toBeLessThanOrEqual(3);
      expect(offer.image.alt.length).toBeGreaterThan(10);
    }
  });

  it('marks every offer as demo fixture data with no destination URL', () => {
    for (const offer of OFFERS) {
      expect(offer.demo).toBe(true);
      expect(offer.source).toBe('fixture');
      expect(offer.destinationUrl).toBeNull();
    }
  });

  it('uses parseable ISO dates with lastVerifiedAt between 20 and 29 October 2026', () => {
    for (const offer of OFFERS) {
      for (const value of [offer.startAt, offer.endAt, offer.lastVerifiedAt]) {
        if (value === null) continue;
        expect(value).toMatch(ISO_DATE);
        expect(Number.isNaN(Date.parse(value))).toBe(false);
      }
      expect(offer.lastVerifiedAt >= '2026-10-20').toBe(true);
      expect(offer.lastVerifiedAt <= FIXTURE_TODAY).toBe(true);
    }
  });

  it('never ends an offer before it starts', () => {
    for (const offer of OFFERS) {
      if (offer.endAt !== null) expect(offer.endAt >= offer.startAt).toBe(true);
    }
  });
});
