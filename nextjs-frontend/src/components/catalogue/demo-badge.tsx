import { cn } from '@/lib/utils';

interface DemoBadgeProps {
  className?: string;
  /** Longer wording for the offer detail page. */
  verbose?: boolean;
}

/**
 * Marks fixture-backed content as illustrative. Shown wherever a demo offer appears so sample
 * listings are never mistaken for real, verified deals.
 */
export function DemoBadge({ className, verbose = false }: DemoBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex min-h-6 items-center rounded-pill bg-warn px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-warn-foreground',
        className
      )}
    >
      {verbose ? 'Demo listing: sample data, not a real offer' : 'Demo'}
    </span>
  );
}
