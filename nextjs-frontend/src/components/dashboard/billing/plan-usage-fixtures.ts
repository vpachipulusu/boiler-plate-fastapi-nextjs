import type { UsageMeterItem } from '@/components/dashboard/plan-usage-meter';

/**
 * Sample plan-usage figures. There is no plan-usage API yet, so the billing page shows these
 * (labelled as samples) until a real source exists. The limits are placeholders, NOT the plan's
 * entitlements: never use them to gate or promise anything. Add a row per limit your app meters.
 */
export const PLAN_USAGE_FIXTURES: Readonly<Record<string, ReadonlyArray<UsageMeterItem>>> = {
  free: [{ id: 'members', label: 'Team members', used: 1, limit: 1 }],
  pro: [{ id: 'members', label: 'Team members', used: 1, limit: 5 }],
  enterprise: [{ id: 'members', label: 'Team members', used: 1, limit: null }],
};

export function planUsageFixture(tier: string | undefined): UsageMeterItem[] {
  const items = PLAN_USAGE_FIXTURES[tier ?? 'free'] ?? PLAN_USAGE_FIXTURES.free;
  return [...items];
}
