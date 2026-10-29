import { cn } from '@/lib/utils';
import type { OfferImage, Tint } from '@/lib/catalogue/types';
import { Spark } from '@/components/site/brand-mark';

/** Pastel panel and the darker product tint for each fixture tint (design screens 01-07). */
const TINT_CLASSES: Record<Tint, { panel: string; product: string; label: string }> = {
  blush: { panel: 'bg-[#FBE2DA]', product: 'bg-[#FFF6F1]', label: 'bg-[#FFD9C9]' },
  mint: { panel: 'bg-[#DDF4E8]', product: 'bg-[#C9A27E]', label: 'bg-[#E9F7EF]' },
  lavender: { panel: 'bg-[#EADFF6]', product: 'bg-[#C8B4E6]', label: 'bg-[#F3ECFA]' },
  sky: { panel: 'bg-[#DDEEF9]', product: 'bg-[#EEF8FD]', label: 'bg-[#DDF4E8]' },
  butter: { panel: 'bg-[#FFEDD8]', product: 'bg-[#FFF8EE]', label: 'bg-[#FFE4C2]' },
  cream: { panel: 'bg-[#FFEDD8]', product: 'bg-[#FFFBF5]', label: 'bg-[#FFE4C2]' },
  sage: { panel: 'bg-[#DCE8CF]', product: 'bg-[#F6D86B]', label: 'bg-[#4F7F5E]' },
  sand: { panel: 'bg-[#EADBC8]', product: 'bg-[#B98A64]', label: 'bg-[#FBEFD9]' },
};

interface OfferArtProps {
  image: OfferImage;
  /** Card thumbnail or the large detail hero. */
  size?: 'card' | 'hero' | 'thumb';
  className?: string;
}

/**
 * Original flat illustration standing in for licensed product photography: a tinted panel, a
 * rounded "product" with the fixture label, soft circles and the brand spark. Rendered as inline
 * SVG so it scales without assets and never shifts layout.
 */
export function OfferArt({ image, size = 'card', className }: OfferArtProps) {
  const tint = TINT_CLASSES[image.tint];
  const isHero = size === 'hero';
  const isThumb = size === 'thumb';
  return (
    <div
      role="img"
      aria-label={image.alt}
      className={cn(
        'relative overflow-hidden',
        tint.panel,
        isHero ? 'aspect-[11/10] rounded-editorial' : 'aspect-[4/3]',
        isThumb ? 'rounded-input' : 'rounded-card',
        className
      )}
    >
      <span
        aria-hidden="true"
        className="absolute -right-6 -top-6 h-2/5 w-2/5 rounded-full bg-white/50"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-8 -left-6 h-2/5 w-2/5 rounded-full bg-white/40"
      />
      <span
        aria-hidden="true"
        className="absolute bottom-[12%] left-1/2 h-[7%] w-[46%] -translate-x-1/2 rounded-full bg-foreground/10"
      />
      <div
        aria-hidden="true"
        className={cn(
          'absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[22%] shadow-sm',
          tint.product,
          isHero ? 'h-[52%] w-[30%]' : 'h-[58%] w-[34%]'
        )}
      >
        {!isThumb && (
          <span
            className={cn(
              'rounded-sm px-1.5 py-0.5 text-center font-display font-extrabold leading-tight text-foreground',
              tint.label,
              isHero ? 'text-lg' : 'text-[10px]'
            )}
          >
            {image.label}
          </span>
        )}
      </div>
      <Spark
        className={cn(
          'absolute text-cta',
          isHero ? 'right-[16%] top-[30%] h-12 w-12' : 'right-[18%] top-[34%] h-6 w-6'
        )}
      />
    </div>
  );
}
