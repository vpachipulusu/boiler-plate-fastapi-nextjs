'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type DirtyFormState = { dirty: boolean; setDirty: (dirty: boolean) => void };

const DirtyFormContext = createContext<DirtyFormState>({ dirty: false, setDirty: () => undefined });

/** Lets a form tell its siblings (the status buttons next to the offer form) that it holds unsaved edits. */
export function DirtyFormProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState(false);
  return (
    <DirtyFormContext.Provider value={{ dirty, setDirty }}>{children}</DirtyFormContext.Provider>
  );
}

export function useFormDirty(): boolean {
  return useContext(DirtyFormContext).dirty;
}

/** Reports a form's dirty state to the nearest provider (and clears it when the form goes away). */
export function useReportFormDirty(dirty: boolean): void {
  const { setDirty } = useContext(DirtyFormContext);
  useEffect(() => {
    setDirty(dirty);
    return () => setDirty(false);
  }, [dirty, setDirty]);
}
