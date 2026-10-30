import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type FieldAria = {
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
  'aria-required': true | undefined;
};

type FieldProps = {
  /** The control's id; the label, hint and error ids derive from it. */
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  /** Receives the aria attributes that tie the control to its hint and error. */
  children: (aria: FieldAria) => ReactNode;
};

export function fieldAria(
  id: string,
  error: string | undefined,
  hint: string | undefined,
  required?: boolean
): FieldAria {
  const described = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return {
    'aria-invalid': error ? true : undefined,
    'aria-describedby': described.length > 0 ? described.join(' ') : undefined,
    'aria-required': required ? true : undefined,
  };
}

/** A labelled control with an optional hint and an error announced next to it and tied to it by id. */
export function Field({ id, label, error, hint, required, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="ms-1 text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {children(fieldAria(id, error, hint, required))}
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
