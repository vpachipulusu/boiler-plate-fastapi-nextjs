'use client';

interface AutoSubmitSelectProps {
  id: string;
  name: string;
  defaultValue: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  className?: string;
}

/** A native select that submits its form when the choice changes. Without JavaScript the form's Apply button does it. */
export function AutoSubmitSelect({
  id,
  name,
  defaultValue,
  options,
  className,
}: AutoSubmitSelectProps) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
      className={className}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
