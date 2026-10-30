'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateUserAction } from '@/app/actions/admin/user-actions';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { settleAction } from '@/lib/admin-catalogue/settle-action';
import {
  BIO_MAX,
  DISPLAY_NAME_MAX,
  LOCATION_MAX,
  toProfileUpdateInput,
  userProfileFormSchema,
  type UserProfileFormValues,
} from '@/lib/admin-users/profile-schema';
import { Field } from '../_components/form-field';
import { FormFooter } from '../_components/form-footer';
import {
  useSavedMessage,
  useServerFormErrors,
  useSubmitOnce,
} from '../_components/use-server-form-errors';
import { useUnsavedChanges } from '../_components/use-unsaved-changes';

type UserProfileFormProps = {
  userId: string;
  initialValues: UserProfileFormValues;
};

/**
 * Edit a user's profile fields (display name, bio, location, website, phone). Email, role and sign-in settings
 * are not editable here. A blank field clears that value. The API checks the `users.update` permission and
 * records which fields changed (never their values) in the audit log.
 */
export function UserProfileForm({ userId, initialValues }: UserProfileFormProps) {
  const router = useRouter();
  const form = useForm<UserProfileFormValues>({
    resolver: zodResolver(userProfileFormSchema),
    defaultValues: initialValues,
  });
  const { register, formState, handleSubmit } = form;
  const { errors, isSubmitting } = formState;
  const { formError, clearFormError, summaryRef, showFailure } = useServerFormErrors(
    form.setError,
    form.setFocus
  );
  const dirty = formState.isDirty;
  const { showSaved, savedRef, markSaved, clearSaved } = useSavedMessage(dirty);
  const submitOnce = useSubmitOnce();
  useUnsavedChanges(dirty);

  async function onSubmit(values: UserProfileFormValues): Promise<void> {
    clearFormError();
    clearSaved();
    const outcome = await settleAction<{ success: boolean; error?: string }>(() =>
      updateUserAction(userId, toProfileUpdateInput(values))
    );
    if (!outcome.success) {
      showFailure({ error: outcome.error ?? 'Something went wrong. Please try again.' });
      return;
    }
    form.reset(values);
    markSaved();
    router.refresh();
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submitOnce(() => handleSubmit(onSubmit)(event));
      }}
      noValidate
      aria-label="Edit user profile"
      className="max-w-2xl space-y-5"
    >
      <Field id="user-display-name" label="Display name" error={errors.displayName?.message}>
        {(aria) => (
          <Input
            id="user-display-name"
            maxLength={DISPLAY_NAME_MAX}
            autoComplete="off"
            {...aria}
            {...register('displayName')}
          />
        )}
      </Field>
      <Field id="user-bio" label="Bio" error={errors.bio?.message}>
        {(aria) => <Textarea id="user-bio" maxLength={BIO_MAX} {...aria} {...register('bio')} />}
      </Field>
      <Field id="user-location" label="Location" error={errors.location?.message}>
        {(aria) => (
          <Input
            id="user-location"
            maxLength={LOCATION_MAX}
            autoComplete="off"
            {...aria}
            {...register('location')}
          />
        )}
      </Field>
      <Field
        id="user-website"
        label="Website"
        error={errors.website?.message}
        hint="A full http:// or https:// address."
      >
        {(aria) => (
          <Input
            id="user-website"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            spellCheck={false}
            autoComplete="off"
            placeholder="https://"
            {...aria}
            {...register('website')}
          />
        )}
      </Field>
      <Field id="user-phone" label="Phone" error={errors.phoneNumber?.message}>
        {(aria) => (
          <Input
            id="user-phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            {...aria}
            {...register('phoneNumber')}
          />
        )}
      </Field>
      <FormFooter
        error={formError}
        summaryRef={summaryRef}
        showSaved={showSaved}
        savedRef={savedRef}
        dirty={dirty}
        submitting={isSubmitting}
        submitLabel="Save changes"
      />
    </form>
  );
}
