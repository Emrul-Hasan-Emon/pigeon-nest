'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Breadcrumb, Container, LoadingBlock, NotFoundBlock } from '@/components/store/page-parts';
import { ProductListing } from '@/components/store/product-listing';
import { SellerReviewsBlock } from '@/components/store/seller-reviews-block';
import { ShareButton } from '@/components/store/share-button';
import { Stars } from '@/components/reviews/stars';
import { SellerAvatar } from '@/components/store/seller-avatar';
import { SellerCartPanel } from '@/components/store/seller-cart-panel';
import { joinedLabel } from '@/components/store/seller-listing';
import { getSeller } from '@/lib/api/storefront';
import { NotFoundApiError } from '@/lib/api/http';
import type { SellerDetails } from '@/types/storefront';

export default function SellerPage() {
  const { id: idParam } = useParams<{ id: string }>();
  const id = /^\d+$/.test(idParam) ? Number(idParam) : null;
  const [seller, setSeller] = useState<SellerDetails | null>(null);
  const [state, setState] = useState<'loading' | 'missing' | 'error' | 'ready'>(id ? 'loading' : 'missing');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState('loading');
    getSeller(id)
      .then((s) => {
        if (cancelled) return;
        setSeller(s);
        setState('ready');
        document.title = `${s.name} | Pigeon Nest`;
      })
      .catch((e) => !cancelled && setState(e instanceof NotFoundApiError ? 'missing' : 'error'));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state === 'loading') return <LoadingBlock />;
  if (state === 'missing') return <NotFoundBlock title="This seller isn't available" hint="They may have paused selling, or the link is wrong." href="/sellers" cta="See all sellers" />;
  if (state === 'error' || !seller) return <NotFoundBlock title="We couldn't load this seller" hint="Check your connection and try again." href={`/sellers/${idParam}`} cta="Try again" />;

  return (
    <Container>
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Sellers', href: '/sellers' }, { label: seller.name }]} />
      <header className="mb-5 rounded-xl border border-st-line bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-4">
          <SellerAvatar name={seller.name} url={seller.avatarUrl} size={64} />
          <div className="min-w-0 flex-1">
            <h1 className="font-display truncate text-2xl font-semibold text-st-ink sm:text-3xl">{seller.name}</h1>
            <p className="text-sm text-st-slate">
              {seller.productCount} {seller.productCount === 1 ? 'product' : 'products'} for sale · selling since {joinedLabel(seller.joinedAt)}
            </p>
            {seller.ratingCount > 0 && (
              <a href="#seller-reviews-title" className="mt-1 inline-flex items-center gap-2 text-sm text-st-slate hover:text-st-ink">
                <Stars value={seller.ratingAverage} size={16} />
                <span>
                  {seller.ratingAverage.toFixed(1)} · {seller.ratingCount} {seller.ratingCount === 1 ? 'review' : 'reviews'}
                </span>
              </a>
            )}
          </div>
          <ShareButton title={`${seller.name} on Pigeon Nest`} text={`See ${seller.name}'s pigeons on Pigeon Nest`} />
        </div>
        {seller.description && <p className="mt-4 whitespace-pre-line border-t border-st-line pt-4 text-st-ink">{seller.description}</p>}
      </header>
      <div className="mb-5">
        <SellerCartPanel sellerId={seller.id} sellerName={seller.name} />
      </div>
      <Suspense>
        <ProductListing key={seller.id} fixed={{ sellerId: seller.id }} showCategoryFilter />
      </Suspense>
      <div className="mt-8">
        <SellerReviewsBlock seller={seller} />
      </div>
    </Container>
  );
}
