import type { EndedOffer } from '@/lib/catalogue';
import { Breadcrumbs } from './breadcrumbs';
import { OfferEndedPanel } from './offer-ended-panel';

/**
 * The page for an offer the catalogue reports as ended (HTTP 410 from the API): its title, its
 * category and the ended state. The API sends no other detail, so none is shown.
 */
export function EndedOfferView({ ended }: { ended: EndedOffer }) {
  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-6 sm:py-10">
      <Breadcrumbs
        category={{ slug: ended.categorySlug, name: ended.categoryName }}
        title={ended.title}
      />
      <div className="mt-6 max-w-2xl space-y-6 sm:mt-8">
        <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl sm:leading-[1.1]">
          {ended.title}
        </h1>
        <OfferEndedPanel categorySlug={ended.categorySlug} endedAt={ended.endedAt} />
      </div>
    </div>
  );
}
