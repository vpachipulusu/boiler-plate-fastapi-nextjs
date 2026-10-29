'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Simulated round trip so the pending state is visible; no request is ever made. */
const PREVIEW_DELAY_MS = 300;

const FREQUENCIES = [
  { value: 'daily', label: 'Daily highlights' },
  { value: 'weekly', label: 'Weekly round-up' },
] as const;

const alertsSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email address.')
    .email('Enter a valid email address.'),
  categories: z.array(z.string()).min(1, 'Choose at least one category.'),
  frequency: z.enum(['daily', 'weekly']),
  consent: z.boolean().refine((value) => value, 'Please agree to receive emails to continue.'),
});

type AlertsValues = z.infer<typeof alertsSchema>;

export interface AlertsCategory {
  slug: string;
  name: string;
}

interface AlertsFormProps {
  categories: AlertsCategory[];
  defaultEmail?: string;
}

const LABEL_CLASS = 'text-[11px] font-bold uppercase tracking-wider text-foreground';
const ERROR_CLASS = 'mt-2 text-sm font-medium text-crit-foreground';
const CARD_CLASS =
  'flex min-h-11 cursor-pointer items-center gap-3 rounded-input border border-border bg-background px-3 text-sm font-bold text-foreground transition-colors has-[:checked]:border-accent-ink has-[:checked]:bg-good has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring';

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className={ERROR_CLASS}>
      {message}
    </p>
  );
}

/**
 * Alerts preferences (design screen 04). Validates in the browser with Zod and ends in a plainly
 * worded demo state: nothing is sent or saved, so a visitor is never told they subscribed.
 */
export function AlertsForm({ categories, defaultEmail = '' }: AlertsFormProps) {
  const [previewDone, setPreviewDone] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AlertsValues>({
    resolver: zodResolver(alertsSchema),
    defaultValues: { email: defaultEmail, categories: [], frequency: 'daily', consent: false },
  });

  const onSubmit = async () => {
    await new Promise((resolve) => setTimeout(resolve, PREVIEW_DELAY_MS));
    setPreviewDone(true);
  };

  const emailError = errors.email?.message;
  const categoriesError = errors.categories?.message;
  const consentError = errors.consent?.message;

  return (
    <div>
      <h2 className="font-display text-3xl font-extrabold tracking-tight">
        Create your free alerts
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Choose what you&apos;d like to hear about. You can change this anytime.
      </p>
      <p className="mt-4 rounded-input bg-warn px-4 py-3 text-sm font-medium text-warn-foreground">
        Design preview: alerts are not live yet. Nothing you enter here is sent or saved.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6">
        <fieldset disabled={previewDone} className="space-y-7 border-0 p-0">
          <div>
            <label htmlFor="alerts-email" className={LABEL_CLASS}>
              Email address
            </label>
            <Input
              id="alerts-email"
              type="text"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="mt-2 h-11 rounded-input"
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? 'alerts-email-error' : undefined}
              {...register('email')}
            />
            <FieldError id="alerts-email-error" message={emailError} />
          </div>

          <fieldset
            className="border-0 p-0"
            aria-describedby={categoriesError ? 'alerts-categories-error' : undefined}
          >
            <legend className={LABEL_CLASS}>I&apos;m interested in</legend>
            <Controller
              control={control}
              name="categories"
              render={({ field }) => (
                <ul className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {categories.map((category) => {
                    const checked = field.value.includes(category.slug);
                    return (
                      <li key={category.slug}>
                        <label className={cn(CARD_CLASS, 'w-full')}>
                          <input
                            type="checkbox"
                            className="peer sr-only"
                            value={category.slug}
                            checked={checked}
                            aria-invalid={categoriesError ? true : undefined}
                            onChange={() =>
                              field.onChange(
                                checked
                                  ? field.value.filter((slug) => slug !== category.slug)
                                  : [...field.value, category.slug]
                              )
                            }
                          />
                          <span
                            aria-hidden="true"
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border bg-card text-accent-foreground peer-checked:border-accent-ink peer-checked:bg-accent-ink peer-checked:text-white [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100"
                          >
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                          </span>
                          {category.name}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            />
            <FieldError id="alerts-categories-error" message={categoriesError} />
          </fieldset>

          <fieldset className="border-0 p-0">
            <legend className={LABEL_CLASS}>How often?</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {FREQUENCIES.map((option) => (
                <label key={option.value} className={cn(CARD_CLASS, 'rounded-pill px-5')}>
                  <input
                    type="radio"
                    className="sr-only"
                    value={option.value}
                    {...register('frequency')}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label className="flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 shrink-0 rounded-md border-border accent-[hsl(var(--accent-ink))]"
                aria-invalid={consentError ? true : undefined}
                aria-describedby={consentError ? 'alerts-consent-error' : undefined}
                {...register('consent')}
              />
              <span>
                I agree to receive freebie emails from Freejoy. I can unsubscribe at any time. See
                the{' '}
                <Link href="/privacy" className="font-bold text-accent-ink underline">
                  privacy policy
                </Link>
                .
              </span>
            </label>
            <FieldError id="alerts-consent-error" message={consentError} />
          </div>
        </fieldset>

        <div aria-live="polite" className="mt-8">
          {previewDone ? (
            <div className="rounded-card bg-warn p-5 text-warn-foreground">
              <p className="font-bold">
                Alerts aren&apos;t live yet. Nothing was saved — this is a design preview of the
                Freejoy alerts flow.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <Link
                  href="/freebies"
                  className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-cta px-6 text-sm font-bold text-cta-foreground hover:bg-cta-hover"
                >
                  Browse freebies
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  onClick={() => setPreviewDone(false)}
                  className="inline-flex min-h-11 items-center rounded-pill px-3 text-sm font-bold underline underline-offset-4"
                >
                  Change my answers
                </button>
              </div>
            </div>
          ) : (
            <Button
              type="submit"
              variant="accent"
              disabled={isSubmitting}
              className="h-14 w-full justify-between rounded-pill px-7 text-base font-bold shadow-sm"
            >
              Send me free alerts
              <ArrowRight aria-hidden="true" />
            </Button>
          )}
        </div>
      </form>

      <p className="mt-4 text-xs text-muted-foreground">
        Planned for launch: no spam · no sold email lists · unsubscribe in one click
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Once alerts launch, every email will carry a one-click unsubscribe link.
      </p>
    </div>
  );
}
