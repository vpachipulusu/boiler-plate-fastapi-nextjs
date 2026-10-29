// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { londonDate, toLondonDate } from '@/lib/catalogue/today';
import { getConfiguredSource } from '@/lib/catalogue/source';

afterEach(() => vi.unstubAllEnvs());

describe('getConfiguredSource', () => {
  it('uses the fixtures under test when nothing is set, so unit tests stay offline', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('CATALOGUE_SOURCE', '');

    expect(getConfiguredSource()).toBe('fixture');
  });

  it.each(['production', 'development'])('defaults to the API in %s', (env) => {
    vi.stubEnv('NODE_ENV', env);
    vi.stubEnv('CATALOGUE_SOURCE', '');

    expect(getConfiguredSource()).toBe('api');
  });

  it('lets CATALOGUE_SOURCE choose either source, whatever the environment', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CATALOGUE_SOURCE', 'fixture');
    expect(getConfiguredSource()).toBe('fixture');

    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('CATALOGUE_SOURCE', 'api');
    expect(getConfiguredSource()).toBe('api');
  });

  it('ignores case and whitespace', () => {
    vi.stubEnv('CATALOGUE_SOURCE', '  FIXTURE ');

    expect(getConfiguredSource()).toBe('fixture');
  });

  it('treats an unknown value as unset rather than guessing', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CATALOGUE_SOURCE', 'mock');

    expect(getConfiguredSource()).toBe('api');
  });
});

describe('londonDate', () => {
  it('is the UTC date in winter (GMT)', () => {
    expect(londonDate(new Date('2026-01-15T23:30:00Z'))).toBe('2026-01-15');
  });

  it('is already tomorrow after 23:00 UTC in summer (BST)', () => {
    expect(londonDate(new Date('2026-07-01T22:59:00Z'))).toBe('2026-07-01');
    expect(londonDate(new Date('2026-07-01T23:00:00Z'))).toBe('2026-07-02');
  });

  it('rolls over at midnight London time on the day the clocks go forward and back', () => {
    // BST starts 29 March 2026 at 01:00 UTC; it ends 25 October 2026 at 01:00 UTC.
    expect(londonDate(new Date('2026-03-28T23:59:00Z'))).toBe('2026-03-28');
    expect(londonDate(new Date('2026-03-29T00:00:00Z'))).toBe('2026-03-29');
    expect(londonDate(new Date('2026-10-24T22:59:00Z'))).toBe('2026-10-24');
    expect(londonDate(new Date('2026-10-24T23:00:00Z'))).toBe('2026-10-25');
    expect(londonDate(new Date('2026-10-25T23:59:00Z'))).toBe('2026-10-25');
  });

  it('crosses a year boundary in London time', () => {
    expect(londonDate(new Date('2026-12-31T23:59:59Z'))).toBe('2026-12-31');
    expect(londonDate(new Date('2027-01-01T00:00:00Z'))).toBe('2027-01-01');
  });
});

describe('toLondonDate', () => {
  it('converts a backend timestamp', () => {
    expect(toLondonDate('2026-07-01T23:30:00Z')).toBe('2026-07-02');
    expect(toLondonDate('2026-07-01T23:30:00+00:00')).toBe('2026-07-02');
  });

  it('passes a bare date through unchanged', () => {
    expect(toLondonDate('2026-10-29')).toBe('2026-10-29');
  });

  it('returns null for something that is not a date', () => {
    expect(toLondonDate('soon')).toBeNull();
    expect(toLondonDate('')).toBeNull();
  });
});
