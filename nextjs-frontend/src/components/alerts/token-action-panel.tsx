'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AlertsActionResult } from '@/lib/alerts/outcomes';

type Phase =
  | { name: 'reading' }
  | { name: 'missing' }
  | { name: 'ready' }
  | { name: 'working' }
  | { name: 'done' }
  | { name: 'failed'; result: Extract<AlertsActionResult, { success: false }> };

export interface TokenActionCopy {
  heading: string;
  intro: string;
  button: string;
  working: string;
  doneHeading: string;
  doneBody: string;
  doneLink: { href: string; label: string };
}

interface TokenActionPanelProps {
  copy: TokenActionCopy;
  /** A server action: takes the emailed token, answers with a curated result. */
  action: (token: string) => Promise<AlertsActionResult>;
}

const RETRY_LINK = { href: '/alerts', label: 'Back to alerts' };

/**
 * One button between an emailed link and a state change. The token is read from the address once, held
 * only in memory and removed from the address bar; it is never rendered. Nothing happens on load, so a
 * mail scanner that opens the link cannot confirm or unsubscribe anyone: a person has to press the button.
 */
export function TokenActionPanel({ copy, action }: TokenActionPanelProps) {
  const [phase, setPhase] = useState<Phase>({ name: 'reading' });
  const token = useRef<string | null>(null);
  const read = useRef(false);

  useEffect(() => {
    // Once only: React Strict Mode runs effects twice and the first run removes the token.
    if (read.current) return;
    read.current = true;
    const value = new URLSearchParams(window.location.search).get('token');
    token.current = value;
    if (value) {
      window.history.replaceState(window.history.state, '', window.location.pathname);
    }
    setPhase(value ? { name: 'ready' } : { name: 'missing' });
  }, []);

  const press = async () => {
    // aria-disabled (not disabled) keeps focus on the button, so this guard stops a second press.
    if (!token.current || phase.name === 'working') return;
    setPhase({ name: 'working' });
    let result: AlertsActionResult;
    try {
      result = await action(token.current);
    } catch {
      result = {
        success: false,
        code: 'unavailable',
        error: 'Something went wrong on our side. Please try again in a few minutes.',
      };
    }
    setPhase(result.success ? { name: 'done' } : { name: 'failed', result });
  };

  const message =
    phase.name === 'missing'
      ? 'This link is incomplete. Please use the link in your email, or start again from the alerts page.'
      : phase.name === 'failed'
        ? phase.result.error
        : null;
  const canRetry = phase.name === 'failed' && phase.result.code !== 'invalid_link';

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6 sm:py-20">
      <div className="rounded-editorial border border-border bg-card p-6 sm:p-10">
        {phase.name === 'done' ? (
          <div
            // The button unmounts on success, so the result takes focus as it mounts.
            ref={(node) => node?.focus()}
            tabIndex={-1}
            className="outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <h1 className="font-display text-3xl font-extrabold tracking-tight">
              {copy.doneHeading}
            </h1>
            <p className="mt-3 text-muted-foreground">{copy.doneBody}</p>
            <Link
              href={copy.doneLink.href}
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-pill bg-cta px-6 text-sm font-bold text-cta-foreground hover:bg-cta-hover"
            >
              {copy.doneLink.label}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-display text-3xl font-extrabold tracking-tight">{copy.heading}</h1>
            <p className="mt-3 text-muted-foreground">{copy.intro}</p>
            <div className="mt-6 flex min-h-12 flex-wrap items-center gap-4">
              {phase.name === 'ready' || phase.name === 'working' || canRetry ? (
                <Button
                  type="button"
                  variant="accent"
                  aria-disabled={phase.name === 'working' || undefined}
                  onClick={press}
                  className="h-12 rounded-pill px-7 text-base font-bold aria-disabled:opacity-50"
                >
                  {phase.name === 'working' ? copy.working : copy.button}
                </Button>
              ) : null}
              {phase.name === 'missing' || phase.name === 'failed' ? (
                <Link
                  href={RETRY_LINK.href}
                  className="inline-flex min-h-11 items-center text-sm font-bold underline underline-offset-4"
                >
                  {RETRY_LINK.label}
                </Link>
              ) : null}
            </div>
            {message ? (
              <p role="alert" className="mt-4 text-sm font-medium text-crit-foreground">
                {message}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
