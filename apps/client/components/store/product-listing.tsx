'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getCategoryTree, listCollections, listProducts } from '@/lib/api/storefront';
import { ProductCard } from './product-card';
import { Pagination } from './pagination';
import type { CategoryNode, PageResult, ProductSortKey, StoreCollection, StoreProduct } from '@/types/storefront';

const PAGE_SIZE = 24;
const SORTS: { value: ProductSortKey; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'priceAsc', label: 'Price: low to high' },
  { value: 'priceDesc', label: 'Price: high to low' },
  { value: 'nameAsc', label: 'Name: A to Z' },
];

export interface FixedFilters {
  categoryId?: number;
  collectionId?: number;
  sellerId?: number;
}

function flatten(nodes: CategoryNode[], depth = 0): { id: number; name: string; depth: number }[] {
  return nodes.flatMap((n) => [{ id: n.id, name: n.name, depth }, ...flatten(n.children, depth + 1)]);
}

const control =
  'h-9 rounded-full border border-st-line bg-white px-3 text-sm text-st-ink focus:border-st-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-st-teal/30';

/**
 * Product grid with search, sort, price range and page numbers. Everything the
 * visitor chooses lives in the URL, so a filtered page can be shared or reloaded.
 */
export function ProductListing({
  fixed = {},
  showCategoryFilter = false,
  showCollectionFilter = false,
}: {
  fixed?: FixedFilters;
  showCategoryFilter?: boolean;
  showCollectionFilter?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const topRef = useRef<HTMLDivElement>(null);

  const q = params.get('search') ?? '';
  const sort = (params.get('sort') as ProductSortKey | null) ?? 'newest';
  const min = params.get('min') ?? '';
  const max = params.get('max') ?? '';
  const category = params.get('category') ?? '';
  const collection = params.get('collection') ?? '';
  const featured = params.get('featured') === 'true';
  const pageParam = Number.parseInt(params.get('page') ?? '1', 10);
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const sizeParam = Number.parseInt(params.get('pageSize') ?? '', 10);
  const pageSize = Number.isInteger(sizeParam) ? Math.min(50, Math.max(1, sizeParam)) : PAGE_SIZE;

  const [minInput, setMinInput] = useState(min);
  const [maxInput, setMaxInput] = useState(max);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [data, setData] = useState<PageResult<StoreProduct> | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [collections, setCollections] = useState<StoreCollection[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMinInput(min);
    setMaxInput(max);
  }, [min, max]);

  useEffect(() => {
    if (showCategoryFilter) getCategoryTree().then(setTree).catch(() => undefined);
    if (showCollectionFilter) listCollections().then((r) => setCollections(r.results)).catch(() => undefined);
  }, [showCategoryFilter, showCollectionFilter]);

  const update = useCallback(
    (changes: Record<string, string | null>, keepPage = false) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      if (!keepPage) next.delete('page');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const key = `${q}|${sort}|${min}|${max}|${category}|${collection}|${featured}|${page}|${pageSize}|${fixed.categoryId}|${fixed.collectionId}|${fixed.sellerId}`;
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setFailed(false);
    listProducts({
      search: q || undefined,
      sort,
      page,
      pageSize,
      minPrice: min ? Number(min) : undefined,
      maxPrice: max ? Number(max) : undefined,
      categoryId: fixed.categoryId ?? (category ? Number(category) : undefined),
      collectionId: fixed.collectionId ?? (collection ? Number(collection) : undefined),
      sellerId: fixed.sellerId,
      featured: featured || undefined,
    })
      .then((r) => !cancelled && setData(r))
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  // A page past the end (old link, filter changed elsewhere) falls back to the last page.
  useEffect(() => {
    if (data && data.totalPages > 0 && page > data.totalPages) update({ page: String(data.totalPages) }, true);
  }, [data, page, update]);

  function applyPrice(event: React.FormEvent) {
    event.preventDefault();
    const lo = minInput.trim();
    const hi = maxInput.trim();
    const valid = (v: string) => v === '' || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) <= 9999999999);
    if (!valid(lo) || !valid(hi)) return setPriceError('Enter prices as plain numbers.');
    if (lo && hi && Number(lo) > Number(hi)) return setPriceError('The minimum is higher than the maximum.');
    setPriceError(null);
    update({ min: lo, max: hi });
  }

  const filtered = !!(q || min || max || category || collection || featured);
  const categoryOptions = useMemo(() => flatten(tree), [tree]);
  const from = data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0;
  const to = data ? Math.min(data.total, data.page * data.pageSize) : 0;

  function goToPage(next: number) {
    update({ page: String(next) }, true);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div ref={topRef} className="scroll-mt-28">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {showCategoryFilter && (
          <select aria-label="Category" value={category} onChange={(e) => update({ category: e.target.value })} className={control}>
            <option value="">All categories</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>{`${'– '.repeat(c.depth)}${c.name}`}</option>
            ))}
          </select>
        )}
        {showCollectionFilter && (
          <select aria-label="Collection" value={collection} onChange={(e) => update({ collection: e.target.value })} className={control}>
            <option value="">All collections</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        {featured && (
          <button
            type="button"
            onClick={() => update({ featured: null })}
            aria-label="Remove the featured filter"
            className="inline-flex h-9 items-center gap-2 rounded-full bg-st-ink px-3.5 text-sm font-medium text-white transition-colors hover:bg-st-teal"
          >
            Featured only <span aria-hidden>✕</span>
          </button>
        )}
        <form onSubmit={applyPrice} className="flex items-center gap-1.5">
          <input aria-label="Minimum price" inputMode="decimal" placeholder="Min ৳" value={minInput} onChange={(e) => setMinInput(e.target.value)} className={`${control} w-24`} />
          <span className="text-st-slate" aria-hidden>–</span>
          <input aria-label="Maximum price" inputMode="decimal" placeholder="Max ৳" value={maxInput} onChange={(e) => setMaxInput(e.target.value)} className={`${control} w-24`} />
          <button type="submit" className="h-9 rounded-full bg-st-ink px-4 text-sm font-medium text-white transition-colors hover:bg-st-teal">Apply</button>
        </form>
        {filtered && (
          <button type="button" onClick={() => router.replace(pathname, { scroll: false })} className="h-9 rounded-full px-3 text-sm text-st-slate underline-offset-2 hover:text-st-ink hover:underline">
            Clear filters
          </button>
        )}
        <label className="ml-auto flex items-center gap-2 text-sm text-st-slate">
          Sort
          <select value={sort} onChange={(e) => update({ sort: e.target.value === 'newest' ? null : e.target.value })} className={control}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
      </div>
      {priceError && <p role="alert" className="mb-3 text-sm text-destructive">{priceError}</p>}

      <p className="mb-3 min-h-5 text-sm text-st-slate" aria-live="polite">
        {q && <>Results for <span className="font-medium text-st-ink">“{q}”</span>. </>}
        {data && !failed && (data.total > 0 ? `Showing ${from}–${to} of ${data.total}` : '')}
      </p>

      {failed ? (
        <div className="rounded-xl border border-st-line bg-white px-6 py-14 text-center">
          <p className="font-display text-lg font-semibold">We couldn&apos;t load products</p>
          <p className="mt-1 text-sm text-st-slate">Check your connection and try again.</p>
          <button type="button" onClick={() => setAttempt((a) => a + 1)} className="mt-4 rounded-full bg-st-ink px-5 py-2 text-sm font-semibold text-white hover:bg-st-teal">Try again</button>
        </div>
      ) : loading && !data ? (
        <div className="store-skeleton grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-6" aria-busy="true">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-st-line" />
          ))}
        </div>
      ) : data && data.results.length === 0 ? (
        <div className="rounded-xl border border-st-line bg-white px-6 py-14 text-center">
          <p className="font-display text-lg font-semibold">{filtered ? 'No products match these filters' : 'Nothing here yet'}</p>
          <p className="mt-1 text-sm text-st-slate">{filtered ? 'Try a different search, or widen the price range.' : 'New listings will show up here.'}</p>
          {filtered && (
            <button type="button" onClick={() => router.replace(pathname, { scroll: false })} className="mt-4 rounded-full bg-st-ink px-5 py-2 text-sm font-semibold text-white hover:bg-st-teal">Clear filters</button>
          )}
        </div>
      ) : (
        data && (
          <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4 sm:gap-x-4 lg:grid-cols-6">
              {data.results.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            <Pagination page={data.page} totalPages={data.totalPages} onChange={goToPage} />
          </div>
        )
      )}
    </div>
  );
}
