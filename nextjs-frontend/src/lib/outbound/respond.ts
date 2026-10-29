import { NextResponse, type NextRequest } from 'next/server';
import { recordOutboundClick, type OutboundClickResult } from '@/lib/api/outbound';
import { logger } from '@/lib/logger';
import {
  classifyUserAgent,
  isOfferId,
  isOfferSlug,
  parseHttpsDestination,
  referrerHost,
} from './validation';

/**
 * The decision behind `GET /go/[offerId]`, kept out of the route file so it is unit tested and counted
 * in coverage.
 *
 * Rules this module enforces:
 * - Only the path id is read. No query parameter, body or custom header can influence the destination.
 * - The Location is built from a `URL` object that passed `parseHttpsDestination` (https only, no user
 *   info), never by string concatenation.
 * - Every response is `Cache-Control: no-store` and sets no cookie.
 * - A successful redirect is a 307 with `Referrer-Policy: strict-origin-when-cross-origin`.
 */

export const REFERRER_POLICY = 'strict-origin-when-cross-origin';
const NO_STORE = 'no-store';
const RATE_LIMIT_RETRY_SECONDS = '60';
const ENDED_REDIRECT_STATUS = 302;
const REDIRECT_STATUS = 307;

function textResponse(status: number, body: string | null, headers: Record<string, string> = {}) {
  return new NextResponse(body, {
    status,
    headers: { 'Cache-Control': NO_STORE, 'Content-Type': 'text/plain; charset=utf-8', ...headers },
  });
}

function notFound() {
  return textResponse(404, 'This offer is not available.');
}

function isPrefetch(request: NextRequest): boolean {
  const purpose = `${request.headers.get('sec-purpose') ?? ''} ${request.headers.get('purpose') ?? ''}`;
  return /prefetch|prerender/i.test(purpose);
}

function endedRedirect(request: NextRequest, slug: string): NextResponse {
  if (!isOfferSlug(slug)) return notFound();
  const target = request.nextUrl.clone();
  target.pathname = `/freebies/${slug}`;
  target.search = '';
  target.hash = '';
  target.searchParams.set('ended', '1');
  return NextResponse.redirect(target, {
    status: ENDED_REDIRECT_STATUS,
    headers: { 'Cache-Control': NO_STORE },
  });
}

function destinationRedirect(offerId: string, destination: string): NextResponse {
  const target = parseHttpsDestination(destination);
  if (target === null) {
    // Never log the destination: it can carry a query string.
    logger.error('Outbound destination refused by the route', { offerId });
    return textResponse(503, 'This link is not available right now. Please try again later.');
  }
  return NextResponse.redirect(target, {
    status: REDIRECT_STATUS,
    headers: { 'Cache-Control': NO_STORE, 'Referrer-Policy': REFERRER_POLICY },
  });
}

function respondTo(
  request: NextRequest,
  offerId: string,
  result: OutboundClickResult
): NextResponse {
  switch (result.kind) {
    case 'redirect':
      return destinationRedirect(offerId, result.destination);
    case 'ended':
      return endedRedirect(request, result.slug);
    case 'not_found':
      return notFound();
    case 'rate_limited':
      return textResponse(429, 'Too many requests. Please try again shortly.', {
        'Retry-After': RATE_LIMIT_RETRY_SECONDS,
      });
    default:
      return textResponse(503, 'This link is not available right now. Please try again later.', {
        'Retry-After': '30',
      });
  }
}

/** Handles one outbound request. `offerId` is the raw path segment; nothing else is trusted. */
export async function handleOutboundRequest(
  request: NextRequest,
  offerId: string
): Promise<NextResponse> {
  if (!isOfferId(offerId)) return notFound();
  // Browsers that speculatively load a link must not count as a click.
  if (isPrefetch(request)) return textResponse(204, null);
  const result = await recordOutboundClick(offerId, {
    referrerHost: referrerHost(request.headers.get('referer')),
    userAgentClass: classifyUserAgent(request.headers.get('user-agent')),
  });
  return respondTo(request, offerId, result);
}
