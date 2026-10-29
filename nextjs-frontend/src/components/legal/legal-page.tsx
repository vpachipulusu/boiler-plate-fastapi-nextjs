import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

/** The exact banner wording; pages and tests share it so no page can drift. */
export const DRAFT_BANNER_TEXT = 'Draft — placeholder text pending legal review';

interface LegalPageProps {
  title: string;
  summary: string;
  /** Placeholder until a qualified reviewer signs the page off. */
  lastReviewed: string;
  children: React.ReactNode;
}

/** Visible while a page is placeholder text; removed only after a qualified reviewer signs it off. */
export function DraftBanner({ className }: { className?: string }) {
  return (
    <div
      role="note"
      className={cn(
        'flex items-start gap-3 rounded-card bg-warn px-4 py-3 text-sm font-bold text-warn-foreground',
        className
      )}
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {DRAFT_BANNER_TEXT}
    </div>
  );
}

/** Shared shell for editorial and legal pages: draft banner, h1, summary, readable prose. */
export function LegalPage({ title, summary, lastReviewed, children }: LegalPageProps) {
  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-3xl">
        <DraftBanner />
        <h1 className="mt-8 font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{summary}</p>
        <p className="mt-2 text-xs text-muted-foreground">Last reviewed: {lastReviewed}</p>
        <div className="mt-8 text-base leading-relaxed text-foreground [&_a]:font-semibold [&_a]:text-accent-ink [&_a]:underline [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:tracking-tight [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-bold [&_li]:mt-2 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:ps-6 [&_p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:ps-6">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Closing list of points a qualified reviewer must settle before the page can go live. */
export function ReviewerChecklist({ items }: { items: string[] }) {
  return (
    <section aria-labelledby="reviewer-heading" className="mt-10 rounded-card bg-secondary p-5">
      <h2 id="reviewer-heading" className="!mt-0 font-display text-xl font-extrabold">
        For the reviewer to confirm
      </h2>
      <ul className="!mt-3 list-disc ps-6 text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
