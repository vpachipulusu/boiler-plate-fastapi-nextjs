'use client';

import { useEffect } from 'react';

/** Asks the browser to confirm before the tab is closed or reloaded while a form holds unsaved edits. */
export function useUnsavedChanges(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      // Some browsers only show their prompt when a return value is set.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);
}
