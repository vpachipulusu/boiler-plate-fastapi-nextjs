import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { handleOutboundRequest } from '@/lib/outbound/respond';

/**
 * `/go/[offerId]`: the first-party outbound redirect for affiliate offers (not under `/api`).
 *
 * Only the path id is used; every query parameter is ignored (see `@/lib/outbound/respond`). The
 * destination is resolved by the backend from the stored affiliate link, so nothing the visitor sends
 * can choose where they are redirected. The response sets no cookie.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await context.params;
  return handleOutboundRequest(request, offerId);
}

/** A HEAD request (link checkers, previews) must never count as a click or reveal a destination. */
export function HEAD() {
  return new NextResponse(null, {
    status: 405,
    headers: { Allow: 'GET', 'Cache-Control': 'no-store' },
  });
}
