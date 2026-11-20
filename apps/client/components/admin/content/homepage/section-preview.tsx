'use client';

import { useEffect, useState } from 'react';
import { previewHomepageSection, previewHomepageSlot } from '@/lib/api/homepage';
import type { HomepagePreview } from '@/types/homepage';

export function SectionPreview({ id, mode, refreshKey }: { id: number; mode: 'section' | 'slot'; refreshKey: number }) {
  const [device, setDevice] = useState<'mobile' | 'web'>('web');
  const [data, setData] = useState<HomepagePreview | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = mode === 'slot' ? previewHomepageSlot : previewHomepageSection;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(false);
    load(id, device)
      .then((r) => !cancelled && setData(r))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [id, mode, device, refreshKey]);

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Preview</h2>
        <div className="flex gap-1 text-xs">
          {(['web', 'mobile'] as const).map((d) => (
            <button key={d} type="button" onClick={() => setDevice(d)} className={`rounded-md px-3 py-1 ${device === d ? 'bg-primary text-primary-foreground' : 'border border-border text-foreground'}`}>
              {d === 'web' ? 'Web' : 'Mobile'}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-sm text-destructive">Could not load the preview.</p>}
      {data && (
        <>
          {!data.visible && (
            <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Not shown on the storefront right now for {device} (inactive, outside its schedule or hidden for this device). Items below are what it would show.
            </p>
          )}
          {data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No live items. The storefront skips this section while it is empty.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {data.items.map((item) => {
                const img = (item.imageUrl ?? item.thumbnailUrl ?? item.avatarUrl) as string | null | undefined;
                const name = String(item.name ?? item.title ?? `#${item.id}`);
                return (
                  <div key={String(item.id)} className="overflow-hidden rounded-lg border border-border">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt="" className="h-24 w-full object-cover" />
                    ) : (
                      <div className="flex h-24 items-center justify-center bg-muted text-xs text-muted-foreground">No image</div>
                    )}
                    <div className="p-2 text-xs">
                      <p className="truncate font-medium text-foreground">{name}</p>
                      {typeof item.price === 'number' && (
                        <p className="text-muted-foreground">
                          {typeof item.discountedPrice === 'number' ? (
                            <>
                              <span className="font-semibold text-foreground">{item.discountedPrice}</span>{' '}
                              <s>{item.price}</s>
                            </>
                          ) : (
                            item.price
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
