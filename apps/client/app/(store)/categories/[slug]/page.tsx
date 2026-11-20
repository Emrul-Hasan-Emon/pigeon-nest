'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Breadcrumb, Container, LoadingBlock, NotFoundBlock } from '@/components/store/page-parts';
import { ProductListing } from '@/components/store/product-listing';
import { getCategory } from '@/lib/api/storefront';
import { NotFoundApiError } from '@/lib/api/http';
import type { StoreCategoryDetail } from '@/types/storefront';

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const [category, setCategory] = useState<StoreCategoryDetail | null>(null);
  const [state, setState] = useState<'loading' | 'missing' | 'error' | 'ready'>('loading');

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState('loading');
    getCategory(slug)
      .then((c) => {
        if (cancelled) return;
        setCategory(c);
        setState('ready');
        document.title = `${c.name} | Pigeon Nest`;
      })
      .catch((e) => !cancelled && setState(e instanceof NotFoundApiError ? 'missing' : 'error'));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (state === 'loading') return <LoadingBlock />;
  if (state === 'missing') return <NotFoundBlock title="This category isn't available" hint="It may have been renamed or removed." />;
  if (state === 'error' || !category) return <NotFoundBlock title="We couldn't load this category" hint="Check your connection and try again." href={`/categories/${slug}`} cta="Try again" />;

  return (
    <Container>
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          ...category.breadcrumb.map((b) => ({ label: b.name, href: `/categories/${b.slug}` })),
          { label: category.name },
        ]}
      />
      <h1 className="font-display text-2xl font-semibold text-st-ink sm:text-3xl">{category.name}</h1>
      {category.description && <p className="mt-1 max-w-2xl text-sm text-st-slate">{category.description}</p>}
      {category.children.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Subcategories">
          {category.children.map((c) => (
            <li key={c.id}>
              <Link href={`/categories/${c.slug}`} className="inline-flex rounded-full border border-st-line bg-white px-3.5 py-1 text-sm text-st-ink transition-colors hover:bg-st-ink hover:text-white">
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5">
        <Suspense>
          <ProductListing key={category.id} fixed={{ categoryId: category.id }} />
        </Suspense>
      </div>
    </Container>
  );
}
