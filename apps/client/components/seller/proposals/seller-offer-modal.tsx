'use client';

import { useCallback, useEffect, useState } from 'react';
import { field, money, outlineButton, primaryButton, useApiError } from '@/components/orders/ui';
import { OfferStatusBadge, OfferTimeline } from '@/components/seller/proposals/offer-parts';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { getSellerProposal, sellerAcceptProposal, sellerCounterProposal, sellerRejectProposal } from '@/lib/api/proposals';
import type { ProposalDetail } from '@/types/proposal';

type Mode = 'counter' | 'reject' | null;

/** One offer: figures, price history and the actions the API says this seller may take now. */
export function SellerOfferModal({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const { showToast } = useToast();
  const apiError = useApiError('seller');
  const [offer, setOffer] = useState<ProposalDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(() => {
    getSellerProposal(id)
      .then((o) => {
        setOffer(o);
        setError(null);
      })
      .catch((e) => setError(apiError(e, 'Could not load this offer.')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => {
     
    load();
  }, [load]);

  async function run(call: () => Promise<ProposalDetail>, done: string) {
    setBusy(true);
    setError(null);
    try {
      setOffer(await call());
      setMode(null);
      setNote('');
      showToast(done, 'success');
      onChanged();
    } catch (e) {
      const message = apiError(e, 'That did not work. Try again.');
      setError(message);
      showToast(message, 'error');
      // the offer may have moved on (the buyer acted first), so show its real state
      load();
    } finally {
      setBusy(false);
    }
  }

  function startCounter() {
    if (!offer) return;
    setPrice(String(offer.price));
    setQty(String(offer.quantity));
    setNote('');
    setMode('counter');
  }

  function sendCounter() {
    if (!offer) return;
    const p = Number(price);
    const q = Number(qty);
    if (!price || Number.isNaN(p) || p <= 0) return setError('Enter a price above 0.');
    if (qty && (!Number.isInteger(q) || q < 1)) return setError('Quantity must be a whole number, 1 or more.');
    run(
      () => sellerCounterProposal(offer.id, { price: p, quantity: qty && q !== offer.quantity ? q : undefined, note: note.trim() || undefined }),
      'Counter offer sent to the buyer.',
    );
  }

  const can = (a: string) => Boolean(offer?.actions.includes(a as never));

  return (
    <Modal title={offer ? `Offer #${offer.id}` : 'Offer'} onClose={onClose} widthClassName="max-w-2xl">
      {!offer && !error && <p className="py-6 text-center text-muted-foreground">Loading…</p>}
      {error && <p role="alert" className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {offer && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium text-foreground">{offer.product.name}</p>
              <p className="text-sm text-muted-foreground">{offer.sku.label ?? offer.sku.sku ?? `SKU #${offer.sku.id}`} · from {offer.buyer.name}</p>
            </div>
            <OfferStatusBadge proposal={offer} />
          </div>

          <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-muted-foreground">Quantity</dt><dd className="font-medium text-foreground">{offer.quantity}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Price per unit</dt><dd className="font-medium text-foreground">{money(offer.price)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Total</dt><dd className="font-medium text-foreground">{money(offer.total)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">SKU price</dt><dd className="font-medium text-foreground">{money(offer.skuPriceNow)} <span className="text-xs font-normal text-muted-foreground">(was {money(offer.skuPriceAtCreate)})</span></dd></div>
          </dl>

          {offer.skuPriceNowLower && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              The SKU price is now {money(offer.skuPriceNow)}, lower than this offer. The buyer will pay the lower price.
            </p>
          )}
          {offer.status === 'accepted' && (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">This offer is accepted and locked. The buyer can now order at this price.</p>
          )}
          {offer.status === 'used' && offer.orderId !== null && (
            <p className="rounded-md bg-indigo-50 px-3 py-2 text-sm text-indigo-800">The buyer ordered at this price (order #{offer.orderId}).</p>
          )}
          {offer.closeNote && <p className="text-sm text-muted-foreground">Closing note: {offer.closeNote}</p>}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Price history</h3>
            <OfferTimeline history={offer.history} />
          </div>

          {mode === 'counter' && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex flex-wrap gap-3">
                <label className="text-sm text-foreground">Your price per unit
                  <input className={`${field} mt-1 block w-40`} type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
                </label>
                <label className="text-sm text-foreground">Quantity
                  <input className={`${field} mt-1 block w-28`} type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
                </label>
              </div>
              <label className="block text-sm text-foreground">Note (optional)
                <textarea className={`${field} mt-1 block w-full`} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" className={outlineButton} disabled={busy} onClick={() => setMode(null)}>Back</button>
                <button type="button" className={primaryButton} disabled={busy} onClick={sendCounter}>{busy ? 'Sending…' : 'Send counter offer'}</button>
              </div>
            </div>
          )}

          {mode === 'reject' && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <label className="block text-sm text-foreground">Note to the buyer (optional)
                <textarea className={`${field} mt-1 block w-full`} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" className={outlineButton} disabled={busy} onClick={() => setMode(null)}>Back</button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => sellerRejectProposal(offer.id, { note: note.trim() || undefined }), 'Offer rejected.')}
                  className="rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? 'Rejecting…' : 'Reject offer'}
                </button>
              </div>
            </div>
          )}

          {mode === null && offer.actions.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
              {can('reject') && <button type="button" className={outlineButton} disabled={busy} onClick={() => { setNote(''); setMode('reject'); }}>Reject</button>}
              {can('counter') && <button type="button" className={outlineButton} disabled={busy} onClick={startCounter}>Counter</button>}
              {can('accept') && (
                <button type="button" className={primaryButton} disabled={busy} onClick={() => run(() => sellerAcceptProposal(offer.id), 'Offer accepted.')}>
                  {busy ? 'Accepting…' : 'Accept'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
