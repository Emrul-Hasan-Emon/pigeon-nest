'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { listSellers } from '@/lib/api/storefront';
import { Pagination } from './pagination';
import { SellerAvatar } from './seller-avatar';
import type { PageResult, SellerCard } from '@/types/storefront';

const PAGE_SIZE = 24;
const control =
  'h-9 rounded-full border border-st-line bg-white px-3 text-sm text-st-ink focus:border-st-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-st-teal/30';

export function joinedLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export function SellerListing() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const topRef = useRef<HTMLDivElement>(null);

  const q = params.get('search') ?? '';
  const sort = params.get('sort') === 'nameAsc' ? 'nameAsc' : 'newest';
  const pageParam = Number.parseInt(params.get('page') ?? '1', 10);
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const sizeParam = Number.parseInt(params.get('pageSize') ?? '', 10);
  const pageSize = Number.isInteger(sizeParam) ? Math.min(50, Math.max(1, sizeParam)) : PAGE_SIZE;

  const [searchInput, setSearchInput] = useState(q);
  const [data, setData] = useState<PageResult<SellerCard> | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchInput(q);
  }, [q]);

  const update = useCallback(
    (changes: Record<string, string | null>, keepPage = false) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(changes)) {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      }
      if (!keepPage) next.delete('page');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setFailed(false);
    listSellers({ search: q || undefined, sort, page, pageSize })
      .then((r) => !cancelled && setData(r))
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [q, sort, page, pageSize, attempt]);

  useEffect(() => {
    if (data && data.totalPages > 0 && page > data.totalPages) update({ page: String(data.totalPages) }, true);
  }, [data, page, update]);

  return (
    <div ref={topRef} className="scroll-mt-28">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update({ search: searchInput.trim() });
          }}
          className="flex items-center gap-1.5"
        >
          <input aria-label="Search sellers" placeholder="Search sellers" maxLength={200} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className={`${control} w-56`} />
          <button type="submit" className="h-9 rounded-full bg-st-ink px-4 text-sm font-medium text-white transition-colors hover:bg-st-teal">Search</button>
        </form>
        {q && (
          <button type="button" onClick={() => update({ search: null })} className="h-9 rounded-full px-3 text-sm text-st-slate hover:text-st-ink hover:underline">Clear search</button>
        )}
        <label className="ml-auto flex items-center gap-2 text-sm text-st-slate">
          Sort
          <select value={sort} onChange={(e) => update({ sort: e.target.value === 'newest' ? null : e.target.value })} className={control}>
            <option value="newest">Newest</option>
            <option value="nameAsc">Name: A to Z</option>
          </select>
        </label>
      </div>

      <p className="mb-3 min-h-5 text-sm text-st-slate" aria-live="polite">
        {data && !failed && data.total > 0 && `Showing ${(data.page - 1) * data.pageSize + 1}–${Math.min(data.total, data.page * data.pageSize)} of ${data.total}`}
      </p>

      {failed ? (
        <div className="rounded-xl border border-st-line bg-white px-6 py-14 text-center">
          <p className="font-display text-lg font-semibold">We couldn&apos;t load sellers</p>
          <p className="mt-1 text-sm text-st-slate">Check your connection and try again.</p>
          <button type="button" onClick={() => setAttempt((a) => a + 1)} className="mt-4 rounded-full bg-st-ink px-5 py-2 text-sm font-semibold text-white hover:bg-st-teal">Try again</button>
        </div>
      ) : loading && !data ? (
        <div className="store-skeleton grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-st-line" />)}
        </div>
      ) : data && data.results.length === 0 ? (
        <div className="rounded-xl border border-st-line bg-white px-6 py-14 text-center">
          <p className="font-display text-lg font-semibold">{q ? 'No sellers match that search' : 'No sellers yet'}</p>
          <p className="mt-1 text-sm text-st-slate">{q ? 'Try a different name.' : 'Sellers appear here once they list something.'}</p>
          {q && <button type="button" onClick={() => update({ search: null })} className="mt-4 rounded-full bg-st-ink px-5 py-2 text-sm font-semibold text-white hover:bg-st-teal">Clear search</button>}
        </div>
      ) : (
        data && (
          <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.results.map((s) => (
                <li key={s.id}>
                  <Link href={`/sellers/${s.id}`} className="flex items-center gap-3 rounded-xl border border-st-line bg-white p-3 transition-colors hover:border-st-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal">
                    <SellerAvatar name={s.name} url={s.avatarUrl} size={44} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-st-ink">{s.name}</p>
                      <p className="text-xs text-st-slate">
                        {s.productCount} {s.productCount === 1 ? 'product' : 'products'} · since {joinedLabel(s.joinedAt)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              onChange={(p) => {
                update({ page: String(p) }, true);
                topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            />
          </div>
        )
      )}
    </div>
  );
}
