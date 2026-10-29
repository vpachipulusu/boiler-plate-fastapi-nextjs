import { NextRequest, NextResponse } from 'next/server';
import { unsubscribeFromAlertsAction } from '@/app/actions/alerts-actions';

/**
 * RFC 8058 one-click unsubscribe. A mail provider POSTs to the `List-Unsubscribe` URL in the email,
 * with no cookies and no browser, so this is a route handler rather than a server action. It does what the
 * unsubscribe page's button does, through the same action: the browser still never calls FastAPI.
 *
 * The request must carry the RFC 8058 body `List-Unsubscribe=One-Click`; anything else is a 400 and
 * reaches no backend call. Statuses only (no body text): 200 done, 400 bad request or token, 429 slow
 * down, 503 try again.
 */

const TOKEN_SHAPE = /^[A-Za-z0-9._-]{1,512}$/;
const ONE_CLICK_VALUE = 'One-Click';
const NO_STORE = { 'Cache-Control': 'no-store' } as const;

const STATUS_FOR = { invalid_link: 400, rate_limited: 429, invalid_input: 400, unavailable: 503 };

async function isOneClickBody(request: NextRequest): Promise<boolean> {
  try {
    return (await request.formData()).get('List-Unsubscribe') === ONE_CLICK_VALUE;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!(await isOneClickBody(request))) {
    return new NextResponse(null, { status: 400, headers: NO_STORE });
  }
  const result = await unsubscribeFromAlertsAction(request.nextUrl.searchParams.get('token'));
  if (result.success) return new NextResponse(null, { status: 200, headers: NO_STORE });
  return new NextResponse(null, { status: STATUS_FOR[result.code], headers: NO_STORE });
}

/** A person (or a mail client without one-click) opening the URL lands on the unsubscribe page. */
export function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const target = new URL('/alerts/unsubscribe', request.nextUrl.origin);
  if (token && TOKEN_SHAPE.test(token)) target.searchParams.set('token', token);
  return NextResponse.redirect(target, { status: 303, headers: NO_STORE });
}
