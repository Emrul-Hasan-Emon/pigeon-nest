'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LoadingBlock, NotFoundBlock } from '@/components/store/page-parts';
import { ProductDetailView } from '@/components/store/product-detail';
import { getProduct, parseProductParam, productHref } from '@/lib/api/storefront';
import { NotFoundApiError } from '@/lib/api/http';
import type { ProductDetail } from '@/types/storefront';

export default function ProductPage() {
  const { idSlug } = useParams<{ idSlug: string }>();
  const router = useRouter();
  const id = parseProductParam(idSlug);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [state, setState] = useState<'loading' | 'missing' | 'error' | 'ready'>(id ? 'loading' : 'missing');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState('loading');
    getProduct(id)
      .then((p) => {
        if (cancelled) return;
        setProduct(p);
        setState('ready');
        document.title = `${p.seoTitle || p.name} | Pigeon Nest`;
        const meta = document.querySelector('meta[name="description"]');
        const text = p.seoDescription || p.description?.slice(0, 160);
        if (meta && text) meta.setAttribute('content', text);
        // keep the address canonical when the slug part is old or missing
        const canonical = productHref(p);
        if (window.location.pathname !== canonical) router.replace(canonical, { scroll: false });
      })
      .catch((e) => !cancelled && setState(e instanceof NotFoundApiError ? 'missing' : 'error'));
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  if (state === 'loading') return <LoadingBlock />;
  if (state === 'missing') return <NotFoundBlock title="This product isn't available" hint="It may have sold out, been removed, or the link is wrong." />;
  if (state === 'error' || !product) return <NotFoundBlock title="We couldn't load this product" hint="Check your connection and try again." href={`/products/${idSlug}`} cta="Try again" />;
  return <ProductDetailView key={product.id} product={product} />;
}
