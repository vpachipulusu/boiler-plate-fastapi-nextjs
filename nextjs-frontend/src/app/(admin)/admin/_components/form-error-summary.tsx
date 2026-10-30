import { forwardRef } from 'react';
import { TriangleAlert } from 'lucide-react';

/** The form-level failure message. It is focusable so a failed submit can move focus here. */
export const FormErrorSummary = forwardRef<HTMLDivElement, { message: string | null }>(
  ({ message }, ref) =>
    message ? (
      <div
        ref={ref}
        tabIndex={-1}
        role="alert"
        className="flex items-start gap-2 rounded-lg border border-destructive/50 p-4 text-sm text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p>{message}</p>
      </div>
    ) : null
);
FormErrorSummary.displayName = 'FormErrorSummary';
