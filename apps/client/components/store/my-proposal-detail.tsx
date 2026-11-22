'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getMyProposal } from '@/lib/api/proposals';
import { productHref } from '@/lib/api/storefront';
import { ApiError } from '@/lib/api/http';
import { loginUrlFor } from '@/lib/auth/next-path';
import { formatDateTime } from '@/lib/datetime';
import { money } from './product-card';
import { BuyerProposalActions, ProposalHistory, ProposalStateBadge } from './proposal-parts';
import type { ProposalDetail } from '@/types/proposal';

export function MyProposalDetail({ id }: { id: number }) {
  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    getMyProposal(id)
      .then(setProposal)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) setSignedOut(true);
        else setError(e instanceof ApiError ? e.message : 'Could not load this offer.');
      });
  }, [id]);

  if (signedOut) {
    return (
      <div className="rounded-xl border border-st-line bg-white px-6 py-14 text-center">
        <p className="font-display text-lg font-semibold">Sign in to see this offer</p>
        <Link href={loginUrlFor(`/proposals/${id}`)} className="mt-4 inline-flex rounded-full bg-st-ink px-5 py-2 text-sm font-semibold text-white hover:bg-st-teal">
          Sign in
        </Link>
      </div>
    );
  }
  if (error) return <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>;
  if (!proposal) return <p className="py-12 text-center text-st-slate">Loading this offer…</p>;

  const img = proposal.sku.imageUrl ?? proposal.product.thumbnailUrl;
  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 rounded-xl border border-st-line bg-white p-4 sm:flex-row">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-st-dove">
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <Link href={productHref(proposal.product)} className="font-display text-lg font-semibold text-st-ink hover:underline">
                {proposal.product.name}
              </Link>
              <p className="text-sm text-st-slate">
                {proposal.sku.label ?? proposal.sku.sku} · sold by {proposal.seller.name}
              </p>
            </div>
            <ProposalStateBadge proposal={proposal} />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-st-slate">{proposal.status === 'accepted' || proposal.status === 'used' ? 'Agreed price' : 'Latest price'}</dt>
              <dd className="font-semibold text-st-ink">{money(proposal.price)}</dd>
            </div>
            <div>
              <dt className="text-st-slate">Quantity</dt>
              <dd className="font-semibold text-st-ink">{proposal.quantity}</dd>
            </div>
            <div>
              <dt className="text-st-slate">Total</dt>
              <dd className="font-semibold text-st-ink">{money(proposal.total)}</dd>
            </div>
            <div>
              <dt className="text-st-slate">Item price</dt>
              <dd className="text-st-ink">
                {money(proposal.skuPriceAtCreate)} then, {money(proposal.skuPriceNow)} now
              </dd>
            </div>
          </dl>
          {proposal.closeNote && proposal.status !== 'pending' && (
            <p className="mt-3 text-sm text-st-slate">
              {proposal.closedByType === 'admin' ? 'Support' : proposal.closedByType === 'seller' ? 'The seller' : 'You'} said:
              &ldquo;{proposal.closeNote}&rdquo;
            </p>
          )}
          {proposal.status === 'used' && proposal.orderId && (
            <p className="mt-3 text-sm">
              <Link href={`/orders/${proposal.orderId}`} className="font-medium text-st-teal underline">
                View the order
              </Link>
              {proposal.usedAt && <span className="text-st-slate"> · {formatDateTime(proposal.usedAt)}</span>}
            </p>
          )}
        </div>
      </section>

      {proposal.actions.length > 0 || proposal.status === 'accepted' || proposal.status === 'pending' ? (
        <section className="rounded-xl border border-st-line bg-white p-4" aria-label="What you can do">
          <h2 className="font-display mb-2 text-base font-semibold text-st-ink">What you can do</h2>
          <BuyerProposalActions proposal={proposal} onChange={(p) => setProposal(p)} />
        </section>
      ) : null}

      <section className="rounded-xl border border-st-line bg-white p-4" aria-label="Price history">
        <h2 className="font-display mb-3 text-base font-semibold text-st-ink">Price history</h2>
        <ProposalHistory history={proposal.history} />
      </section>
    </div>
  );
}
