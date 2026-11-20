import Link from 'next/link';
import { productHref } from '@/lib/api/storefront';
import { Price } from './product-card';
import type { StoreProduct, StoreSection } from '@/types/storefront';

/** The four fixed homepage slots: compact panels that overlap the hero. */
export function PicksStrip({ slots }: { slots: StoreSection[] }) {
  if (slots.length === 0) return null;
  return (
    <section aria-label="Editor's picks" className="relative z-10 mx-auto -mt-6 max-w-7xl px-4 sm:px-6">
      <div className="store-scroll -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
        {slots.map((slot) => (
          <div key={slot.id} className="w-[78%] shrink-0 snap-start rounded-xl border border-st-line bg-white p-3.5 shadow-[0_14px_30px_-22px_rgba(17,21,27,0.5)] sm:w-[46%] lg:w-auto">
            <h2 className="font-display text-base font-semibold text-st-ink">{slot.title}</h2>
            <ul className="mt-2.5 space-y-2">
              {(slot.items as StoreProduct[]).map((p) => (
                <li key={p.id}>
                  <Link href={productHref(p)} className="flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-st-ink-2">
                    {p.thumbnailUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 text-[13px]">
                    <p className="line-clamp-2 font-medium leading-snug text-st-ink">{p.name}</p>
                    <Price product={p} className="text-xs" />
                  </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
