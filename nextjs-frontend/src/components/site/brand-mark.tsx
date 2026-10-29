import Link from 'next/link';
import { cn } from '@/lib/utils';

/** The coral spark used across the brand: logo tile, hero accents and empty states. */
export function Spark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn('h-5 w-5', className)}
      fill="currentColor"
    >
      <path d="M12 1.5c.6 4.9 4.6 8.9 9.5 9.5v2c-4.9.6-8.9 4.6-9.5 9.5h-2c-.6-4.9-4.6-8.9-9.5-9.5v-2c4.9-.6 8.9-4.6 9.5-9.5h2Z" />
    </svg>
  );
}

interface BrandMarkProps {
  /** Light wordmark for the ink admin sidebar. */
  inverse?: boolean;
  className?: string;
}

/** Wordmark: coral spark tile, "freejoy" and the coral full stop (design screen 09). */
export function BrandMark({ inverse = false, className }: BrandMarkProps) {
  return (
    <Link
      href="/"
      className={cn('inline-flex min-h-11 items-center gap-2.5 rounded-pill pr-2', className)}
      aria-label="Freejoy home"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-input bg-cta text-white shadow-sm">
        <Spark className="h-4 w-4" />
      </span>
      <span
        className={cn(
          'font-display text-2xl font-extrabold tracking-tight',
          inverse ? 'text-background' : 'text-foreground'
        )}
      >
        freejoy
        <span className="text-cta" aria-hidden="true">
          .
        </span>
      </span>
    </Link>
  );
}
