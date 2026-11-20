import Link from 'next/link';
import { productHref } from '@/lib/api/storefront';
import type { StoreProduct } from '@/types/storefront';

export const money = (value: number) => `৳${value.toLocaleString('en-US')}`;

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

export function ProductCard({ product, layout = 'grid' }: { product: StoreProduct; layout?: 'grid' | 'list' }) {
  const off = percentOff(product);

  if (layout === 'list') {
    return (
      <Link href={productHref(product)} className="flex items-center gap-3 rounded-xl border border-st-line bg-white p-2 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-st-dove">
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
    );
  }

  return (
    <Link href={productHref(product)} className="group flex h-full flex-col rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-st-ink-2">
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
        {off !== null && (
          <span className="absolute left-2 top-2 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-st-teal">
            {off}% off
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-1 flex-col">
        <h3 className="line-clamp-2 text-[13px] font-medium leading-snug text-st-ink">{product.name}</h3>
        {product.seller && <p className="truncate text-xs text-st-slate">{product.seller.name}</p>}
        <Price product={product} className="mt-1 text-sm" />
      </div>
    </Link>
  );
}
