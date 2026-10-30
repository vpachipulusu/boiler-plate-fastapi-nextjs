'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { subscribeToAlertsAction } from '@/app/actions/alerts-actions';
import {
  ALERT_FREQUENCIES,
  CONFIRM_WINDOW_TEXT,
  CONSENT_LEAD,
  CONSENT_LINK_TEXT,
  CONSENT_TAIL,
} from '@/lib/alerts/consent';
import { ALERTS_FAILURE_MESSAGES } from '@/lib/alerts/outcomes';
import { cn } from '@/lib/utils';

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
  /**
   * False until alerts are open (see the page): the form is replaced by a plain notice and nothing can be
   * submitted, so nobody is invited to sign up for mail that cannot be sent.
   */
  live: boolean;
}

const LABEL_CLASS = 'text-[11px] font-bold uppercase tracking-wider text-foreground';
const ERROR_CLASS = 'mt-2 text-sm font-medium text-crit-foreground';
const CARD_CLASS =
  'flex min-h-11 cursor-pointer items-center gap-3 rounded-input border border-border bg-background px-3 text-sm font-bold text-foreground transition-colors has-[:checked]:border-accent-ink has-[:checked]:bg-good has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring';

function NotOpenYet() {
  return (
    <div>
      <h2 className="font-display text-3xl font-extrabold tracking-tight">
        Create your free alerts
      </h2>
      <div className="mt-6 rounded-card bg-warn p-5 text-warn-foreground">
        <p className="font-bold">Alerts aren&apos;t open yet.</p>
        <p className="mt-2 text-sm">
          Nothing you could enter here would be sent or saved, so the sign-up form is switched off
          until alerts launch. In the meantime you can browse every freebie on the site.
        </p>
        <Link
          href="/freebies"
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-pill bg-cta px-6 text-sm font-bold text-cta-foreground hover:bg-cta-hover"
        >
          Browse freebies
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className={ERROR_CLASS}>
      {message}
    </p>
  );
}

/**
 * Alerts preferences (design screen 04). Validates in the browser with Zod, then submits through a server
 * action that starts a double opt-in: nothing starts until the visitor opens the emailed link. The
 * "check your inbox" answer is the same for every address, so it never reveals who is already signed up.
 * A failed request keeps the answers and offers a retry with a curated message.
 */
export function AlertsForm({ categories, live }: AlertsFormProps) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<AlertsValues>({
    resolver: zodResolver(alertsSchema),
    defaultValues: { email: '', categories: [], frequency: 'daily', consent: false },
  });

  const onSubmit = async (values: AlertsValues) => {
    if (!live) return;
    setFailure(null);
    try {
      const result = await subscribeToAlertsAction(values);
      if (result.success) setSentTo(values.email);
      else setFailure(result.error);
    } catch {
      setFailure(ALERTS_FAILURE_MESSAGES.unavailable);
    }
  };

  const emailError = errors.email?.message;
  const categoriesError = errors.categories?.message;
  const consentError = errors.consent?.message;

  if (!live) return <NotOpenYet />;

  return (
    <div>
      <h2 className="font-display text-3xl font-extrabold tracking-tight">
        Create your free alerts
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Choose what you&apos;d like to hear about. Unsubscribe from any email to stop them.
      </p>

      <form
        onSubmit={(event) => {
          // One request at a time. aria-disabled (not disabled) keeps keyboard focus on the button, so a
          // second press or Enter reaches here and is dropped.
          if (isSubmitting) event.preventDefault();
          else void handleSubmit(onSubmit)(event);
        }}
        noValidate
        className="mt-6"
      >
        <fieldset disabled={sentTo !== null} className="space-y-7 border-0 p-0">
          <div>
            <label htmlFor="alerts-email" className={LABEL_CLASS}>
              Email address
            </label>
            <Input
              id="alerts-email"
              type="email"
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
                  {categories.map((category, index) => {
                    const checked = field.value.includes(category.slug);
                    return (
                      <li key={category.slug}>
                        <label className={cn(CARD_CLASS, 'w-full')}>
                          <input
                            type="checkbox"
                            // The first box carries the field ref so a failed submit can focus the group.
                            ref={index === 0 ? field.ref : undefined}
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
              {ALERT_FREQUENCIES.map((option) => (
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
                {CONSENT_LEAD}
                <Link href="/privacy" className="font-bold text-accent-ink underline">
                  {CONSENT_LINK_TEXT}
                </Link>
                {CONSENT_TAIL}
              </span>
            </label>
            <FieldError id="alerts-consent-error" message={consentError} />
          </div>
        </fieldset>

        <div aria-live="polite" className="mt-8">
          {sentTo !== null ? (
            <div
              // The submit button unmounts on success, so the panel takes focus as it mounts.
              ref={(node) => node?.focus()}
              tabIndex={-1}
              className="rounded-card bg-good p-5 text-good-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <h3 className="font-display text-xl font-extrabold">Check your inbox</h3>
              <p className="mt-2 text-sm">
                If {sentTo} is new to our alerts, we have sent it a confirmation link. Open the link
                within {CONFIRM_WINDOW_TEXT} to start your alerts: nothing starts until you do. If
                you do not see it in a few minutes, check your spam folder. If you are already
                signed up, there is nothing more to do.
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
                  onClick={() => {
                    setSentTo(null);
                    // This button unmounts with the panel; the email field is re-enabled on commit.
                    requestAnimationFrame(() => setFocus('email'));
                  }}
                  className="inline-flex min-h-11 items-center rounded-pill px-3 text-sm font-bold underline underline-offset-4"
                >
                  Use a different address
                </button>
              </div>
            </div>
          ) : (
            <Button
              type="submit"
              variant="accent"
              aria-disabled={isSubmitting || undefined}
              onClick={(event) => {
                if (isSubmitting) event.preventDefault();
              }}
              className="h-14 w-full justify-between rounded-pill px-7 text-base font-bold shadow-sm aria-disabled:opacity-50"
            >
              {isSubmitting ? 'Sending…' : 'Send me free alerts'}
              <ArrowRight aria-hidden="true" />
            </Button>
          )}
        </div>
        {/* Outside the polite region and below the button, so it is announced once and does not move the button. */}
        {failure && sentTo === null ? (
          <p
            role="alert"
            className="mt-4 rounded-input bg-crit px-4 py-3 text-sm font-medium text-crit-foreground"
          >
            {failure} Your answers are still here: press the button to try again.
          </p>
        ) : null}
      </form>

      <p className="mt-4 text-xs text-muted-foreground">Unsubscribe in one click from any email</p>
    </div>
  );
}
