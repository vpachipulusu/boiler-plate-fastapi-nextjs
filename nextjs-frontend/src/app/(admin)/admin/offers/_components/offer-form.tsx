'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createOfferAction, updateOfferAction } from '@/app/actions/admin/offer-actions';
import { Button } from '@/components/ui/button';
import { offerFormSchema, type OfferFormValues } from '@/lib/admin-catalogue/offer-schema';
import { settleAction } from '@/lib/admin-catalogue/settle-action';
import type { OfferStatus } from '@/lib/admin-catalogue/offer-status';
import { useToast } from '@/hooks/use-toast';
import { FormErrorSummary } from '../../_components/form-error-summary';
import { useServerFormErrors } from '../../_components/use-form-submit';
import {
  BasicsFields,
  ClassificationFields,
  PictureFields,
  ScheduleFields,
  TermsFields,
  type PickOption,
} from './offer-form-fields';
import { OfferPreviewCard } from './offer-preview-card';
import { StepsField } from './offer-steps-field';

type OfferFormProps = {
  mode: 'create' | 'edit';
  offerId?: string;
  status?: OfferStatus;
  initialValues: OfferFormValues;
  categories: PickOption[];
  merchants: PickOption[];
  /** An archived offer cannot be edited: the form shows its values and offers no save. */
  readOnly?: boolean;
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-5 rounded-card border p-4 sm:p-6">
      <legend className="px-2 text-base font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

/**
 * Create or edit an offer. Validation runs in the browser with the same Zod schema the server action uses
 * (react-hook-form + Zod), then the action validates again and the API once more. The first invalid field
 * takes focus; a failure that belongs to no field fills a summary that takes focus; a successful save is
 * announced and focused.
 */
export function OfferForm({
  mode,
  offerId,
  status,
  initialValues,
  categories,
  merchants,
  readOnly = false,
}: OfferFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const form = useForm<OfferFormValues>({
    resolver: zodResolver(offerFormSchema),
    defaultValues: initialValues,
  });
  const { formError, clearFormError, summaryRef, showFailure } = useServerFormErrors(
    form.setError,
    form.setFocus
  );
  const [saved, setSaved] = useState(false);
  const savedRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (saved) savedRef.current?.focus();
  }, [saved]);

  // An edit after a save makes "Changes saved." stale.
  // An edit after a save makes "Changes saved." stale, so it is shown only while the form is clean.
  const showSaved = saved && !form.formState.isDirty;

  async function onSubmit(values: OfferFormValues): Promise<void> {
    clearFormError();
    setSaved(false);
    const outcome = await settleAction(() =>
      mode === 'create' || !offerId ? createOfferAction(values) : updateOfferAction(offerId, values)
    );
    if (!outcome.success) {
      showFailure(outcome);
      return;
    }
    if (mode === 'create') {
      toast({ title: 'Draft created', description: values.title });
      router.push(`/admin/offers/${outcome.data.id}`);
      return;
    }
    form.reset(values);
    setSaved(true);
    router.refresh();
  }

  const submitting = form.formState.isSubmitting;
  const slug = status ? form.getValues('slug') : undefined;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      aria-label={mode === 'create' ? 'New offer' : 'Edit offer'}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
    >
      <fieldset disabled={readOnly} className="min-w-0 space-y-6 border-0 p-0">
        <Section title="Basics">
          <BasicsFields form={form} slugEditable={mode === 'create'} />
        </Section>
        <Section title="Category and merchant">
          <ClassificationFields form={form} categories={categories} merchants={merchants} />
        </Section>
        <Section title="Picture">
          <PictureFields form={form} />
        </Section>
        <Section title="Terms and claiming">
          <TermsFields form={form} />
        </Section>
        <Section title="How to claim">
          <StepsField form={form} />
        </Section>
        <Section title="Schedule and notes">
          <ScheduleFields form={form} />
        </Section>

        <FormErrorSummary ref={summaryRef} message={formError} />
        {showSaved ? (
          <p
            ref={savedRef}
            tabIndex={-1}
            role="status"
            className="rounded-lg border border-good-foreground/40 bg-good p-3 text-sm font-medium text-good-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Changes saved.
          </p>
        ) : null}
        {readOnly ? null : (
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : mode === 'create' ? 'Create draft' : 'Save changes'}
          </Button>
        )}
      </fieldset>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <OfferPreviewCard
          control={form.control}
          merchants={merchants}
          status={status}
          slug={slug}
        />
      </div>
    </form>
  );
}
