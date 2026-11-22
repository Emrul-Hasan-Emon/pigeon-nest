'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  buyerAcceptProposal,
  buyerCancelProposal,
  buyerCounterProposal,
  buyerRejectProposal,
  createProposal,
} from '@/lib/api/proposals';
import { ApiError } from '@/lib/api/http';
import { useCart } from '@/lib/cart/cart-context';
import { formatDateTime } from '@/lib/datetime';
import { money } from './product-card';
import type {
  Proposal,
  ProposalDetail,
  ProposalHistoryEntry,
  ProposalStatus,
} from '@/types/proposal';

const field =
  'h-9 rounded-lg border border-st-line bg-white px-3 text-sm focus:border-st-ink focus:outline-none';
const primary =
  'h-9 rounded-full bg-st-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-st-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal disabled:cursor-not-allowed disabled:opacity-40';
const quiet =
  'h-9 rounded-full border border-st-line bg-white px-4 text-sm font-medium text-st-ink transition-colors hover:border-st-ink disabled:opacity-50';

/** The words a buyer reads for where a proposal stands. */
export function proposalState(p: Pick<Proposal, 'status' | 'awaitingParty' | 'closedByType'>): {
  label: string;
  tone: 'wait' | 'turn' | 'good' | 'bad' | 'done';
} {
  switch (p.status) {
    case 'pending':
      return p.awaitingParty === 'buyer'
        ? { label: 'The seller replied. Your turn', tone: 'turn' }
        : { label: 'Waiting for the seller', tone: 'wait' };
    case 'accepted':
      return { label: 'Accepted', tone: 'good' };
    case 'used':
      return { label: 'Used in an order', tone: 'done' };
    case 'rejected':
      return { label: p.closedByType === 'admin' ? 'Rejected by support' : 'Rejected', tone: 'bad' };
    case 'cancelled':
      return { label: p.closedByType === 'admin' ? 'Cancelled by support' : 'Cancelled', tone: 'bad' };
  }
}

const TONE: Record<ReturnType<typeof proposalState>['tone'], string> = {
  wait: 'bg-st-dove text-st-slate',
  turn: 'bg-amber-100 text-amber-800',
  good: 'bg-emerald-100 text-emerald-800',
  bad: 'bg-rose-100 text-rose-700',
  done: 'bg-st-ink text-white',
};

export function ProposalStateBadge({ proposal }: { proposal: Pick<Proposal, 'status' | 'awaitingParty' | 'closedByType'> }) {
  const s = proposalState(proposal);
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[s.tone]}`}>{s.label}</span>;
}

export function isOpen(status: ProposalStatus) {
  return status === 'pending' || status === 'accepted';
}

const WHO = { user: 'You', seller: 'The seller', admin: 'Support' } as const;
const WHAT: Record<ProposalHistoryEntry['action'], string> = {
  created: 'offered',
  countered: 'countered with',
  accepted: 'accepted',
  rejected: 'rejected',
  cancelled: 'cancelled',
  used: 'ordered at',
};

/** Every price that was offered, in order. Only the buyer and the seller ever see this. */
export function ProposalHistory({ history }: { history: ProposalHistoryEntry[] }) {
  return (
    <ol className="space-y-3 border-l-2 border-st-line pl-4">
      {history.map((h) => (
        <li key={h.id} className="relative">
          <span className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-st-ink" aria-hidden />
          <p className="text-sm text-st-ink">
            <span className="font-medium">{WHO[h.actorType]}</span> {WHAT[h.action]}{' '}
            <span className="font-semibold">
              {money(h.price)} × {h.quantity}
            </span>
          </p>
          {h.note && <p className="mt-0.5 text-sm text-st-slate">&ldquo;{h.note}&rdquo;</p>}
          <p className="mt-0.5 text-xs text-st-slate">
            {formatDateTime(h.createdAt)} · item price then {money(h.skuPriceAtTime)}
          </p>
        </li>
      ))}
    </ol>
  );
}

function errorText(e: unknown, fallback: string) {
  return e instanceof ApiError ? e.message : fallback;
}

/** Asks for a price, a quantity and an optional note. Used to start an offer and to counter. */
function OfferFields({
  initialPrice,
  initialQuantity,
  maxQuantity,
  lockQuantity,
  submitLabel,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  initialPrice: string;
  initialQuantity: number;
  maxQuantity: number;
  lockQuantity?: boolean;
  submitLabel: string;
  busy: boolean;
  error: string | null;
  onSubmit: (v: { price: number; quantity: number; note?: string }) => void;
  onCancel?: () => void;
}) {
  const [price, setPrice] = useState(initialPrice);
  const [quantity, setQuantity] = useState(String(initialQuantity));
  const [note, setNote] = useState('');
  const [local, setLocal] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = Number(price);
    const q = Number(quantity);
    if (!price.trim() || !Number.isFinite(p) || p <= 0) return setLocal('Enter the price you want to pay for one.');
    if (Math.round(p * 100) / 100 !== p) return setLocal('Use at most 2 decimal places.');
    if (!Number.isInteger(q) || q < 1) return setLocal('Quantity must be at least 1.');
    if (q > maxQuantity) return setLocal(`Only ${maxQuantity} in stock.`);
    setLocal(null);
    onSubmit({ price: p, quantity: q, note: note.trim() || undefined });
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-3">
        <label className="text-sm text-st-ink">
          <span className="mb-1 block">Your price for one</span>
          <input
            type="number"
            inputMode="decimal"
            min={0.01}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={`${field} w-36`}
            aria-label="Your price for one"
            autoFocus
          />
        </label>
        <label className="text-sm text-st-ink">
          <span className="mb-1 block">Quantity</span>
          <input
            type="number"
            min={1}
            max={maxQuantity}
            step={1}
            value={quantity}
            disabled={lockQuantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={`${field} w-24 disabled:opacity-60`}
            aria-label="Quantity"
          />
        </label>
      </div>
      <label className="block text-sm text-st-ink">
        <span className="mb-1 block">Message to the seller (optional)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={2}
          className="w-full rounded-lg border border-st-line bg-white px-3 py-2 text-sm focus:border-st-ink focus:outline-none"
        />
      </label>
      {(local || error) && (
        <p role="alert" className="text-sm text-destructive">
          {local ?? error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={primary}>
          {busy ? 'Sending…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={busy} className={quiet}>
            Not now
          </button>
        )}
      </div>
    </form>
  );
}

/** Start a new proposal for one SKU. */
export function NewProposalForm({
  skuId,
  skuPrice,
  stock,
  onCreated,
  onCancel,
}: {
  skuId: number;
  skuPrice: number;
  stock: number;
  onCreated: (p: ProposalDetail) => void;
  onCancel?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(v: { price: number; quantity: number; note?: string }) {
    setBusy(true);
    setError(null);
    try {
      onCreated(await createProposal({ sellerProductSkuId: skuId, ...v }));
    } catch (e) {
      setError(errorText(e, 'We could not send your offer. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-sm text-st-slate">
        Price now {money(skuPrice)}. Your offer is private: only you and the seller can see it.
      </p>
      <OfferFields
        initialPrice=""
        initialQuantity={1}
        maxQuantity={Math.max(1, stock)}
        submitLabel="Send offer"
        busy={busy}
        error={error}
        onSubmit={send}
        onCancel={onCancel}
      />
    </div>
  );
}

type Mode = 'counter' | 'reject' | 'cancel' | null;

/** What the buyer can do with a proposal now, from the server's `actions`. */
export function BuyerProposalActions({
  proposal,
  onChange,
}: {
  proposal: ProposalDetail;
  onChange: (p: ProposalDetail) => void;
}) {
  const { addItem } = useCart();
  const [mode, setMode] = useState<Mode>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const can = (a: Proposal['actions'][number]) => proposal.actions.includes(a);

  async function run(fn: () => Promise<ProposalDetail>) {
    setBusy(true);
    setError(null);
    try {
      onChange(await fn());
      setMode(null);
      setNote('');
    } catch (e) {
      setError(errorText(e, 'Something went wrong. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function addToCart() {
    setBusy(true);
    setError(null);
    setAdded(null);
    try {
      const res = await addItem({
        sellerProductId: proposal.product.id,
        sellerProductSkuId: proposal.sku.id,
        proposalId: proposal.id,
      });
      setAdded(res.notice ?? 'Added to your cart at your offer price.');
    } catch (e) {
      setError(errorText(e, 'We could not add that to your cart.'));
    } finally {
      setBusy(false);
    }
  }

  const noteBox = (label: string, confirm: () => void, tone: 'danger' | 'plain') => (
    <div className="mt-3 space-y-2">
      <label className="block text-sm text-st-ink">
        <span className="mb-1 block">{label}</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={2}
          className="w-full rounded-lg border border-st-line bg-white px-3 py-2 text-sm focus:border-st-ink focus:outline-none"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={confirm}
          className={tone === 'danger' ? 'h-9 rounded-full bg-destructive px-5 text-sm font-semibold text-white disabled:opacity-50' : primary}
        >
          {busy ? 'Working…' : 'Confirm'}
        </button>
        <button type="button" disabled={busy} onClick={() => setMode(null)} className={quiet}>
          Back
        </button>
      </div>
    </div>
  );

  const cheaper = proposal.skuPriceNowLower;

  return (
    <div>
      {proposal.status === 'accepted' && (
        <div className="space-y-2">
          <p className="text-sm text-st-ink">
            The seller accepted {money(proposal.price)} each for {proposal.quantity}. You decide whether to buy.
          </p>
          {cheaper && (
            <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              The item is now {money(proposal.skuPriceNow)}, lower than your offer. You will pay the lower price.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy} onClick={addToCart} className={primary}>
              {busy ? 'Adding…' : 'Add to cart at this price'}
            </button>
            <span className="text-xs text-st-slate">The quantity stays at {proposal.quantity}.</span>
          </div>
          {added && (
            <p role="status" className="text-sm text-st-teal">
              {added}{' '}
              <Link href="/cart" className="underline">
                View cart
              </Link>
            </p>
          )}
        </div>
      )}

      {proposal.status === 'pending' && proposal.awaitingParty === 'seller' && (
        <p className="text-sm text-st-slate">
          Your offer of {money(proposal.price)} × {proposal.quantity} is with the seller.
        </p>
      )}
      {proposal.status === 'pending' && proposal.awaitingParty === 'buyer' && (
        <p className="text-sm text-st-ink">
          The seller wants {money(proposal.price)} each for {proposal.quantity}.
        </p>
      )}

      {mode === null && proposal.actions.length > 0 && proposal.status !== 'accepted' && (
        <div className="mt-3 flex flex-wrap gap-2">
          {can('accept') && (
            <button type="button" disabled={busy} onClick={() => run(() => buyerAcceptProposal(proposal.id))} className={primary}>
              Accept {money(proposal.price)}
            </button>
          )}
          {can('counter') && (
            <button type="button" disabled={busy} onClick={() => setMode('counter')} className={quiet}>
              Counter
            </button>
          )}
          {can('reject') && (
            <button type="button" disabled={busy} onClick={() => setMode('reject')} className={quiet}>
              Decline
            </button>
          )}
          {can('cancel') && (
            <button type="button" disabled={busy} onClick={() => setMode('cancel')} className={quiet}>
              Cancel offer
            </button>
          )}
        </div>
      )}

      {mode === 'counter' && (
        <OfferFields
          initialPrice={String(proposal.price)}
          initialQuantity={proposal.quantity}
          maxQuantity={Math.max(1, proposal.stock)}
          submitLabel="Send counter"
          busy={busy}
          error={error}
          onSubmit={(v) => run(() => buyerCounterProposal(proposal.id, v))}
          onCancel={() => setMode(null)}
        />
      )}
      {mode === 'reject' && noteBox('Reason (optional)', () => run(() => buyerRejectProposal(proposal.id, { note: note.trim() || undefined })), 'danger')}
      {mode === 'cancel' && noteBox('Reason (optional)', () => run(() => buyerCancelProposal(proposal.id, { note: note.trim() || undefined })), 'danger')}

      {error && mode !== 'counter' && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
