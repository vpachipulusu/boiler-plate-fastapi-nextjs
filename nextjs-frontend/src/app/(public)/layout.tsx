import { AnnouncementBar } from '@/components/site/announcement-bar';
import { MobileTabBar } from '@/components/site/mobile-tab-bar';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';

/**
 * Chrome for every public page: no session, no redirects. Bottom padding keeps content clear of the
 * phone tab bar; the skip link targets the page's main landmark.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[60] focus:flex focus:min-h-11 focus:items-center focus:rounded-pill focus:border focus:border-foreground focus:bg-background focus:px-4 focus:font-semibold focus:text-foreground"
      >
        Skip to main content
      </a>
      <AnnouncementBar />
      <SiteHeader />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 pb-[calc(3.5rem+env(safe-area-inset-bottom))] focus:outline-none lg:pb-0"
      >
        {children}
      </main>
      <SiteFooter />
      <MobileTabBar />
    </div>
  );
}
