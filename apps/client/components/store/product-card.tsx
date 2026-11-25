import Link from 'next/link';
import { Stars } from '@/components/reviews/stars';
import { productHref } from '@/lib/api/storefront';
import type { StoreProduct } from '@/types/storefront';
import { WishlistButton } from './wishlist-button';
import { formatMoney } from '@/lib/money';

export const money = formatMoney;

export function Price({ product, className = '' }: { product: StoreProduct; className?: string }) {
  if (product.price === null) return null;
  const discounted = product.discountedPrice !== null && product.discountedPrice < product.price;
  return (
    <p className={`flex items-baseline gap-2 ${className}`}>
      <span className={`font-semibold ${discounted ? 'text-st-teal' : 'text-st-ink'}`}>
        {money(discounted ? product.discountedPrice! : product.price)}
      </span>
      {discounted && <s className="text-xs text-st-slate">{money(product.price)}</s>}
    </p>
  );
}

function percentOff(product: StoreProduct): number | null {
  if (product.price === null || product.discountedPrice === null || product.discountedPrice >= product.price) return null;
  return Math.round((1 - product.discountedPrice / product.price) * 100);
}

export function ProductCard({ product, layout = 'grid', lot }: { product: StoreProduct; layout?: 'grid' | 'list'; lot?: number }) {
  const off = percentOff(product);

  if (layout === 'list') {
    return (
      <div className="relative">
      <Link href={productHref(product)} className="flex items-center gap-3 rounded-sm border border-st-line bg-white p-2 pr-12 transition-colors hover:border-st-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-sm bg-st-dove">
          {product.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-st-ink">{product.name}</h3>
          {product.seller && <p className="truncate text-sm text-st-slate">{product.seller.name}</p>}
        </div>
        <Price product={product} />
      </Link>
      <WishlistButton productId={product.id} name={product.name} className="absolute right-2 top-1/2 -translate-y-1/2 border border-st-line" />
      </div>
    );
  }

  return (
    <div className="relative h-full">
    <Link href={productHref(product)} className="group flex h-full flex-col focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal">
      <div className="store-plate">
        <div className="store-plate-frame relative aspect-square bg-st-ink-2">
          {product.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.thumbnailUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full items-center justify-center font-display text-4xl text-white/30">{product.name.charAt(0)}</div>
          )}
          {product.vaccinated && (
            <span className="absolute bottom-2 left-2 rounded-sm bg-st-teal px-2 py-0.5 text-[11px] font-semibold text-white">Vaccinated</span>
          )}
          {off !== null && (
            <span className={`absolute top-2 rounded-sm bg-white px-2 py-0.5 text-[11px] font-semibold text-st-teal ${lot !== undefined ? 'left-10' : 'left-2'}`}>
              {off}% off
            </span>
          )}
        </div>
        {lot !== undefined && <span className="store-lot font-mark">{lot}</span>}
      </div>
      <div className="mt-2 flex flex-1 flex-col">
        <h3 className="line-clamp-2 text-[13px] font-medium leading-snug text-st-ink">{product.name}</h3>
        {(product.breed || product.bloodline) && (
          <p className="font-mark truncate text-xs text-st-slate">{[product.breed, product.bloodline].filter(Boolean).join(', ')}</p>
        )}
        {product.seller && <p className="truncate text-xs text-st-slate">{product.seller.name}</p>}
        {product.ratingCount > 0 && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-st-slate">
            <Stars value={product.ratingAverage} size={12} />
            <span aria-hidden>({product.ratingCount})</span>
            <span className="sr-only">{product.ratingAverage} out of 5 from {product.ratingCount} reviews</span>
          </p>
        )}
        <Price product={product} className="mt-1 text-sm" />
      </div>
    </Link>
    <WishlistButton productId={product.id} name={product.name} className="absolute right-2 top-2" />
    </div>
  );
}
