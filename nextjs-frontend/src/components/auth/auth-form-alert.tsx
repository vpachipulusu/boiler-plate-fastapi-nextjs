'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import type { AuthFormError } from './auth-form-errors';

/** Marks an invalid control with a 2px border; the error line carries the text (plan 5.8). */
export const FIELD_ERROR_CLASS =
  'aria-[invalid=true]:border-2 aria-[invalid=true]:border-crit-foreground';

interface AuthFormAlertProps {
  error: AuthFormError;
  /** Lets a field name this alert in `aria-describedby`. */
  id?: string;
  /** Move focus to the alert when it appears (default). Off where focus belongs in a field the person retypes. */
  focusOnShow?: boolean;
}

/**
 * Form-level alert panel (plan 5.8): icon, bold summary and a plain sentence. It takes focus when
 * it appears, which is how a failed submit with no field errors is announced and reached.
 */
export function AuthFormAlert({ error, id, focusOnShow = true }: AuthFormAlertProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusOnShow) ref.current?.focus();
  }, [error, focusOnShow]);

  return (
    <div
      ref={ref}
      id={id}
      role="alert"
      tabIndex={-1}
      className="flex gap-3 rounded-lg border-2 border-crit-foreground bg-crit p-3 text-sm text-crit-foreground"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-semibold">{error.title}</p>
        <p>{error.message}</p>
        {error.kind === 'suspended' && (
          <Link href="/contact" className="inline-flex min-h-11 items-center font-medium underline">
            Contact support
          </Link>
        )}
      </div>
    </div>
  );
}
