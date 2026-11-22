'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getMyProposalForSku } from '@/lib/api/proposals';
import { getUserToken } from '@/lib/auth/user-token';
import { loginUrlFor } from '@/lib/auth/next-path';
import { money } from './product-card';
import {
  BuyerProposalActions,
  isOpen,
  NewProposalForm,
  ProposalHistory,
  ProposalStateBadge,
} from './proposal-parts';
import type { ProductSku } from '@/types/storefront';
import type { ProposalDetail } from '@/types/proposal';

/** "Make an offer" on the product page, for a SKU whose seller takes price proposals. */
export function ProposalPanel({ productPath, sku }: { productPath: string; sku: ProductSku }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const run = useRef(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSignedIn(!!getUserToken());
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    const ticket = ++run.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoaded(false);
    setFormOpen(false);
    setShowHistory(false);
    getMyProposalForSku(sku.id)
      .then((r) => ticket === run.current && setProposal(r.proposal))
      .catch(() => ticket === run.current && setProposal(null))
      .finally(() => ticket === run.current && setLoaded(true));
  }, [signedIn, sku.id]);

  if (!sku.acceptProposals || !sku.inStock || signedIn === null) return null;

  const shell = 'rounded-xl border border-dashed border-st-ink/30 bg-white p-4';

  if (!signedIn) {
    return (
      <section className={shell} aria-label="Make an offer">
        <p className="font-medium text-st-ink">Want a better price?</p>
        <p className="mt-0.5 text-sm text-st-slate">This seller takes offers on this item. Sign in to send yours.</p>
        <Link
          href={loginUrlFor(productPath)}
          className="mt-3 inline-flex h-9 items-center rounded-full border border-st-ink px-5 text-sm font-semibold text-st-ink transition-colors hover:bg-st-ink hover:text-white"
        >
          Sign in to make an offer
        </Link>
      </section>
    );
  }

  if (!loaded) return <section className={shell}><p className="text-sm text-st-slate">Checking your offers…</p></section>;

  const open = proposal && isOpen(proposal.status) ? proposal : null;

  return (
    <section className={shell} aria-label="Make an offer">
      {open ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-st-ink">Your offer</p>
            <ProposalStateBadge proposal={open} />
          </div>
          <div className="mt-2">
            <BuyerProposalActions proposal={open} onChange={setProposal} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 text-xs text-st-slate">
            <button type="button" onClick={() => setShowHistory((v) => !v)} className="underline-offset-2 hover:underline">
              {showHistory ? 'Hide price history' : 'Show price history'}
            </button>
            <Link href={`/proposals/${open.id}`} className="underline-offset-2 hover:underline">
              Open offer page
            </Link>
          </div>
          {showHistory && (
            <div className="mt-3">
              <ProposalHistory history={open.history} />
            </div>
          )}
        </>
      ) : formOpen ? (
        <>
          <p className="font-medium text-st-ink">Make an offer</p>
          <NewProposalForm
            skuId={sku.id}
            skuPrice={sku.effectivePrice}
            stock={sku.quantity}
            onCreated={(p) => {
              setProposal(p);
              setFormOpen(false);
            }}
            onCancel={() => setFormOpen(false)}
          />
        </>
      ) : (
        <>
          <p className="font-medium text-st-ink">Want a better price?</p>
          <p className="mt-0.5 text-sm text-st-slate">
            Offer your own price{sku.sku ? ` for ${sku.sku}` : ''}. Only you and the seller see it.
          </p>
          {proposal && (
            <p className="mt-2 text-sm text-st-slate">
              Your last offer of {money(proposal.price)} × {proposal.quantity}: <ProposalStateBadge proposal={proposal} />{' '}
              {proposal.closeNote ? `(“${proposal.closeNote}”)` : ''}{' '}
              <Link href={`/proposals/${proposal.id}`} className="underline">
                See why
              </Link>
            </p>
          )}
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="mt-3 h-9 rounded-full border border-st-ink px-5 text-sm font-semibold text-st-ink transition-colors hover:bg-st-ink hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal"
          >
            Make an offer
          </button>
        </>
      )}
    </section>
  );
}
