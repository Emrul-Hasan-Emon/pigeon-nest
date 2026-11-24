'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Opt, Req } from '@/components/products/field-tag';
import { ApiError } from '@/lib/api/http';
import { sellerProductPortal, type ProductPortal } from '@/lib/products/portal';
import type { Product } from '@/types/product';

interface Row {
  id: number;
  label: string;
  price: string;
  discountedPrice: string;
  quantity: string;
  isActive: boolean;
}

const input = 'w-full rounded-md border border-input px-3 py-2 text-base focus:ring-2 focus:ring-ring focus:outline-none';

/** Change the price, offer price, stock and on/off of every option of one product, without the full form. */
export function QuickEdit({
  productId,
  onClose,
  onSaved,
  portal = sellerProductPortal,
}: {
  productId: number;
  onClose: () => void;
  onSaved: (product: Product) => void;
  portal?: ProductPortal;
}) {
  const [product, setProduct] = useState<Product | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    portal
      .get(productId)
      .then((p) => {
        if (!live) return;
        setProduct(p);
        setRows(
          (p.skus ?? []).map((k) => ({
            id: k.id,
            label: k.variants.map((v) => v.attributeValue.name).join(' · ') || 'Standard',
            price: String(k.price),
            discountedPrice: k.discountedPrice != null && Number(k.discountedPrice) < Number(k.price) ? String(k.discountedPrice) : '',
            quantity: String(k.quantity),
            isActive: k.isActive,
          })),
        );
      })
      .catch(() => live && setError('Could not load this product.'));
    return () => {
      live = false;
    };
  }, [productId, portal]);

  const patch = (id: number, changes: Partial<Row>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...changes } : x)));

  async function save() {
    setError(null);
    for (const r of rows) {
      const price = Number(r.price);
      if (r.price === '' || Number.isNaN(price) || price < 0) return setError(`${r.label}: enter a price.`);
      if (r.discountedPrice !== '' && Number(r.discountedPrice) > price) return setError(`${r.label}: the offer price cannot be higher than the price.`);
      if (r.quantity === '' || !Number.isInteger(Number(r.quantity)) || Number(r.quantity) < 0) return setError(`${r.label}: stock must be a whole number, 0 or more.`);
    }
    setBusy(true);
    try {
      const updated = await portal.update(productId, {
        skus: rows.map((r) => ({
          id: r.id,
          price: Number(r.price),
          // An emptied offer price means no offer: it goes back to the normal price.
          discountedPrice: r.discountedPrice === '' ? Number(r.price) : Number(r.discountedPrice),
          quantity: Number(r.quantity),
          isActive: r.isActive,
        })),
      });
      onSaved(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={product ? `Quick edit: ${product.name}` : 'Quick edit'} onClose={onClose} widthClassName="max-w-3xl">
      {!product ? (
        <p className={error ? 'text-base text-destructive' : 'py-6 text-center text-base text-muted-foreground'}>{error ?? 'Loading…'}</p>
      ) : (
        <div className="space-y-4">
          <p className="text-base text-muted-foreground">Change what you sell most often. Other details are in Edit product.</p>
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg border border-border p-4">
              <p className="mb-3 text-base font-semibold text-foreground">{r.label}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-sm font-medium text-foreground">
                  Price (৳) <Req />
                  <input className={`${input} mt-1`} type="number" min={0} value={r.price} onChange={(e) => patch(r.id, { price: e.target.value })} />
                </label>
                <label className="text-sm font-medium text-foreground">
                  Offer price (৳) <Opt />
                  <input className={`${input} mt-1`} type="number" min={0} placeholder="No offer" value={r.discountedPrice} onChange={(e) => patch(r.id, { discountedPrice: e.target.value })} />
                </label>
                <label className="text-sm font-medium text-foreground">
                  In stock <Req />
                  <input className={`${input} mt-1`} type="number" min={0} value={r.quantity} onChange={(e) => patch(r.id, { quantity: e.target.value })} />
                </label>
              </div>
              <label className="mt-3 flex items-center gap-2 text-base text-foreground">
                <input type="checkbox" checked={r.isActive} onChange={(e) => patch(r.id, { isActive: e.target.checked })} />
                Customers can buy this option
              </label>
            </div>
          ))}
          {error && <p role="alert" className="text-base text-destructive">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-5 py-2.5 text-base font-medium text-foreground hover:bg-muted">Cancel</button>
            <button type="button" onClick={save} disabled={busy} className="rounded-lg bg-primary px-5 py-2.5 text-base font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60">
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
