import Link from 'next/link';
import { Spark } from '@/components/site/brand-mark';

/** Custom 404. One calm panel, two ways out. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-content items-center justify-center px-4 py-10">
      <section className="w-full max-w-lg rounded-editorial bg-secondary p-8 text-center text-secondary-foreground sm:p-12">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-card">
          <Spark className="h-7 w-7 text-cta" />
        </div>
        <p className="font-display text-6xl font-extrabold text-accent-ink" aria-hidden="true">
          404
        </p>
        <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you are looking for does not exist or has moved.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-12 items-center rounded-pill bg-cta px-6 text-base font-bold text-cta-foreground hover:bg-cta-hover"
          >
            Go home
          </Link>
          <Link
            href="/freebies"
            className="inline-flex h-12 items-center rounded-pill border border-border bg-card px-6 text-base font-bold text-foreground hover:bg-background"
          >
            Browse freebies
          </Link>
        </div>
      </section>
    </main>
  );
}
