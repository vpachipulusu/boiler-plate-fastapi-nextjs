import { cn } from '@/lib/utils';
import { Spark } from '@/components/site/brand-mark';

/**
 * Original hero illustration in the spirit of design screen 01: peach disc, a jar labelled "the
 * good stuff", a tilted mint card and two floating cards. The artwork is inline SVG (the only place
 * raw colours are allowed); the floating cards are theme-token HTML so their text stays crisp and
 * readable at every size.
 */
export function HomeHeroArt({ className }: { className?: string }) {
  return (
    <div className={cn('relative aspect-[520/440]', className)}>
      <svg viewBox="0 0 520 440" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <circle cx="260" cy="220" r="178" fill="#FAD9C8" />
        <ellipse cx="270" cy="372" rx="170" ry="20" fill="#F0BFA9" opacity="0.7" />
        <rect x="222" y="62" width="76" height="40" rx="14" fill="#EADBC8" />
        <rect x="190" y="90" width="140" height="272" rx="36" fill="#FFF8EE" />
        <rect x="208" y="170" width="104" height="76" rx="12" fill="#FFD3BC" />
        <g className="font-display" fill="#1F3630" textAnchor="middle" fontWeight="800">
          <text x="260" y="206" fontSize="28">
            the
          </text>
          <text x="260" y="228" fontSize="14" fontWeight="600">
            good stuff
          </text>
        </g>
        <g transform="rotate(10 380 250)">
          <rect x="332" y="128" width="84" height="236" rx="4" fill="#B9DEC2" stroke="#8FC59F" />
          <g className="font-display" fill="#1F3630" textAnchor="middle" fontWeight="700">
            <text x="374" y="214" fontSize="18">
              daily
            </text>
            <text x="374" y="238" fontSize="18">
              joy
            </text>
          </g>
        </g>
      </svg>

      <Spark className="absolute left-[10%] top-[20%] h-[7%] w-[7%] text-cta" />
      <Spark className="absolute right-[18%] top-[2%] h-[7%] w-[7%] text-accent-ink" />
      <Spark className="absolute bottom-[34%] right-[2%] h-[7%] w-[7%] text-card" />

      <div className="absolute right-0 top-[8%] flex w-[46%] items-center gap-2 rounded-card bg-card p-2 shadow-sm sm:gap-3 sm:p-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-good text-good-foreground sm:h-8 sm:w-8">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true">
            <path
              d="m5 12.5 4.5 4.5L19 7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="min-w-0">
          <span className="block text-[10px] font-bold leading-tight text-foreground sm:text-xs">
            Real freebies
          </span>
          <span className="block text-[9px] leading-tight text-muted-foreground sm:text-[11px]">
            Checked by our editors
          </span>
        </span>
      </div>

      <div className="absolute bottom-[8%] left-[2%] flex w-[32%] items-center gap-1.5 rounded-card bg-card p-2 shadow-sm sm:p-3">
        <Spark className="h-4 w-4 shrink-0 text-cta sm:h-6 sm:w-6" />
        <span className="font-display text-xs font-extrabold tracking-wide text-foreground sm:text-base">
          YAY! £0
        </span>
      </div>
    </div>
  );
}
