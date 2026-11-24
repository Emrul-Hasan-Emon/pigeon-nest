'use client';

import { useState } from 'react';
import { Palmtree } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { setSelling } from '@/lib/api/seller-portal';
import { ApiError } from '@/lib/api/http';
import { hasPlannedBreak, isShopClosed, todayInputValue } from '@/lib/shop-break';
import { formatDate } from '@/lib/datetime';
import type { SellerView } from '@/types/seller';

const day = (d: string) => formatDate(`${d.slice(0, 10)}T12:00:00`);

/** The notice on the dashboard while the seller is hidden from buyers, or when a break is planned. */
export function ShopBreakBanner({ seller, onChanged }: { seller: SellerView; onChanged: (s: SellerView) => void }) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const closed = isShopClosed(seller);
  if (!closed && !hasPlannedBreak(seller)) return null;
  async function open() {
    setBusy(true);
    try {
      onChanged(await setSelling({ isEnabledForSell: true }));
      showToast('Selling is on. Buyers can see your shop and products.', 'success');
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not change it.', 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div role="status" className={`mb-5 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${closed ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-border bg-muted text-foreground'}`}>
      <Palmtree aria-hidden="true" className="h-6 w-6 shrink-0" />
      <p className="min-w-0 flex-1 text-base">
        {closed ? (
          <>
            <span className="font-semibold">{seller.isEnabledForSell ? 'Your shop is on a planned break.' : 'Selling is switched off.'}</span> Buyers cannot see you or your products
            {seller.isEnabledForSell && seller.breakEndsOn ? ` until the end of ${day(seller.breakEndsOn)}` : ' until you switch selling on'}. Orders you already have carry on as usual.
          </>
        ) : (
          <>
            <span className="font-semibold">A break is planned.</span> Your shop will be hidden from {day(seller.breakStartsOn as string)} to {day(seller.breakEndsOn as string)}.
          </>
        )}
      </p>
      {closed && !seller.isEnabledForSell && (
        <button type="button" onClick={open} disabled={busy} className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {busy ? 'Switching on…' : 'Switch selling on'}
        </button>
      )}
    </div>
  );
}

/** On the profile page: the selling switch, and an optional planned break with a first and a last day. */
export function ShopBreakCard({ seller, onChanged }: { seller: SellerView; onChanged: (s: SellerView) => void }) {
  const { showToast } = useToast();
  const [enabled, setEnabled] = useState(seller.isEnabledForSell);
  const [from, setFrom] = useState(seller.breakStartsOn?.slice(0, 10) ?? '');
  const [until, setUntil] = useState(seller.breakEndsOn?.slice(0, 10) ?? '');
  const [note, setNote] = useState(seller.breakNote ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: boolean, withBreak: boolean) {
    setError(null);
    if (withBreak && (!from || !until)) return setError('Choose both the first and the last day of the break.');
    setBusy(true);
    try {
      const updated = await setSelling({ isEnabledForSell: next, breakStartsOn: withBreak ? from : '', breakEndsOn: withBreak ? until : '', note: note.trim() });
      onChanged(updated);
      setEnabled(updated.isEnabledForSell);
      if (!withBreak) {
        setFrom('');
        setUntil('');
      }
      showToast(!updated.isEnabledForSell ? 'Selling is off. Buyers cannot see your shop.' : withBreak ? 'Your break is planned.' : 'Selling is on.', 'success');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  const planned = Boolean(seller.breakStartsOn && seller.breakEndsOn);
  return (
    <section aria-labelledby="break-title" className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 id="break-title" className="mb-1 flex items-center gap-2 text-base font-semibold text-foreground">
        <Palmtree aria-hidden="true" className="h-5 w-5" />
        Selling
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">When selling is off, or during a planned break, buyers cannot see you, your products, or anything of yours. Orders you already have are not affected.</p>
      {error && <p role="alert" className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border px-4 py-3">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Selling"
          disabled={busy}
          onClick={() => {
            const next = !enabled;
            setEnabled(next);
            void save(next, planned && next);
          }}
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-60 ${enabled ? 'bg-primary' : 'bg-muted-foreground/40'}`}
        >
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${enabled ? 'left-7' : 'left-1'}`} />
        </button>
        <div>
          <p className="text-base font-semibold text-foreground">Selling is {enabled ? 'ON' : 'OFF'}</p>
          <p className="text-sm text-muted-foreground">{enabled ? 'Buyers can see your shop and products.' : 'Buyers cannot see your shop or products until you switch it on.'}</p>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="mb-2 text-sm font-semibold text-foreground">Plan a break (optional)</h3>
        <p className="mb-3 text-sm text-muted-foreground">Hide your shop only between two days, then it comes back by itself. Selling must be on.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm text-foreground">
            First day of the break
            <input type="date" min={todayInputValue()} value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-md border border-input px-3 py-2" />
          </label>
          <label className="text-sm text-foreground">
            Last day of the break
            <input type="date" min={from || todayInputValue()} value={until} onChange={(e) => setUntil(e.target.value)} className="mt-1 w-full rounded-md border border-input px-3 py-2" />
          </label>
          <label className="text-sm text-foreground md:col-span-2">
            A note for yourself (optional)
            <input maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: Eid holiday" className="mt-1 w-full rounded-md border border-input px-3 py-2" />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" disabled={busy || !enabled} onClick={() => save(true, true)} className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">{planned ? 'Save the break' : 'Plan this break'}</button>
          {planned && <button type="button" disabled={busy} onClick={() => save(enabled, false)} className="rounded-lg border border-border px-5 py-2.5 font-semibold hover:bg-muted disabled:opacity-50">Remove the planned break</button>}
        </div>
      </div>
    </section>
  );
}
