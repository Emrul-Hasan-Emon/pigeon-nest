'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Breadcrumb, Container } from '@/components/store/page-parts';
import { Pagination } from '@/components/store/pagination';
import { ImageTile } from '@/components/store/section-block';
import { listCollections } from '@/lib/api/storefront';
import type { PageResult, StoreCollection } from '@/types/storefront';

const PAGE_SIZE = 24;

function CollectionList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const topRef = useRef<HTMLDivElement>(null);
  const pageParam = Number.parseInt(params.get('page') ?? '1', 10);
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  const [data, setData] = useState<PageResult<StoreCollection> | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFailed(false);
    listCollections(page, PAGE_SIZE)
      .then((r) => {
        if (cancelled) return;
        if (r.totalPages > 0 && page > r.totalPages) router.replace(`${pathname}?page=${r.totalPages}`, { scroll: false });
        else setData(r);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [page, attempt, pathname, router]);

  if (failed) {
    return (
      <div className="rounded-xl border border-st-line bg-white px-6 py-14 text-center">
        <p className="font-display text-lg font-semibold">We couldn&apos;t load collections</p>
        <p className="mt-1 text-sm text-st-slate">Check your connection and try again.</p>
        <button type="button" onClick={() => setAttempt((a) => a + 1)} className="mt-4 rounded-full bg-st-ink px-5 py-2 text-sm font-semibold text-white hover:bg-st-teal">Try again</button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="store-skeleton grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[16/8] rounded-xl bg-st-line" />)}
      </div>
    );
  }
  if (data.results.length === 0) {
    return (
      <div className="rounded-xl border border-st-line bg-white px-6 py-14 text-center">
        <p className="font-display text-lg font-semibold">No collections yet</p>
        <p className="mt-1 text-sm text-st-slate">Curated collections will appear here.</p>
      </div>
    );
  }
  return (
    <div ref={topRef} className="scroll-mt-28">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {data.results.map((c) => (
          <ImageTile key={c.id} item={c} tall={false} accent={c.colorCode} href={`/collections/${c.slug}`} />
        ))}
      </div>
      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        onChange={(p) => {
          router.replace(`${pathname}?page=${p}`, { scroll: false });
          topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      />
    </div>
  );
}

export default function CollectionsPage() {
  useEffect(() => {
    document.title = 'Collections | Pigeon Nest';
  }, []);

  return (
    <Container>
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Collections' }]} />
      <h1 className="font-display mb-4 text-2xl font-semibold text-st-ink sm:text-3xl">Collections</h1>
      <Suspense>
        <CollectionList />
      </Suspense>
    </Container>
  );
}
