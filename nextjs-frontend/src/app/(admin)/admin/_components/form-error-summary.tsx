import { forwardRef, useId } from 'react';
import { TriangleAlert } from 'lucide-react';

/**
 * The form-level failure message. A failed submit moves focus here; the group is named so a screen reader says what
 * it is, and it is not also a live region (focus already announces it).
 */
export const FormErrorSummary = forwardRef<HTMLDivElement, { message: string | null }>(
  ({ message }, ref) => {
    const headingId = useId();
    return message ? (
      <div
        ref={ref}
        tabIndex={-1}
        role="group"
        aria-labelledby={headingId}
        className="flex items-start gap-2 rounded-lg border border-destructive/50 p-4 text-sm text-destructive"
      >
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <div>
          <p id={headingId} className="font-semibold">
            Could not save
          </p>
          <p>{message}</p>
        </div>
      </div>
    ) : null;
  }
);
FormErrorSummary.displayName = 'FormErrorSummary';
