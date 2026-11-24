import Link from 'next/link';
import { OfferStatusBadge } from '@/components/seller/proposals/offer-parts';
import { formatDateTime } from '@/lib/datetime';
import type { Proposal } from '@/types/proposal';
import type { Sku } from '@/types/product';
import { SkuBirdBlock } from '@/components/seller/product-bird';

const taka = (n: number | string) => `৳${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/** A figure with its name above it, so no number is ever left to guess at. */
function Figure({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/60 px-4 py-3">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="mt-1 font-[family-name:var(--font-serif)] text-2xl font-semibold tracking-tight text-foreground">{children}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Stock in plain words: gone, running low, or fine. */
function stockState(sku: Sku) {
  if (sku.quantity <= 0) return { text: 'Out of stock', tone: 'text-red-700' };
  if (sku.quantity <= sku.lowStockThreshold) return { text: 'Running low', tone: 'text-amber-700' };
  return { text: 'In stock', tone: 'text-emerald-700' };
}

/** The offers customers made on this SKU: who, how much for how many, and where each one stands. */
function SkuOffers({ offers }: { offers: Proposal[] }) {
  return (
    <div className="mt-4 rounded-lg border border-border">
      <p className="border-b border-border bg-muted/40 px-4 py-2.5 text-base font-semibold text-foreground">
        Price offers on this option ({offers.length})
      </p>
      <ul className="divide-y divide-border">
        {offers.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
            <div className="min-w-0">
              <p className="text-base text-foreground">
                <span className="font-semibold">{o.buyer.name}</span> offered{' '}
                <span className="font-semibold">{taka(o.price)}</span> each for {o.quantity}
                <span className="text-muted-foreground"> · {taka(o.total)} in all</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDateTime(o.createdAt)}
                {o.status === 'pending' && o.awaitingParty === 'seller' ? ' · Waiting for your answer' : ''}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <OfferStatusBadge proposal={o} />
              {o.status === 'pending' && o.awaitingParty === 'seller' && (
                <Link href="/seller/offers" className="text-base font-semibold text-primary hover:underline">
                  Answer
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One sellable option of a product: its variant, price, discounted price and stock, each with its own label. */
export function ProductSkuCard({ sku, offers = [] }: { sku: Sku; offers?: Proposal[] }) {
  const variant = sku.variants.map((v) => `${v.attribute.name}: ${v.attributeValue.name}`).join(' · ') || 'Standard';
  const stock = stockState(sku);
  // A discounted price only counts when it is really lower than the price.
  const discounted = sku.discountedPrice != null && Number(sku.discountedPrice) > 0 && Number(sku.discountedPrice) < Number(sku.price);
  const floor = sku.minProposalPrice != null && Number(sku.minProposalPrice) > 0;

  return (
    <article className={`rounded-xl border border-border bg-card p-5 ${sku.isActive ? '' : 'opacity-70'}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {sku.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sku.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-border object-cover" />
          )}
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-foreground">{variant}</h3>
            <p className="text-sm text-muted-foreground">SKU code: {sku.sku || '—'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm font-medium">
          {sku.isDefault && <span className="rounded-full bg-accent px-3 py-1 text-accent-foreground">Shown first</span>}
          <span className={`rounded-full px-3 py-1 ${sku.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
            {sku.isActive ? 'Active' : 'Switched off'}
          </span>
        </div>
      </header>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Figure label="Price">{taka(sku.price)}</Figure>
        <Figure label="Discounted price" hint={discounted ? 'Customers pay this' : 'Not on offer'}>
          {discounted ? taka(sku.discountedPrice as number) : '—'}
        </Figure>
        <Figure label="Quantity in stock" hint={stock.text}>
          <span className={stock.tone}>{sku.quantity}</span>
        </Figure>
        <Figure label="Low-stock alert at" hint="You are warned at this many or fewer">
          {sku.lowStockThreshold}
        </Figure>
      </div>

      <p className="mt-4 text-base text-muted-foreground">
        <span className="font-medium text-foreground">Price offers from customers: </span>
        {sku.acceptProposals ? (floor ? `accepted, lowest price you will consider is ${taka(sku.minProposalPrice as number)}` : 'accepted') : 'not accepted'}
      </p>

      <SkuBirdBlock sku={sku} />

      {offers.length > 0 && <SkuOffers offers={offers} />}
    </article>
  );
}
