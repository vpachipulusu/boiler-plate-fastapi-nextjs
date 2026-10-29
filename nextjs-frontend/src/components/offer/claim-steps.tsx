import type { ClaimStep } from '@/lib/catalogue/types';

interface ClaimStepsProps {
  steps: ClaimStep[];
}

/** Numbered mint circles: horizontal from 768px, stacked on phones. */
export function ClaimSteps({ steps }: ClaimStepsProps) {
  return (
    <section aria-labelledby="claim-steps-heading">
      <h2
        id="claim-steps-heading"
        className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl"
      >
        How to claim this freebie
      </h2>
      <ol className="mt-6 grid gap-6 md:grid-cols-3 md:gap-8">
        {steps.map((step, index) => (
          <li key={step.title} className="flex items-start gap-4">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-good font-display text-lg font-extrabold text-accent-ink"
            >
              {index + 1}
            </span>
            <div>
              <h3 className="font-display text-base font-bold text-foreground">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
