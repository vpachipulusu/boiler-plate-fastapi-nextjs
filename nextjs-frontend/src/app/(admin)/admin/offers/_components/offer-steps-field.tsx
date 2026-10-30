'use client';

import { useFieldArray, type UseFormReturn } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MAX_STEPS, type OfferFormValues } from '@/lib/admin-catalogue/offer-schema';
import { Field } from '../../_components/form-field';

/** The "how to claim" steps: add, edit and remove, up to the API's limit. */
export function StepsField({ form }: { form: UseFormReturn<OfferFormValues> }) {
  const { control, register, formState, setFocus } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'steps' });
  const stepErrors = formState.errors.steps;

  function addStep(): void {
    const next = fields.length;
    append({ title: '', detail: '' });
    // The new row's title is the next thing to type into.
    requestAnimationFrame(() => setFocus(`steps.${next}.title`));
  }

  function removeStep(index: number): void {
    const remaining = fields.length - 1;
    remove(index);
    requestAnimationFrame(() => {
      if (remaining > 0) setFocus(`steps.${Math.min(index, remaining - 1)}.title`);
      else document.getElementById('offer-add-step')?.focus();
    });
  }

  return (
    <div className="space-y-4">
      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">No steps yet.</p>
      ) : (
        <ol className="space-y-4">
          {fields.map((item, index) => (
            <li key={item.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Step {index + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-11"
                  onClick={() => removeStep(index)}
                >
                  <Trash2 aria-hidden="true" />
                  <span>
                    Remove<span className="sr-only"> step {index + 1}</span>
                  </span>
                </Button>
              </div>
              <Field
                id={`offer-step-${index}-title`}
                label="Step title"
                required
                error={stepErrors?.[index]?.title?.message}
              >
                {(aria) => (
                  <Input
                    id={`offer-step-${index}-title`}
                    maxLength={120}
                    {...aria}
                    {...register(`steps.${index}.title`)}
                  />
                )}
              </Field>
              <Field
                id={`offer-step-${index}-detail`}
                label="Step detail"
                required
                error={stepErrors?.[index]?.detail?.message}
              >
                {(aria) => (
                  <Textarea
                    id={`offer-step-${index}-detail`}
                    rows={2}
                    {...aria}
                    {...register(`steps.${index}.detail`)}
                  />
                )}
              </Field>
            </li>
          ))}
        </ol>
      )}
      {typeof stepErrors?.message === 'string' ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {stepErrors.message}
        </p>
      ) : null}
      <Button
        id="offer-add-step"
        type="button"
        variant="outline"
        onClick={addStep}
        disabled={fields.length >= MAX_STEPS}
      >
        <Plus aria-hidden="true" />
        Add a step
      </Button>
    </div>
  );
}
