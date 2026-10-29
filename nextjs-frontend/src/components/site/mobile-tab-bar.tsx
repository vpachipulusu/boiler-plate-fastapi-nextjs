'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { SITE_TAB_ITEMS, activeTabHref } from './nav-items';

/** 56px bottom tab bar below 1024px (design screens 05-07). Desktop uses the header nav instead. */
export function MobileTabBar() {
  const pathname = usePathname();
  const current = activeTabHref(pathname);

  return (
    <nav
      aria-label="Quick links"
      className="fixed inset-x-0 bottom-0 z-40 box-content flex h-14 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {SITE_TAB_ITEMS.map(({ href, label, icon: Icon }) => {
        const isCurrent = href === current;
        return (
          <Link
            key={href}
            href={href}
            aria-current={isCurrent ? 'page' : undefined}
            className={cn(
              'relative flex h-full flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground',
              isCurrent &&
                'text-accent-ink before:absolute before:inset-x-4 before:top-0 before:h-[3px] before:rounded-b-full before:bg-accent-ink'
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
