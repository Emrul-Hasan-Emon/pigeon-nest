'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { field, outlineButton, primaryButton, useApiError } from '@/components/orders/ui';
import { OfferStatusBadge, OfferTimeline } from '@/components/seller/proposals/offer-parts';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { getSellerProposal, sellerAcceptProposal, sellerCounterProposal, sellerRejectProposal } from '@/lib/api/proposals';
import { formatDateTime } from '@/lib/datetime';
import type { ProposalDetail } from '@/types/proposal';
import { formatMoney, roundMoney } from '@/lib/money';

type Mode = 'counter' | 'reject' | null;


function Fig({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-xl font-semibold text-foreground">{value}</dd>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-base font-medium text-foreground">{children}</dd>
    </div>
  );
}

/** How far the offer is from the shop's price, in words. */
function gap(o: ProposalDetail) {
  const diff = roundMoney(o.skuPriceNow - o.price);
  if (diff <= 0) return 'The buyer is offering your full price or more.';
  const pct = Math.round((diff / o.skuPriceNow) * 100);
  return `The buyer wants ${formatMoney(diff)} off each piece (${pct}% less than your price). For ${o.quantity} ${o.quantity === 1 ? 'piece' : 'pieces'}, you would earn ${formatMoney(diff * o.quantity)} less in all.`;
}

/** What is happening with this offer, and whose move it is. */
function stateSentence(o: ProposalDetail) {
  switch (o.status) {
    case 'pending':
      return o.awaitingParty === 'seller'
        ? 'It is your turn. Say yes, suggest another price, or say no.'
        : 'You answered. Now the buyer must say yes, suggest another price, or cancel.';
    case 'accepted':
      return 'You agreed to this price. It stays locked for the buyer to order.';
    case 'used':
      return 'The buyer has ordered at the agreed price. Nothing more to do.';
    case 'rejected':
      return 'This offer was turned down.';
    default:
      return 'This offer was cancelled.';
  }
}

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
    <Modal title={offer ? `Price offer #${offer.id}` : 'Price offer'} onClose={onClose} widthClassName="max-w-2xl">
      {!offer && !error && <p className="py-6 text-center text-muted-foreground">Loading…</p>}
      {error && <p role="alert" className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {offer && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {offer.product.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={offer.product.thumbnailUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg border border-border object-cover" />
              )}
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Product</p>
                <Link href={`/seller/products/${offer.product.id}`} className="text-lg font-semibold text-primary underline underline-offset-2 hover:opacity-70">
                  {offer.product.name}
                </Link>
                <p className="text-sm text-muted-foreground">Option: {offer.sku.label ?? offer.sku.sku ?? `SKU #${offer.sku.id}`}{offer.sku.sku && offer.sku.label ? ` · SKU code ${offer.sku.sku}` : ''}</p>
              </div>
            </div>
            <OfferStatusBadge proposal={offer} />
          </div>

          <p className="rounded-lg bg-muted/60 px-4 py-3 text-base text-foreground">{stateSentence(offer)}</p>

          <section aria-label="The offer">
            <h3 className="mb-2 text-base font-semibold text-foreground">What the buyer is asking</h3>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Fig label="Buyer offers (each)" value={formatMoney(offer.price)} />
              <Fig label="How many they want" value={String(offer.quantity)} />
              <Fig label="They would pay in all" value={formatMoney(offer.total)} />
              <Fig label="Your selling price (each)" value={formatMoney(offer.skuPriceNow)} hint={offer.skuPriceNow !== offer.skuPriceAtCreate ? `Was ${formatMoney(offer.skuPriceAtCreate)} when offered` : undefined} />
            </dl>
            <p className="mt-2 text-base text-foreground">{gap(offer)}</p>
            <p className={`mt-1 text-base ${offer.quantity > offer.stock ? 'font-medium text-red-700' : 'text-muted-foreground'}`}>
              Pieces you have in stock: {offer.stock}{offer.quantity > offer.stock ? ` — not enough for the ${offer.quantity} they want` : ''}
            </p>
          </section>

          {offer.skuPriceNowLower && (
            <p className="rounded-md bg-amber-50 px-4 py-3 text-base text-amber-800">
              Your price is now {formatMoney(offer.skuPriceNow)}, lower than this offer. The buyer will pay the lower price.
            </p>
          )}
          {offer.status === 'accepted' && (
            <p className="rounded-md bg-emerald-50 px-4 py-3 text-base text-emerald-800">You said yes. The price is locked and the buyer can now order at it.</p>
          )}
          {offer.status === 'used' && offer.orderId !== null && (
            <p className="rounded-md bg-indigo-50 px-4 py-3 text-base text-indigo-800">
              The buyer ordered at this price: <Link href={`/seller/orders/${offer.orderId}`} className="font-semibold underline">order #{offer.orderId}</Link>.
            </p>
          )}
          {offer.closeNote && (
            <p className="text-base text-foreground"><span className="font-medium">Last message: </span>{offer.closeNote}</p>
          )}

          <section aria-label="About this offer">
            <h3 className="mb-2 text-base font-semibold text-foreground">Details</h3>
            <dl className="grid gap-x-6 gap-y-3 rounded-lg border border-border p-4 sm:grid-cols-2">
              <Row label="Offer number">#{offer.id}</Row>
              <Row label="Buyer">{offer.buyer.name}</Row>
              <Row label="First offer made on">{formatDateTime(offer.createdAt)}</Row>
              <Row label="Last updated on">{formatDateTime(offer.updatedAt)}</Row>
              {offer.acceptedAt && <Row label="You said yes on">{formatDateTime(offer.acceptedAt)}</Row>}
              {offer.usedAt && <Row label="Buyer ordered on">{formatDateTime(offer.usedAt)}</Row>}
              {offer.closedByType && <Row label="Closed by">{offer.closedByType === 'user' ? 'The buyer' : offer.closedByType === 'seller' ? 'You' : 'The admin team'}</Row>}
            </dl>
          </section>

          <div>
            <h3 className="mb-2 text-base font-semibold text-foreground">What happened so far (first to last)</h3>
            <OfferTimeline history={offer.history} />
          </div>

          {mode === 'counter' && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex flex-wrap gap-3">
                <label className="text-sm text-foreground">Your new price for each piece
                  <input className={`${field} mt-1 block w-40`} type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
                </label>
                <label className="text-sm text-foreground">How many pieces
                  <input className={`${field} mt-1 block w-28`} type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
                </label>
              </div>
              <label className="block text-sm text-foreground">Message to the buyer (optional)
                <textarea className={`${field} mt-1 block w-full`} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" className={outlineButton} disabled={busy} onClick={() => setMode(null)}>Back</button>
                <button type="button" className={primaryButton} disabled={busy} onClick={sendCounter}>{busy ? 'Sending…' : 'Send my price'}</button>
              </div>
            </div>
          )}

          {mode === 'reject' && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <label className="block text-sm text-foreground">Message to the buyer (optional)
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
                  {busy ? 'Saving…' : 'Say no to this offer'}
                </button>
              </div>
            </div>
          )}

          {mode === null && offer.actions.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
              {can('reject') && <button type="button" className={outlineButton} disabled={busy} onClick={() => { setNote(''); setMode('reject'); }}>Say no</button>}
              {can('counter') && <button type="button" className={outlineButton} disabled={busy} onClick={startCounter}>Suggest another price</button>}
              {can('accept') && (
                <button type="button" className={primaryButton} disabled={busy} onClick={() => run(() => sellerAcceptProposal(offer.id), 'Offer accepted.')}>
                  {busy ? 'Saving…' : 'Say yes'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
