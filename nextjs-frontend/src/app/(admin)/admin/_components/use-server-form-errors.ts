'use client';

import { useEffect, useRef, useState } from 'react';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

/**
 * Wires a server action's outcome into a react-hook-form form: field messages go on their fields and the first
 * invalid field takes focus; any other failure fills a summary that takes focus so a screen reader hears it.
 */
export function useServerFormErrors<V extends FieldValues>(
  setError: UseFormSetError<V>,
  setFocus: (name: Path<V>) => void
) {
  const [formError, setFormError] = useState<string | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  function showFailure(outcome: { error: string; fieldErrors?: Record<string, string> }): void {
    const names = Object.keys(outcome.fieldErrors ?? {});
    for (const name of names) {
      setError(name as Path<V>, { type: 'server', message: outcome.fieldErrors?.[name] });
    }
    setFormError(outcome.error);
    // Focus moves after the state change above has rendered (the summary exists, the field shows its message).
    requestAnimationFrame(() => {
      if (names.length > 0) setFocus(names[0] as Path<V>);
      else summaryRef.current?.focus();
    });
  }

  return { formError, clearFormError: () => setFormError(null), summaryRef, showFailure };
}

/**
 * The "Changes saved." message of an edit form. It takes focus when it appears and is shown only while the form is
 * clean: a later edit makes it stale.
 */
export function useSavedMessage(isDirty: boolean) {
  const [saved, setSaved] = useState(false);
  const savedRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (saved) savedRef.current?.focus();
  }, [saved]);

  return {
    showSaved: saved && !isDirty,
    savedRef,
    markSaved: () => setSaved(true),
    clearSaved: () => setSaved(false),
  };
}

/** Runs a submit once at a time: a second submit while one is in flight (a double click) is ignored. */
export function useSubmitOnce() {
  const busy = useRef(false);
  return async (run: () => Promise<void>): Promise<void> => {
    if (busy.current) return;
    busy.current = true;
    try {
      await run();
    } finally {
      busy.current = false;
    }
  };
}
