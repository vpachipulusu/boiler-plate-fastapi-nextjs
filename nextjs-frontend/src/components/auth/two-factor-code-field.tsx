import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TwoFactorCodeFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Error text shown under the field; also marks the input invalid and links it with aria-describedby. */
  error?: string | null;
  /** Id of an error element rendered elsewhere (e.g. the dialog's alert); linked and marks the input invalid. */
  describedBy?: string;
  /**
   * Overrides the invalid state, for a caller whose `describedBy` also lists help text that is always present.
   * Left out, the input is invalid when `error` or `describedBy` is set.
   */
  invalid?: boolean;
  disabled?: boolean;
  /** Form field name (default `totpCode`). */
  name?: string;
}

/** Six-digit authenticator code: one 56px input, numeric keypad on phones, one-time-code autofill. */
export function TwoFactorCodeField({
  id,
  label,
  value,
  onChange,
  error,
  describedBy,
  invalid,
  disabled,
  name = 'totpCode',
}: TwoFactorCodeFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        inputMode="numeric"
        autoComplete="one-time-code"
        className="h-14 text-center font-mono text-xl tracking-[0.5em]"
        value={value}
        disabled={disabled}
        aria-invalid={(invalid ?? Boolean(error || describedBy)) ? true : undefined}
        aria-describedby={error ? errorId : describedBy}
        // No maxLength: it would cut a pasted "123 456" to "123 45" before the non-digits are dropped.
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
      />
      {error && (
        <p id={errorId} className="mt-1.5 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
