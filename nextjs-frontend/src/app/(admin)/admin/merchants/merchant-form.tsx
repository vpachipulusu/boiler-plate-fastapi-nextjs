'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createMerchantAction, updateMerchantAction } from '@/app/actions/admin/merchant-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { merchantFormSchema, type MerchantFormValues } from '@/lib/admin-catalogue/merchant-schema';
import { settleAction } from '@/lib/admin-catalogue/settle-action';
import { useToast } from '@/hooks/use-toast';
import { Field } from '../_components/form-field';
import { FormErrorSummary } from '../_components/form-error-summary';
import { useServerFormErrors } from '../_components/use-form-submit';

type MerchantFormProps = {
  mode: 'create' | 'edit';
  merchantId?: string;
  initialValues: MerchantFormValues;
};

/** Create or edit a merchant (react-hook-form + the same Zod schema the server action uses). */
export function MerchantForm({ mode, merchantId, initialValues }: MerchantFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const form = useForm<MerchantFormValues>({
    resolver: zodResolver(merchantFormSchema),
    defaultValues: initialValues,
  });
  const { register, formState, handleSubmit } = form;
  const { errors, isSubmitting } = formState;
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

  async function onSubmit(values: MerchantFormValues): Promise<void> {
    clearFormError();
    setSaved(false);
    const outcome = await settleAction(() =>
      mode === 'create' || !merchantId
        ? createMerchantAction(values)
        : updateMerchantAction(merchantId, values)
    );
    if (!outcome.success) {
      showFailure(outcome);
      return;
    }
    if (mode === 'create') {
      toast({ title: 'Merchant created', description: values.name });
      router.push('/admin/merchants');
      return;
    }
    form.reset(values);
    setSaved(true);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-label={mode === 'create' ? 'New merchant' : 'Edit merchant'}
      className="max-w-2xl space-y-5"
    >
      <Field id="merchant-name" label="Name" required error={errors.name?.message}>
        {(aria) => <Input id="merchant-name" maxLength={120} {...aria} {...register('name')} />}
      </Field>
      <Field
        id="merchant-slug"
        label="Slug"
        error={errors.slug?.message}
        hint={
          mode === 'create'
            ? 'Leave blank to use the name. It cannot be changed later.'
            : 'It cannot be changed.'
        }
      >
        {(aria) => (
          <Input
            id="merchant-slug"
            maxLength={80}
            autoCapitalize="none"
            spellCheck={false}
            readOnly={mode === 'edit'}
            {...aria}
            {...register('slug')}
          />
        )}
      </Field>
      <Field
        id="merchant-website"
        label="Website"
        error={errors.website?.message}
        hint="Optional. A full https:// address."
      >
        {(aria) => (
          <Input
            id="merchant-website"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="https://"
            {...aria}
            {...register('website')}
          />
        )}
      </Field>
      <Field
        id="merchant-logo"
        label="Logo address"
        error={errors.logoUrl?.message}
        hint="Optional. A full https:// address of a logo you are licensed to use."
      >
        {(aria) => (
          <Input
            id="merchant-logo"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="https://"
            {...aria}
            {...register('logoUrl')}
          />
        )}
      </Field>
      {mode === 'create' ? (
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            className="size-5 shrink-0 accent-[hsl(var(--primary))]"
            {...register('active')}
          />
          Active (its offers can be published)
        </label>
      ) : null}

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
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : mode === 'create' ? 'Create merchant' : 'Save changes'}
      </Button>
    </form>
  );
}
