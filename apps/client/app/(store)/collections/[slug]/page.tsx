'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Breadcrumb, Container, LoadingBlock, NotFoundBlock } from '@/components/store/page-parts';
import { ProductListing } from '@/components/store/product-listing';
import { getCollection } from '@/lib/api/storefront';
import { NotFoundApiError } from '@/lib/api/http';
import type { StoreCollectionDetail } from '@/types/storefront';

export default function CollectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const [collection, setCollection] = useState<StoreCollectionDetail | null>(null);
  const [state, setState] = useState<'loading' | 'missing' | 'error' | 'ready'>('loading');

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState('loading');
    getCollection(slug)
      .then((c) => {
        if (cancelled) return;
        setCollection(c);
        setState('ready');
        document.title = `${c.name} | Pigeon Nest`;
      })
      .catch((e) => !cancelled && setState(e instanceof NotFoundApiError ? 'missing' : 'error'));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (state === 'loading') return <LoadingBlock />;
  if (state === 'missing') return <NotFoundBlock title="This collection isn't available" hint="It may have ended or been removed." />;
  if (state === 'error' || !collection) return <NotFoundBlock title="We couldn't load this collection" hint="Check your connection and try again." href={`/collections/${slug}`} cta="Try again" />;

  return (
    <Container>
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Collections', href: '/collections' }, { label: collection.name }]} />
      <div className="flex items-center gap-3">
        {collection.colorCode && <span className="h-7 w-1.5 rounded-full" style={{ background: collection.colorCode }} aria-hidden />}
        <h1 className="font-display text-2xl font-semibold text-st-ink sm:text-3xl">{collection.name}</h1>
      </div>
      {collection.description && <p className="mt-1 max-w-2xl text-sm text-st-slate">{collection.description}</p>}
      <div className="mt-5">
        <Suspense>
          <ProductListing key={collection.id} fixed={{ collectionId: collection.id }} showCategoryFilter />
        </Suspense>
      </div>
    </Container>
  );
}
