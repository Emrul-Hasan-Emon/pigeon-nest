'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { money, outlineButton } from '@/components/orders/ui';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { ApiError, NotFoundApiError } from '@/lib/api/http';
import { adminCancelProposal, adminRejectProposal, getAdminProposal } from '@/lib/api/proposals';
import { formatDateTime } from '@/lib/datetime';
import type { ProposalDetail, ProposalHistoryAction, ProposalHistoryEntry } from '@/types/proposal';
import { ProposalStatusBadge } from './proposal-list';
import { LoadingBlock } from '@/components/ui/skeleton';

const section = 'rounded-xl border border-border bg-card p-4 shadow-sm';
const textarea = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none';

const VERB: Record<ProposalHistoryAction, string> = {
  created: 'offered',
  countered: 'countered with',
  accepted: 'accepted',
  rejected: 'rejected',
  cancelled: 'cancelled',
  used: 'used',
};
const WHO = { user: 'Buyer', seller: 'Seller', admin: 'Admin' } as const;

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

function NoteDialog({
  kind,
  accepted,
  onSubmit,
  onClose,
}: {
  kind: 'reject' | 'cancel';
  accepted: boolean;
  onSubmit: (note: string) => Promise<void>;
  onClose: () => void;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(note.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not work. Try again.');
      setBusy(false);
    }
  }
  return (
    <Modal title={kind === 'reject' ? 'Reject this proposal' : 'Cancel this proposal'} onClose={onClose} widthClassName="max-w-md">
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {kind === 'reject' ? 'The proposal closes as rejected and the buyer and seller are told.' : 'The proposal closes as cancelled and the buyer and seller are told.'}
        </p>
        {accepted && (
          <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            This proposal is accepted. Any cart holding it goes back to the SKU price, and the buyer sees a message.
          </p>
        )}
        <label className="block text-sm font-medium">
          Note <span className="font-normal text-muted-foreground">(optional)</span>
          <textarea className={`${textarea} mt-1`} rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Back</button>
          <button type="submit" disabled={busy} className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {kind === 'reject' ? 'Reject proposal' : 'Cancel proposal'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Timeline({ history }: { history: ProposalHistoryEntry[] }) {
  return (
    <ol className="space-y-4 border-l border-border pl-5">
      {history.map((h, i) => {
        const prev = history[i - 1];
        const moved = prev && prev.price !== h.price ? h.price - prev.price : 0;
        return (
          <li key={h.id} className="relative text-sm">
            <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
            <p className="text-foreground">
              <strong>{WHO[h.actorType]}{h.actorName ? ` ${h.actorName}` : ''}</strong> {VERB[h.action]}{' '}
              <strong>{h.quantity} × {money(h.price)}</strong>
              {moved !== 0 && <span className={`ml-1 text-xs ${moved < 0 ? 'text-emerald-700' : 'text-amber-700'}`}>({moved < 0 ? '↓' : '↑'} {money(Math.abs(moved))} on the last figure)</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(h.createdAt)} · total {money(h.price * h.quantity)} · SKU price then {money(h.skuPriceAtTime)}
            </p>
            {h.note && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">“{h.note}”</p>}
          </li>
        );
      })}
    </ol>
  );
}

/** One proposal: who, what, every price step, and the reject / cancel controls the API allows now. */
export function AdminProposalDetail({ id }: { id: number }) {
  const { showToast } = useToast();
  const [p, setP] = useState<ProposalDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'reject' | 'cancel' | null>(null);

  const load = useCallback(() => {
    getAdminProposal(id)
      .then(setP)
      .catch((e) => (e instanceof NotFoundApiError ? setMissing(true) : setError(e instanceof ApiError ? e.message : 'Could not load this proposal.')));
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  if (missing) return <p className="py-10 text-center text-muted-foreground">This proposal no longer exists. <Link href="/admin/proposals" className="text-primary underline">Back to proposals</Link></p>;
  if (error) return <p role="alert" className="py-10 text-center text-destructive">{error}</p>;
  if (!p) return <LoadingBlock />;

  const skuLabel = p.sku.label ?? p.sku.sku;
  const closer = p.closedByType ? WHO[p.closedByType] : null;

  return (
    <div className="space-y-5">
      <Link href="/admin/proposals" className="text-sm text-primary hover:underline">← All proposals</Link>

      <div className={section}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">Proposal #{p.id}</h1>
              <ProposalStatusBadge proposal={p} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Opened {formatDateTime(p.createdAt)}, last change {formatDateTime(p.updatedAt)}</p>
          </div>
          <div className="flex gap-2">
            {p.actions.includes('reject') && (
              <button type="button" className={outlineButton} onClick={() => setDialog('reject')}>Reject</button>
            )}
            {p.actions.includes('cancel') && (
              <button type="button" className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white hover:opacity-90" onClick={() => setDialog('cancel')}>Cancel</button>
            )}
          </div>
        </div>

        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Buyer"><Link href={`/admin/users/${p.buyer.id}`} className="text-primary hover:underline">{p.buyer.name}</Link></Fact>
          <Fact label="Seller"><Link href={`/admin/sellers/${p.seller.id}`} className="text-primary hover:underline">{p.seller.name}</Link></Fact>
          <Fact label="Product">
            <Link href={`/admin/catalog/products/${p.product.id}`} className="hover:underline">{p.product.name}</Link>
            {skuLabel && <span className="block text-xs font-normal text-muted-foreground">{skuLabel}</span>}
          </Fact>
          <Fact label="Order">
            {p.orderId ? <Link href={`/admin/orders/${p.orderId}`} className="text-primary hover:underline">Order #{p.orderId}</Link> : <span className="font-normal text-muted-foreground">Not bought yet</span>}
          </Fact>
        </dl>
      </div>

      <div className={section}>
        <h2 className="mb-3 text-base font-semibold text-foreground">Price</h2>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="SKU price when proposed">{money(p.skuPriceAtCreate)}</Fact>
          <Fact label="SKU price now">
            {money(p.skuPriceNow)}
            {p.skuPriceNowLower && <span className="block text-xs font-normal text-amber-700">Lower than the offer: the buyer pays this.</span>}
          </Fact>
          <Fact label={p.status === 'accepted' || p.status === 'used' ? 'Agreed price per unit' : 'Latest price per unit'}>{money(p.price)}</Fact>
          <Fact label="Quantity">{p.quantity}</Fact>
          <Fact label="Total">{money(p.total)}</Fact>
          {p.acceptedAt && <Fact label="Accepted">{formatDateTime(p.acceptedAt)}</Fact>}
          {p.usedAt && <Fact label="Used">{formatDateTime(p.usedAt)}</Fact>}
          {p.closedByType && (
            <Fact label="Closed by">
              {closer}
              {p.closeNote && <span className="block text-xs font-normal text-muted-foreground">“{p.closeNote}”</span>}
            </Fact>
          )}
        </dl>
      </div>

      <section className={section} aria-label="Price history">
        <h2 className="mb-3 text-base font-semibold text-foreground">Price history</h2>
        <Timeline history={p.history} />
      </section>

      {dialog && (
        <NoteDialog
          kind={dialog}
          accepted={p.status === 'accepted'}
          onClose={() => setDialog(null)}
          onSubmit={async (note) => {
            const input = note ? { note } : {};
            setP(dialog === 'reject' ? await adminRejectProposal(id, input) : await adminCancelProposal(id, input));
            setDialog(null);
            showToast(dialog === 'reject' ? 'Proposal rejected.' : 'Proposal cancelled.', 'success');
          }}
        />
      )}
    </div>
  );
}
