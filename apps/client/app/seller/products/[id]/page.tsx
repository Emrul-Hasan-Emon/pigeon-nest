'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Copy, Pencil } from 'lucide-react';
import { SellerFrame } from '@/components/seller/seller-frame';
import { ProductLockBanner } from '@/components/seller/product-lock-banner';
import { ProductSkuCard } from '@/components/seller/product-sku-card';
import { SellerBirdFacts } from '@/components/seller/product-bird';
import { SellerProductHistory } from '@/components/seller/product-history';
import { SellerProductReviews } from '@/components/seller/product-reviews';
import { isProductVisible, ProductActiveBadge, ProductStatusBadge } from '@/components/products/status-badges';
import { LoadingBlock } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { sellerProductPortal } from '@/lib/products/portal';
import { copyMyProduct } from '@/lib/api/seller-products';
import { listSellerProposals } from '@/lib/api/proposals';
import { ApiError, NotFoundApiError } from '@/lib/api/http';
import { clearSellerToken, getSellerToken } from '@/lib/auth/seller-token';
import type { Product } from '@/types/product';
import type { Proposal } from '@/types/proposal';
import { useBreadcrumbTitle } from '@/components/ui/breadcrumbs';

/** What customers can and cannot do with this product right now, in plain words. */
function visibilityNote(product: Product) {
  if (isProductVisible(product)) return { text: 'Customers can see and buy this product.', good: true };
  if (product.status === 'pending') return { text: 'Customers cannot see it yet. It is waiting for approval.', good: false };
  if (product.status === 'rejected') return { text: 'Customers cannot see it. It was rejected by an admin.', good: false };
  if (product.activeStatus === 'suspended') return { text: 'Customers cannot see it. It was suspended by an admin.', good: false };
  return { text: 'Customers cannot see it because it is switched off.', good: false };
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-base font-medium text-foreground">{children}</dd>
    </div>
  );
}

/** One product, to read: what it is, how it looks to customers, and the price and stock of every SKU. */
export default function SellerProductDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  useBreadcrumbTitle(product?.name);
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState<Proposal[]>([]);
  const [copying, setCopying] = useState(false);

  // A copy is a new product, switched off. The seller lands on its edit page to change what is different.
  async function copyThis() {
    if (!product) return;
    setCopying(true);
    try {
      const copy = await copyMyProduct(product.id);
      showToast('Copied. The copy is switched off until you turn it on.', 'success');
      router.push(`/seller/products/${copy.id}/edit`);
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Could not copy the product.', 'error');
      setCopying(false);
    }
  }

  useEffect(() => {
    if (!getSellerToken()) {
      router.replace('/seller/login');
      return;
    }
    sellerProductPortal
      .get(Number(params.id))
      .then(setProduct)
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) {
          clearSellerToken();
          router.replace('/seller/login');
          return;
        }
        showToast(error instanceof NotFoundApiError ? 'That product no longer exists.' : 'Failed to load product.', 'error');
        router.replace('/seller/products');
      })
      .finally(() => setLoading(false));
    // The offers customers made on any option of this product. A failure only hides them; the page still works.
    listSellerProposals({ productId: Number(params.id), limit: 100 })
      .then((page) => setOffers(page.results))
      .catch(() => setOffers([]));
  }, [params.id, router, showToast]);

  const offersBySku = useMemo(() => {
    const map = new Map<number, Proposal[]>();
    for (const o of offers) map.set(o.sku.id, [...(map.get(o.sku.id) ?? []), o]);
    return map;
  }, [offers]);

  const locked = product ? product.status === 'rejected' || product.activeStatus === 'suspended' : false;
  const note = product ? visibilityNote(product) : null;
  const skus = product?.skus ?? [];
  const media = product?.media ?? [];

  return (
    <SellerFrame active="products" width="max-w-5xl">
      {loading || !product || !note ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <Link href="/seller/products" className="text-sm text-muted-foreground hover:text-foreground">
                ← My products
              </Link>
              <h1 className="mt-1 text-foreground">{product.name}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ProductStatusBadge status={product.status} />
                <ProductActiveBadge status={product.activeStatus} />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={copyThis}
                disabled={copying}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 font-semibold text-foreground hover:bg-muted disabled:opacity-60"
              >
                <Copy aria-hidden="true" className="h-4 w-4" />
                {copying ? 'Copying…' : 'Copy this product'}
              </button>
              {!locked && (
                <Link
                  href={`/seller/products/${product.id}/edit`}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:opacity-90"
                >
                  <Pencil aria-hidden="true" className="h-4 w-4" />
                  Edit product
                </Link>
              )}
            </div>
          </div>

          <ProductLockBanner product={product} />

          <p className={`rounded-xl px-4 py-3 text-base font-medium ${note.good ? 'bg-accent text-accent-foreground' : 'bg-secondary text-foreground'}`}>
            {note.text}
          </p>

          <section className="grid gap-5 md:grid-cols-3">
            <div className="md:col-span-1">
              {product.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.thumbnailUrl} alt={product.name} className="aspect-square w-full rounded-xl border border-border object-cover" />
              ) : (
                <div className="grid aspect-square w-full place-items-center rounded-xl border border-dashed border-border text-muted-foreground">No picture yet</div>
              )}
            </div>
            <div className="space-y-5 rounded-xl border border-border bg-card p-6 md:col-span-2">
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <Fact label="Category">{product.category?.name ?? '—'}</Fact>
                <Fact label="Collection">{product.collection?.name ?? '—'}</Fact>
                <Fact label="Saved by">
                  {product.wishlistCount ?? 0} {product.wishlistCount === 1 ? 'customer' : 'customers'}
                </Fact>
                <Fact label="Customer rating">{product.ratingCount ? `${product.ratingAverage.toFixed(1)} out of 5 (${product.ratingCount})` : 'No reviews yet'}</Fact>
              </dl>
              <div>
                <h2 className="text-base font-semibold text-foreground">About this product</h2>
                <p className="mt-1 whitespace-pre-line text-base text-muted-foreground">{product.description || 'No description yet.'}</p>
              </div>
            </div>
          </section>

          <SellerBirdFacts product={product} />

          {media.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-6">
              <h2 className="mb-3 text-lg font-semibold text-foreground">Pictures and videos ({media.length})</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
                {media.map((m) => (
                  <div key={m.id} className="relative overflow-hidden rounded-lg border border-border">
                    {m.type === 'video' ? (
                      <video src={m.url} className="aspect-square w-full object-cover" muted />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.url} alt="" className="aspect-square w-full object-cover" />
                    )}
                    {m.isPrimary && <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">Main</span>}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section aria-label="Prices and stock">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="font-[family-name:var(--font-serif)] text-2xl font-medium tracking-tight text-foreground">Prices and stock</h2>
                <p className="mt-0.5 text-base text-muted-foreground">
                  Each option you sell has its own price and its own stock ({skus.length} {skus.length === 1 ? 'option' : 'options'}).
                </p>
              </div>
              {!locked && (
                <Link href={`/seller/products/${product.id}/edit`} className="text-base font-medium text-primary hover:underline">
                  Change prices and stock
                </Link>
              )}
            </div>
            {skus.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-base text-muted-foreground">No options added yet.</p>
            ) : (
              <div className="space-y-4">
                {skus.map((sku) => (
                  <ProductSkuCard key={sku.id} sku={sku} offers={offersBySku.get(sku.id)} />
                ))}
              </div>
            )}
          </section>

          <SellerProductHistory productId={product.id} />

          <SellerProductReviews productId={product.id} />
        </div>
      )}
    </SellerFrame>
  );
}
