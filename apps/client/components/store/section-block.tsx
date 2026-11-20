import Link from 'next/link';
import { seeAllHref } from '@/lib/api/storefront';
import { SellerAvatar } from './seller-avatar';
import { ProductCard } from './product-card';
import { Rail } from './rail';
import type {
  StoreBanner,
  StoreCategory,
  StoreCollection,
  StoreProduct,
  StoreSection,
  StoreSeller,
} from '@/types/storefront';

const PRODUCT_TYPES = new Set(['category_products', 'collection_products', 'specific_products', 'featured_products']);

const GRID_COLS: Record<string, string> = {
  product: 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-6',
  category: 'grid-cols-3 sm:grid-cols-5 lg:grid-cols-6',
  collection: 'grid-cols-2 lg:grid-cols-4',
  seller: 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6',
};

/** A tile with art behind a name — used for categories and collections. */
export function ImageTile({ item, tall, accent, href }: { item: StoreCategory | StoreCollection; tall: boolean; accent?: string | null; href: string }) {
  return (
    <Link
      href={href}
      className={`group relative isolate block overflow-hidden rounded-xl bg-st-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal ${tall ? 'aspect-[5/4]' : 'aspect-[16/8]'}`}
    >
      {item.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-st-ink/80 via-st-ink/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3.5">
        {accent && <span className="mb-1.5 block h-0.5 w-6 rounded-full" style={{ background: accent }} />}
        <h3 className="font-display text-sm font-semibold leading-tight text-white sm:text-lg">{item.name}</h3>
      </div>
    </Link>
  );
}

function SellerChip({ seller }: { seller: StoreSeller }) {
  return (
    <Link
      href={`/sellers/${seller.id}`}
      className="flex flex-col items-center gap-2 rounded-xl border border-st-line bg-white p-3 text-center transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal"
    >
      <SellerAvatar name={seller.name} url={seller.avatarUrl} size={44} />
      <h3 className="line-clamp-2 text-xs font-medium leading-snug text-st-ink">{seller.name}</h3>
    </Link>
  );
}

function PromoBanner({ banner }: { banner: StoreBanner }) {
  return (
    <div className="relative isolate flex min-h-[120px] items-end overflow-hidden rounded-2xl bg-st-ink text-white sm:min-h-[140px] sm:items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={banner.imageUrl} alt="" loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-st-ink/75 via-st-ink/25 to-transparent max-sm:bg-gradient-to-t" />
      <div className="max-w-xl p-4 sm:px-9 sm:py-6">
        <h2 className="font-display text-lg font-semibold leading-tight text-balance sm:text-2xl">{banner.title}</h2>
        {banner.linkUrl && (
          <Link
            href={banner.linkUrl}
            className="mt-3 inline-flex rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-st-ink transition-colors hover:bg-st-dove focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Learn more
          </Link>
        )}
      </div>
    </div>
  );
}

export function SectionBlock({ section }: { section: StoreSection }) {
  const type = section.sectionType;

  if (type === 'banners') {
    return (
      <section className="mx-auto max-w-7xl space-y-3 px-4 sm:px-6" aria-label={section.title}>
        {(section.items as StoreBanner[]).map((b) => (
          <PromoBanner key={b.id} banner={b} />
        ))}
      </section>
    );
  }

  const isProduct = PRODUCT_TYPES.has(type);
  const kind = isProduct ? 'product' : type === 'categories' ? 'category' : type === 'sellers' ? 'seller' : 'collection';
  const layout = section.layout;

  const cell = (item: unknown) => {
    if (kind === 'product') return <ProductCard product={item as StoreProduct} layout={layout === 'list' ? 'list' : 'grid'} />;
    if (kind === 'seller') return <SellerChip seller={item as StoreSeller} />;
    const entry = item as StoreCategory & StoreCollection;
    return (
      <ImageTile
        item={entry}
        tall={kind === 'category'}
        accent={kind === 'collection' ? entry.colorCode : null}
        href={kind === 'category' ? `/categories/${entry.slug}` : `/collections/${entry.slug}`}
      />
    );
  };
  const key = (item: unknown) => (item as { id: number }).id;

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6" aria-label={section.title}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="font-display text-lg font-semibold leading-tight text-st-ink sm:text-2xl">{section.title}</h2>
        {section.seeAll && (
          <Link
            href={seeAllHref(section.seeAll)}
            aria-label={`See all ${section.title}`}
            className="shrink-0 rounded-full border border-st-line bg-white px-3.5 py-1 text-sm font-medium text-st-ink transition-colors hover:bg-st-ink hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal"
          >
            See all
          </Link>
        )}
      </div>

      {layout === 'carousel' ? (
        <Rail label={section.title}>
          {section.items.map((item) => (
            <div
              key={key(item)}
              className={`shrink-0 snap-start ${
                kind === 'product'
                  ? 'w-[40%] sm:w-[26%] md:w-[19%] lg:w-[15.6%]'
                  : kind === 'seller'
                    ? 'w-[30%] sm:w-[22%] md:w-[16%] lg:w-[12.6%]'
                    : kind === 'category'
                      ? 'w-[32%] sm:w-[22%] lg:w-[15.6%]'
                      : 'w-[56%] sm:w-[36%] lg:w-[24%]'
              }`}
            >
              {cell(item)}
            </div>
          ))}
        </Rail>
      ) : layout === 'list' ? (
        <div className="grid gap-2 md:grid-cols-2">
          {section.items.map((item) => (
            <div key={key(item)}>{cell(item)}</div>
          ))}
        </div>
      ) : (
        <div className={`grid gap-x-3 gap-y-5 sm:gap-x-4 ${GRID_COLS[kind]}`}>
          {section.items.map((item) => (
            <div key={key(item)}>{cell(item)}</div>
          ))}
        </div>
      )}
    </section>
  );
}
