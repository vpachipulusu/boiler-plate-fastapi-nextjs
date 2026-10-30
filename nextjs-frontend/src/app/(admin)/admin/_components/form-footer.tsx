import type { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { FormErrorSummary } from './form-error-summary';

type FormFooterProps = {
  error: string | null;
  summaryRef: RefObject<HTMLDivElement | null>;
  showSaved: boolean;
  savedRef: RefObject<HTMLParagraphElement | null>;
  /** The form holds edits that are not saved. */
  dirty: boolean;
  submitting: boolean;
  submitLabel: string;
  /** No submit button (an archived offer). */
  readOnly?: boolean;
};

/**
 * The bottom of an admin form: the failure summary, the saved message, an unsaved-changes notice and the submit
 * button. The button is aria-disabled while saving (it keeps focus and stays announced) and the form's submit
 * handler ignores a second submit.
 */
export function FormFooter({
  error,
  summaryRef,
  showSaved,
  savedRef,
  dirty,
  submitting,
  submitLabel,
  readOnly = false,
}: FormFooterProps) {
  return (
    <>
      <FormErrorSummary ref={summaryRef} message={error} />
      {showSaved ? (
        <p
          ref={savedRef}
          tabIndex={-1}
          role="status"
          className="rounded-lg border border-good-foreground/40 bg-good p-3 text-sm font-medium text-good-foreground"
        >
          Changes saved.
        </p>
      ) : null}
      {/* Always mounted so a screen reader announces it when the text appears. */}
      <p aria-live="polite" className="text-sm font-medium text-warn-foreground">
        {dirty && !readOnly ? 'You have unsaved changes.' : ''}
      </p>
      {readOnly ? null : (
        <Button
          type="submit"
          aria-disabled={submitting || undefined}
          className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        >
          {submitting ? 'Saving…' : submitLabel}
        </Button>
      )}
    </>
  );
}
