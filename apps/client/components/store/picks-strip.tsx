import Link from 'next/link';
import { productHref } from '@/lib/api/storefront';
import { Price } from './product-card';
import { SellerAvatar } from './seller-avatar';
import type { StoreCategory, StoreCollection, StoreProduct, StoreSection, StoreSeller } from '@/types/storefront';

const PRODUCT_TYPES = new Set(['category_products', 'collection_products', 'specific_products', 'featured_products']);

/** One slot row: a product (photo, name, price), a seller (avatar, name) or a
 * category/collection (photo, name) — whatever the slot's section type holds. */
function SlotRow({ sectionType, item }: { sectionType: string; item: unknown }) {
  if (sectionType === 'sellers') {
    const s = item as StoreSeller;
    return (
      <Link href={`/sellers/${s.id}`} className="flex items-center gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal">
        <SellerAvatar name={s.name} url={s.avatarUrl} size={40} />
        <p className="line-clamp-2 text-[13px] font-medium leading-snug text-st-ink">{s.name}</p>
      </Link>
    );
  }

  if (PRODUCT_TYPES.has(sectionType)) {
    const p = item as StoreProduct;
    return (
      <Link href={productHref(p)} className="flex items-center gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-sm bg-st-ink-2">
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
    );
  }

  // categories or specific_collections
  const entry = item as StoreCategory & StoreCollection;
  const href = sectionType === 'categories' ? `/categories/${entry.slug}` : `/collections/${entry.slug}`;
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal">
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-sm bg-st-ink-2">
        {entry.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        )}
      </div>
      <p className="line-clamp-2 text-[13px] font-medium leading-snug text-st-ink">{entry.name}</p>
    </Link>
  );
}

/** The four fixed homepage slots: compact panels that overlap the hero. */
export function PicksStrip({ slots }: { slots: StoreSection[] }) {
  if (slots.length === 0) return null;
  return (
    <section aria-label="Editor's picks" className="relative z-10 mx-auto -mt-6 max-w-7xl px-4 sm:px-6">
      <div className="store-scroll -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
        {slots.map((slot) => (
          <div key={slot.id} className="w-[78%] shrink-0 snap-start border border-st-line bg-white p-3.5 sm:w-[46%] lg:w-auto">
            <h2 className="font-display text-base font-semibold text-st-ink">{slot.title}</h2>
            <ul className="mt-2.5 space-y-2">
              {slot.items.map((item) => (
                <li key={(item as { id: number }).id}>
                  <SlotRow sectionType={slot.sectionType} item={item} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
