'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/cart/cart-context';
import { ApiError } from '@/lib/api/http';
import { Stars } from '@/components/reviews/stars';
import { ProductQuestions } from './product-questions';
import { ProductReviews } from './product-reviews';
import { ProposalPanel } from './proposal-panel';
import { SellerCartPanel } from './seller-cart-panel';
import { WishlistButton } from './wishlist-button';
import { money } from './product-card';
import { ProductCard } from './product-card';
import { Breadcrumb, Container } from './page-parts';
import { AboutBird, SelectedBird } from './bird-panel';
import type { ProductDetail, ProductSku } from '@/types/storefront';

interface GalleryItem {
  url: string;
  type: 'image' | 'video';
  alt: string;
}

/** Picks the SKU that holds `valueId` and agrees with as many other chosen values as possible. */
function nextSelection(
  skus: ProductSku[],
  current: Record<number, number>,
  attributeId: number,
  valueId: number,
): Record<number, number> {
  const candidates = skus.filter((k) => k.variants.some((v) => v.attributeId === attributeId && v.valueId === valueId));
  if (candidates.length === 0) return current;
  const score = (k: ProductSku) =>
    k.variants.filter((v) => v.attributeId !== attributeId && current[v.attributeId] === v.valueId).length * 10 +
    (k.inStock ? 2 : 0) +
    (k.isDefault ? 1 : 0);
  const best = [...candidates].sort((a, b) => score(b) - score(a))[0];
  return Object.fromEntries(best.variants.map((v) => [v.attributeId, v.valueId]));
}

function matchSku(skus: ProductSku[], selected: Record<number, number>): ProductSku | undefined {
  return skus.find((k) => k.variants.every((v) => selected[v.attributeId] === v.valueId) && k.variants.length === Object.keys(selected).length);
}

export function ProductDetailView({ product }: { product: ProductDetail }) {
  const defaultSku = product.skus.find((k) => k.isDefault) ?? product.skus[0];
  const [selected, setSelected] = useState<Record<number, number>>(() =>
    Object.fromEntries((defaultSku?.variants ?? []).map((v) => [v.attributeId, v.valueId])),
  );
  const sku = useMemo(() => (product.options.length === 0 ? defaultSku : matchSku(product.skus, selected)), [product, selected, defaultSku]);

  const gallery = useMemo<GalleryItem[]>(() => {
    const items: GalleryItem[] = [];
    const seen = new Set<string>();
    const add = (url: string | null | undefined, type: 'image' | 'video', alt: string) => {
      if (url && !seen.has(url)) {
        seen.add(url);
        items.push({ url, type, alt });
      }
    };
    add(product.thumbnailUrl, 'image', product.name);
    for (const m of product.media) add(m.url, m.type === 'video' ? 'video' : 'image', m.altText ?? product.name);
    for (const k of product.skus) add(k.imageUrl, 'image', `${product.name} ${k.sku}`);
    return items;
  }, [product]);

  const [active, setActive] = useState(0);

  const { addItem } = useCart();
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [addMessage, setAddMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Choosing a variant with its own photo shows that photo.
  useEffect(() => {
    if (sku?.imageUrl) {
      const i = gallery.findIndex((g) => g.url === sku.imageUrl);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (i >= 0) setActive(i);
    }
  }, [sku, gallery]);

  const shown = gallery[active] ?? gallery[0];
  const price = sku ? sku.effectivePrice : null;
  const listPrice = sku && sku.discountedPrice !== null && sku.discountedPrice < sku.price ? sku.price : null;
  const off = listPrice && price !== null ? Math.round((1 - price / listPrice) * 100) : null;

  const maxQty = sku ? Math.max(1, Math.min(99, sku.quantity)) : 1;
  const canBuy = !!sku && sku.inStock;

  // A different variant can have less stock than the quantity chosen.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQty((q) => Math.min(Math.max(1, q), maxQty));
    setAddMessage(null);
  }, [sku?.id, maxQty]);

  async function handleAdd() {
    if (!sku) return;
    setAdding(true);
    setAddMessage(null);
    try {
      const result = await addItem({ sellerProductId: product.id, sellerProductSkuId: sku.id, quantity: qty });
      setAddMessage({ ok: true, text: result.notice ?? 'Added to your cart.' });
    } catch (e) {
      setAddMessage({ ok: false, text: e instanceof ApiError ? e.message : 'We could not add that. Try again.' });
    } finally {
      setAdding(false);
    }
  }

  const valueUnavailable = (attributeId: number, valueId: number) => {
    const withValue = product.skus.filter((k) => k.variants.some((v) => v.attributeId === attributeId && v.valueId === valueId));
    return withValue.length > 0 && withValue.every((k) => !k.inStock);
  };

  const crumbs = [
    { label: 'Home', href: '/' },
    ...product.breadcrumb.map((b) => ({ label: b.name, href: `/categories/${b.slug}` })),
    { label: product.name },
  ];

  return (
    <Container>
      <Breadcrumb items={crumbs} />
      <div className="grid gap-6 md:grid-cols-[minmax(0,26rem)_1fr] lg:grid-cols-[minmax(0,30rem)_1fr] lg:gap-10">
        {/* gallery */}
        <div>
          <div className="store-plate">
            <div className="store-plate-frame relative aspect-[4/3] bg-st-ink-2 md:aspect-square">
              {shown ? (
                shown.type === 'video' ? (
                  <video key={shown.url} src={shown.url} controls className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={shown.url} src={shown.url} alt={shown.alt} className="h-full w-full object-cover" />
                )
              ) : (
                <div className="flex h-full items-center justify-center font-display text-6xl text-white/25">{product.name.charAt(0)}</div>
              )}
              {off !== null && (
                <span className="absolute left-3 top-3 rounded-sm bg-white px-2.5 py-1 text-xs font-semibold text-st-teal">{off}% off</span>
              )}
            </div>
          </div>
          {gallery.length > 1 && (
            <ul className="store-scroll mt-2 flex gap-2 overflow-x-auto pb-1" aria-label="Product images">
              {gallery.map((g, i) => (
                <li key={g.url} className="shrink-0">
                  <button
                    type="button"
                    aria-label={`Show image ${i + 1}`}
                    aria-current={i === active}
                    onClick={() => setActive(i)}
                    className={`relative block h-14 w-14 overflow-hidden rounded-sm border-2 bg-st-ink-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal ${i === active ? 'border-st-ink' : 'border-transparent hover:border-st-line'}`}
                  >
                    {g.type === 'video' ? (
                      <span className="flex h-full w-full items-center justify-center text-white">▶</span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.url} alt="" className="h-full w-full object-cover" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* buy box */}
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold leading-tight text-st-ink sm:text-3xl">{product.name}</h1>
          {product.ratingCount > 0 && (
            <a href="#reviews" className="mt-1 inline-flex items-center gap-2 text-sm text-st-slate hover:text-st-ink">
              <Stars value={product.ratingAverage} />
              <span>{product.ratingAverage.toFixed(1)} · {product.ratingCount} {product.ratingCount === 1 ? 'review' : 'reviews'}</span>
            </a>
          )}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-st-slate">
            <span>
              Sold by{' '}
              <Link href={`/sellers/${product.seller.id}`} className="font-medium text-st-ink underline-offset-2 hover:underline">
                {product.seller.name}
              </Link>
            </span>
            {product.collection && (
              <Link href={`/collections/${product.collection.slug}`} className="inline-flex items-center gap-1.5 rounded-full border border-st-line bg-white px-2.5 py-0.5 text-xs text-st-ink hover:bg-st-dove">
                {product.collection.colorCode && <span className="h-2 w-2 rounded-full" style={{ background: product.collection.colorCode }} aria-hidden />}
                {product.collection.name}
              </Link>
            )}
          </p>

          <div className="mt-4 flex flex-wrap items-baseline gap-x-3">
            {price !== null ? (
              <>
                <span className={`font-display text-3xl font-semibold ${listPrice ? 'text-st-teal' : 'text-st-ink'}`}>{money(price)}</span>
                {listPrice && <s className="text-base text-st-slate">{money(listPrice)}</s>}
              </>
            ) : (
              <span className="text-sm text-st-slate">This combination isn&apos;t available</span>
            )}
          </div>
          <p className="mt-1 text-sm" aria-live="polite">
            {!sku ? (
              <span className="text-st-slate">Pick a different option.</span>
            ) : !sku.inStock ? (
              <span className="font-medium text-st-slate">Out of stock</span>
            ) : sku.lowStock ? (
              <span className="font-medium text-amber-700">Only {sku.quantity} left</span>
            ) : (
              <span className="font-medium text-emerald-700">In stock</span>
            )}
          </p>

          {product.options.length > 0 && (
            <div className="mt-5 space-y-4">
              {product.options.map((o) => (
                <fieldset key={o.attributeId}>
                  <legend className="mb-1.5 text-sm font-medium text-st-ink">
                    {o.name}
                    <span className="ml-2 font-normal text-st-slate">{o.values.find((v) => v.id === selected[o.attributeId])?.name}</span>
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {o.values.map((v) => {
                      const on = selected[o.attributeId] === v.id;
                      const out = valueUnavailable(o.attributeId, v.id);
                      return (
                        <button
                          key={v.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setSelected((cur) => nextSelection(product.skus, cur, o.attributeId, v.id))}
                          className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal ${
                            on ? 'border-st-ink bg-st-ink text-white' : 'border-st-line bg-white text-st-ink hover:border-st-ink'
                          } ${out && !on ? 'text-st-slate line-through decoration-st-slate/60' : ''}`}
                        >
                          {v.colorCode && <span className="h-3.5 w-3.5 rounded-full border border-black/15" style={{ background: v.colorCode }} aria-hidden />}
                          {v.name}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center rounded-full border border-st-line bg-white">
              <button type="button" aria-label="Fewer" disabled={!canBuy || qty <= 1} onClick={() => setQty((q) => q - 1)} className="h-10 w-10 rounded-full text-lg hover:bg-st-dove disabled:opacity-30">−</button>
              <span className="min-w-8 text-center tabular-nums" aria-live="polite">{qty}</span>
              <button type="button" aria-label="More" disabled={!canBuy || qty >= maxQty} onClick={() => setQty((q) => q + 1)} className="h-10 w-10 rounded-full text-lg hover:bg-st-dove disabled:opacity-30">+</button>
            </div>
            <button
              type="button"
              disabled={!canBuy || adding}
              onClick={handleAdd}
              className="h-10 rounded-full bg-st-ink px-7 text-sm font-semibold text-white transition-colors hover:bg-st-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal disabled:cursor-not-allowed disabled:opacity-40"
            >
              {adding ? 'Adding…' : canBuy ? 'Add to cart' : 'Unavailable'}
            </button>
            <WishlistButton productId={product.id} name={product.name} variant="inline" />
          </div>
          {addMessage && (
            <p role={addMessage.ok ? 'status' : 'alert'} className={`mt-2 text-sm ${addMessage.ok ? 'text-st-teal' : 'text-destructive'}`}>{addMessage.text}</p>
          )}

          <SelectedBird bird={sku?.bird} />

          {sku && (
            <div className="mt-5">
              <ProposalPanel productPath={`/products/${product.id}-${product.slug}`} sku={sku} />
            </div>
          )}

          <div className="mt-5">
            <SellerCartPanel sellerId={product.seller.id} sellerName={product.seller.name} />
          </div>

          {product.description && (
            <section className="mt-6 border-t border-st-line pt-4">
              <h2 className="font-display text-lg font-semibold text-st-ink">About this bird or item</h2>
              <p className="mt-1.5 max-w-prose whitespace-pre-line text-sm leading-relaxed text-st-slate">{product.description}</p>
            </section>
          )}

          <AboutBird bird={product.bird} />

          <section className="mt-6 flex items-center gap-3 rounded-xl border border-st-line bg-white p-3">
            <div className="rounded-full bg-gradient-to-br from-[#2e8f8b] via-[#4a6fa5] to-[#6a55a8] p-[2px]">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-st-ink font-display text-sm font-semibold text-white">
                {product.seller.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.seller.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  product.seller.name.split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('')
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-st-ink">{product.seller.name}</p>
              <p className="text-xs text-st-slate">{product.seller.productCount} {product.seller.productCount === 1 ? 'product' : 'products'} for sale</p>
            </div>
            <Link href={`/sellers/${product.seller.id}`} className="rounded-full border border-st-line px-4 py-1.5 text-sm font-medium text-st-ink transition-colors hover:bg-st-ink hover:text-white">
              Visit seller
            </Link>
          </section>

          {sku && <p className="mt-3 text-xs text-st-slate">SKU {sku.sku}</p>}
        </div>
      </div>

      <ProductQuestions productId={product.id} sellerName={product.seller.name} />

      <ProductReviews productId={product.id} />

      {product.related.length > 0 && (
        <section className="mt-10" aria-label="Related products">
          <h2 className="font-display mb-3 text-lg font-semibold text-st-ink sm:text-2xl">
            More in {product.category?.name ?? 'this category'}
          </h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4 sm:gap-x-4 lg:grid-cols-6">
            {product.related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </Container>
  );
}
