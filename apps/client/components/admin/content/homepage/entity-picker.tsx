'use client';

import { useEffect, useState } from 'react';
import { listBanners } from '@/lib/api/banners';
import { listCategories } from '@/lib/api/categories';
import { listCollections } from '@/lib/api/collections';
import { listProducts } from '@/lib/api/products';
import { listSellers } from '@/lib/api/sellers';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import type { ConfigEntityKind, LookupEntity } from '@/types/homepage';

const KIND_LABEL: Record<ConfigEntityKind, string> = {
  category: 'category',
  collection: 'collection',
  product: 'product',
  seller: 'seller',
  banner: 'banner',
};

async function searchEntities(kind: ConfigEntityKind, search: string): Promise<LookupEntity[]> {
  const q = search || undefined;
  switch (kind) {
    case 'category': {
      const r = await listCategories({ search: q, limit: 8 });
      return r.results.map((c) => ({ id: c.id, name: c.name, imageUrl: c.imageUrl ?? null, eligible: c.isActive }));
    }
    case 'collection': {
      const r = await listCollections({ search: q, limit: 8 });
      return r.results.map((c) => ({ id: c.id, name: c.name, imageUrl: c.imageUrl ?? null, eligible: c.isActive }));
    }
    case 'banner': {
      const r = await listBanners({ search: q, limit: 8 });
      return r.results.map((b) => ({ id: b.id, name: b.title, imageUrl: b.imageUrl, eligible: b.isActive }));
    }
    case 'seller': {
      const r = await listSellers({ search: q, limit: 8 });
      return r.results.map((s) => ({
        id: s.id,
        name: s.name,
        imageUrl: s.avatarUrl ?? null,
        eligible: s.status === 'approved' && s.activeStatus === 'active',
      }));
    }
    case 'product': {
      const r = await listProducts({ search: q, limit: 8 });
      return r.results.map((p) => ({
        id: p.id,
        name: p.name,
        imageUrl: p.thumbnailUrl ?? null,
        eligible: p.status === 'approved' && p.activeStatus === 'active',
      }));
    }
  }
}

function Thumb({ url }: { url: string | null }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="h-8 w-8 rounded border border-border object-cover" />
  ) : (
    <span className="flex h-8 w-8 items-center justify-center rounded border border-dashed border-border text-xs text-muted-foreground">—</span>
  );
}

/** Pick one or many entities. Order of `selected` is kept (it is the display order). */
export function EntityPicker({
  kind,
  multi,
  selected,
  maxItems,
  onChange,
}: {
  kind: ConfigEntityKind;
  multi: boolean;
  selected: LookupEntity[];
  maxItems?: number;
  onChange: (next: LookupEntity[]) => void;
}) {
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<LookupEntity[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    searchEntities(kind, debounced)
      .then((r) => !cancelled && setResults(r))
      .catch(() => !cancelled && setResults([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [kind, debounced, open]);

  const full = multi && maxItems !== undefined && selected.length >= maxItems;

  function add(entity: LookupEntity) {
    if (selected.some((s) => s.id === entity.id)) return;
    onChange(multi ? [...selected, entity] : [entity]);
    if (!multi) setOpen(false);
  }
  function remove(id: number) {
    onChange(selected.filter((s) => s.id !== id));
  }
  function move(index: number, by: -1 | 1) {
    const next = [...selected];
    const target = index + by;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="mt-1 space-y-2">
      {selected.length > 0 && (
        <ul className="space-y-1">
          {selected.map((e, i) => (
            <li key={e.id} className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1">
              <Thumb url={e.imageUrl} />
              <span className="flex-1 truncate text-sm text-foreground">
                {e.name} <span className="text-xs text-muted-foreground">#{e.id}</span>
                {!e.eligible && <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs text-amber-700">not live</span>}
              </span>
              {multi && selected.length > 1 && (
                <>
                  <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="px-1 text-muted-foreground hover:text-foreground disabled:opacity-30">↑</button>
                  <button type="button" aria-label="Move down" disabled={i === selected.length - 1} onClick={() => move(i, 1)} className="px-1 text-muted-foreground hover:text-foreground disabled:opacity-30">↓</button>
                </>
              )}
              <button type="button" aria-label="Remove" onClick={() => remove(e.id)} className="px-1 text-destructive">✕</button>
            </li>
          ))}
        </ul>
      )}

      {!full && (
        <div className="relative">
          <input
            type="text"
            placeholder={`Search ${KIND_LABEL[kind]}…`}
            value={search}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            className="w-full rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
          />
          {open && (
            <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-card shadow-lg">
              {loading && <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>}
              {!loading && results.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">No results.</p>}
              {results.map((r) => {
                const chosen = selected.some((s) => s.id === r.id);
                return (
                  <button
                    type="button"
                    key={r.id}
                    disabled={chosen}
                    onClick={() => add(r)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-40"
                  >
                    <Thumb url={r.imageUrl} />
                    <span className="flex-1 truncate">{r.name}</span>
                    {!r.eligible && <span className="text-xs text-amber-700">not live</span>}
                  </button>
                );
              })}
              <button type="button" onClick={() => setOpen(false)} className="w-full border-t border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted">Close</button>
            </div>
          )}
        </div>
      )}
      {full && <p className="text-xs text-muted-foreground">Maximum of {maxItems} reached.</p>}
    </div>
  );
}
