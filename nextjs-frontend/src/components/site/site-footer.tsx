import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { FOOTER_LINKS } from './nav-items';

/** One-line footer (design screens 01-03): tagline left, policy links right. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-content flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          <span className="font-semibold text-foreground">freejoy</span> · {siteConfig.tagline}
        </p>
        <nav aria-label="Legal and about">
          <ul className="flex flex-wrap gap-x-1 gap-y-2">
            {FOOTER_LINKS.map(({ href, label }, index) => (
              <li key={href} className="flex items-center">
                {index > 0 && (
                  <span aria-hidden="true" className="px-1">
                    •
                  </span>
                )}
                <Link
                  href={href}
                  className="inline-flex min-h-11 items-center rounded-pill px-1 hover:text-foreground"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
