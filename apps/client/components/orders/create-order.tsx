'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { orderApi } from '@/lib/api/orders';
import { SavedAddressBar } from '@/components/addresses/saved-address-bar';
import { addressApi } from '@/lib/api/addresses';
import { listSellers } from '@/lib/api/sellers';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import type { AddressView } from '@/types/address';
import type { Seller } from '@/types/seller';
import type {
  CatalogProduct,
  CustomerHit,
  DeliveryType,
  OrderOptions,
  StaffRole,
} from '@/types/order';
import { base, field, money, outlineButton, primaryButton, useApiError } from './ui';

interface Line {
  productId: number;
  productName: string;
  skuId: number;
  label: string;
  quantity: number;
  unit: number;
  stock: number;
}

const card = 'rounded-xl border border-border bg-card p-5 shadow-sm';
const looksLikeContact = (q: string) => q.includes('@') || q.replace(/\D/g, '').length >= 6;

/**
 * Enter an order for a customer: find them by email or mobile, pick the seller
 * (admin only), add items, then address, delivery and payment method. Prices are
 * the live ones; the server works out every total.
 */
export function CreateOrderForm({ role }: { role: StaffRole }) {
  const api = useMemo(() => orderApi(role), [role]);
  const errorMessage = useApiError(role);
  const router = useRouter();
  const { showToast } = useToast();

  // customer
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<CustomerHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [customer, setCustomer] = useState<CustomerHit | null>(null);
  const [walkIn, setWalkIn] = useState(false);
  const [saved, setSaved] = useState<AddressView[]>([]);
  const [savedId, setSavedId] = useState<number | null>(null);

  // seller (admin)
  const [sellerSearch, setSellerSearch] = useState('');
  const debouncedSeller = useDebouncedValue(sellerSearch);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [seller, setSeller] = useState<Seller | null>(null);

  // items
  const [productSearch, setProductSearch] = useState('');
  const debouncedProduct = useDebouncedValue(productSearch);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [lines, setLines] = useState<Line[]>([]);

  // delivery and payment
  const [options, setOptions] = useState<OrderOptions | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('standard');
  const [gatewayId, setGatewayId] = useState<number | ''>('');
  const [proof, setProof] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const subtotal = lines.reduce((n, l) => n + l.unit * l.quantity, 0);
  const sellerId = role === 'admin' ? seller?.id : undefined;
  const sellerReady = role === 'seller' || !!seller;

  useEffect(() => {
    api.options().then(setOptions).catch(() => undefined);
  }, [api]);

  // Prices for the chosen country; refreshed as the items change.
  useEffect(() => {
    if (!countryCode) return;
    api.options({ countryCode, subtotal }).then(setOptions).catch(() => undefined);
  }, [api, countryCode, subtotal]);

  useEffect(() => {
    if (role !== 'admin') return;
    listSellers({ search: debouncedSeller || undefined, status: 'approved', activeStatus: 'active', limit: 8 })
      .then((r) => setSellers(r.results))
      .catch(() => setSellers([]));
  }, [role, debouncedSeller]);

  useEffect(() => {
    if (!sellerReady) return;
    api.catalog({ sellerId, search: debouncedProduct || undefined })
      .then((r) => setCatalog(r.results))
      .catch(() => setCatalog([]));
  }, [api, sellerReady, sellerId, debouncedProduct]);

  const gateway = options?.paymentGateways.find((g) => g.id === gatewayId);
  const delivery = options?.deliveryOptions.find((d) => d.deliveryType === deliveryType);
  const payable = subtotal + (delivery?.charge ?? 0);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!looksLikeContact(query)) return setHits([]);
    setSearching(true);
    try {
      setHits((await api.findCustomers(query.trim())).results);
    } catch (err) {
      showToast(errorMessage(err, 'Search failed.'), 'error');
    } finally {
      setSearching(false);
    }
  }

  const customerOwner = (userId: number) =>
    role === 'admin' ? ({ kind: 'user', userId } as const) : ({ kind: 'sellerCustomer', userId } as const);

  /** Saves the typed address to the customer's book and selects it. */
  async function saveTyped() {
    if (!customer) return;
    const created = await addressApi(customerOwner(customer.id)).create({
      recipientName: recipientName.trim(),
      phone: recipientPhone.trim(),
      countryCode,
      state: state.trim() || null,
      city: city.trim(),
      address: addressLine.trim(),
      zipCode: postalCode.trim() || null,
    });
    setSaved((list) => [...list, created]);
    setSavedId(created.id);
  }

  function fillFromSaved(a: AddressView) {
    setSavedId(a.id);
    setRecipientName(a.recipientName);
    setRecipientPhone(a.phone);
    setCountryCode(a.countryCode);
    setState(a.state ?? '');
    setCity(a.city);
    setAddressLine(a.address);
    setPostalCode(a.zipCode ?? '');
  }

  function pickCustomer(c: CustomerHit) {
    setSaved([]);
    setSavedId(null);
    // Both admin and seller can read the customer's saved addresses (and add to them).
    addressApi(customerOwner(c.id))
      .list()
      .then((list) => {
        setSaved(list);
        const first = list.find((a) => a.isDefault) ?? list[0];
        if (first) fillFromSaved(first);
      })
      .catch(() => undefined);
    setCustomer(c);
    setWalkIn(false);
    setRecipientName(c.name);
    setRecipientPhone(c.phone ?? '');
    setEmail(c.email ?? '');
  }

  function chooseSeller(s: Seller | null) {
    setSeller(s);
    setLines([]);
    setCatalog([]);
  }

  function addLine(p: CatalogProduct, skuId: number) {
    const sku = p.skus.find((s) => s.id === skuId);
    if (!sku || sku.quantity <= 0) return;
    setLines((current) => {
      const existing = current.find((l) => l.skuId === skuId);
      if (existing) return current.map((l) => (l.skuId === skuId ? { ...l, quantity: Math.min(l.quantity + 1, sku.quantity, 99) } : l));
      return [...current, { productId: p.id, productName: p.name, skuId, label: sku.label || sku.code, quantity: 1, unit: sku.payable, stock: sku.quantity }];
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (role === 'admin' && !seller) return setFormError('Choose the seller first.');
    if (!customer && !walkIn) return setFormError('Find the customer, or choose to enter a walk-in customer.');
    if (lines.length === 0) return setFormError('Add at least one item.');
    if (!recipientName.trim() || !recipientPhone.trim()) return setFormError('Enter the recipient name and phone (with country code, e.g. +8801712345678).');
    if (!countryCode || !city.trim() || addressLine.trim().length < 5) return setFormError('Enter the country, city and a street address.');
    if (!gateway) return setFormError('Choose a payment method.');
    setBusy(true);
    try {
      const filledProof = Object.fromEntries(Object.entries(proof).filter(([, v]) => v.trim()));
      const created = await api.create({
        ...(role === 'admin' ? { sellerId: seller!.id } : {}),
        ...(customer ? { userId: customer.id } : {}),
        items: lines.map((l) => ({ sellerProductId: l.productId, sellerProductSkuId: l.skuId, quantity: l.quantity })),
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone.trim(),
        ...(email.trim() ? { contactEmail: email.trim() } : {}),
        countryCode,
        ...(state.trim() ? { state: state.trim() } : {}),
        city: city.trim(),
        addressLine: addressLine.trim(),
        ...(postalCode.trim() ? { postalCode: postalCode.trim() } : {}),
        deliveryType,
        paymentGatewayId: gateway.id,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(Object.keys(filledProof).length ? { paymentProof: filledProof } : {}),
      });
      showToast(`Order ${created.orderNumber} created.`, 'success');
      router.push(`${base(role)}/orders/${created.id}`);
    } catch (err) {
      setFormError(errorMessage(err, 'Failed to create the order.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-4xl space-y-5">
      <div>
        <Link href={`${base(role)}/orders`} className="text-sm text-primary hover:underline">← Orders</Link>
        <h1 className="mt-1 text-2xl font-bold text-foreground">Create order</h1>
        <p className="text-sm text-muted-foreground">Prices and stock are the live ones. The order starts as pending with payment due.</p>
      </div>

      <section className={card}>
        <h2 className="text-sm font-semibold text-foreground">1. Customer</h2>
        {customer ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm">
            <span><strong>{customer.name}</strong> · {customer.phone} · {customer.email ?? 'no email'}</span>
            <button type="button" className="text-primary hover:underline" onClick={() => { setCustomer(null); setHits(null); }}>Change</button>
          </div>
        ) : walkIn ? (
          <div className="mt-2 flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
            <span>Walk-in customer, no account. Fill in their details below.</span>
            <button type="button" className="text-primary hover:underline" onClick={() => setWalkIn(false)}>Search instead</button>
          </div>
        ) : (
          <>
            <div className="mt-2 flex gap-2">
              <input
                className={`${field} flex-1`}
                placeholder="Customer email or mobile number"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setHits(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') search(e); }}
              />
              <button type="button" onClick={search} disabled={searching} className={outlineButton}>{searching ? 'Searching…' : 'Find'}</button>
            </div>
            {hits && hits.length > 0 && (
              <ul className="mt-2 divide-y divide-border rounded-md border border-border">
                {hits.map((h) => (
                  <li key={h.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{h.name} · {h.phone} · {h.email ?? 'no email'}{!h.canOrder && <span className="ml-2 text-xs text-destructive">Account suspended</span>}</span>
                    <button type="button" disabled={!h.canOrder} className="text-primary hover:underline disabled:opacity-40" onClick={() => pickCustomer(h)}>Use this customer</button>
                  </li>
                ))}
              </ul>
            )}
            {hits && hits.length === 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                No account with that email or mobile.{' '}
                <button type="button" className="text-primary hover:underline" onClick={() => setWalkIn(true)}>Enter a walk-in customer instead</button>
              </p>
            )}
          </>
        )}
      </section>

      {role === 'admin' && (
        <section className={card}>
          <h2 className="text-sm font-semibold text-foreground">2. Seller</h2>
          {seller ? (
            <div className="mt-2 flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
              <span><strong>{seller.name}</strong></span>
              <button type="button" className="text-primary hover:underline" onClick={() => chooseSeller(null)}>Change</button>
            </div>
          ) : (
            <>
              <input className={`${field} mt-2 w-full`} placeholder="Search sellers by name" value={sellerSearch} onChange={(e) => setSellerSearch(e.target.value)} />
              <ul className="mt-2 divide-y divide-border rounded-md border border-border">
                {sellers.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No approved, active seller found.</li>}
                {sellers.map((s) => (
                  <li key={s.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{s.name}</span>
                    <button type="button" className="text-primary hover:underline" onClick={() => chooseSeller(s)}>Choose</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <section className={card}>
        <h2 className="text-sm font-semibold text-foreground">{role === 'admin' ? '3' : '2'}. Items</h2>
        {!sellerReady ? (
          <p className="mt-2 text-sm text-muted-foreground">Choose a seller to see their products.</p>
        ) : (
          <>
            <input className={`${field} mt-2 w-full`} placeholder="Search products by name" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
            <ul className="mt-2 max-h-72 divide-y divide-border overflow-y-auto rounded-md border border-border">
              {catalog.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No products to sell.</li>}
              {catalog.map((p) => (
                <li key={p.id} className="px-3 py-2 text-sm">
                  <p className="font-medium text-foreground">{p.name}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {p.skus.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        disabled={s.quantity <= 0}
                        onClick={() => addLine(p, s.id)}
                        className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
                      >
                        {s.label || s.code} · {money(s.payable)}{s.payable !== s.price && <s className="ml-1 text-muted-foreground">{money(s.price)}</s>} · {s.quantity > 0 ? `${s.quantity} in stock` : 'out of stock'}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            {lines.length > 0 && (
              <table className="mt-3 min-w-full text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Item</th><th>Qty</th><th>Unit</th><th>Total</th><th /></tr></thead>
                <tbody className="divide-y divide-border">
                  {lines.map((l) => (
                    <tr key={l.skuId}>
                      <td className="py-2">{l.productName}<span className="block text-xs text-muted-foreground">{l.label}</span></td>
                      <td>
                        <input type="number" min={1} max={Math.min(l.stock, 99)} value={l.quantity} aria-label={`Quantity of ${l.productName}`}
                          onChange={(e) => setLines((c) => c.map((x) => x.skuId === l.skuId ? { ...x, quantity: Math.max(1, Math.min(Number(e.target.value) || 1, l.stock, 99)) } : x))}
                          className={`${field} w-20 py-1`} />
                      </td>
                      <td className="text-muted-foreground">{money(l.unit)}</td>
                      <td className="font-medium text-foreground">{money(l.unit * l.quantity)}</td>
                      <td className="text-right"><button type="button" className="text-xs text-destructive hover:underline" onClick={() => setLines((c) => c.filter((x) => x.skuId !== l.skuId))}>Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>

      <section className={card}>
        <h2 className="text-sm font-semibold text-foreground">{role === 'admin' ? '4' : '3'}. Recipient and address</h2>
        {customer && (
          <div className="mt-2">
            <SavedAddressBar
              variant="admin"
              addresses={saved}
              selectedId={savedId}
              fields={{ recipientName, phone: recipientPhone.trim(), countryCode, state, city, address: addressLine, zipCode: postalCode }}
              onSelect={(a) => (a ? fillFromSaved(a) : setSavedId(null))}
              onSave={saveTyped}
            />
          </div>
        )}
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          <input className={field} placeholder="Recipient name" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
          <input className={field} placeholder="Phone with country code, +8801712345678" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} />
          <input className={field} type="email" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select className={field} value={countryCode} onChange={(e) => setCountryCode(e.target.value)} aria-label="Country">
            <option value="">Country</option>
            {options?.countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
          <input className={field} placeholder="State or division (optional)" value={state} onChange={(e) => setState(e.target.value)} />
          <input className={field} placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
          <input className={`${field} md:col-span-2`} placeholder="Street address" value={addressLine} onChange={(e) => setAddressLine(e.target.value)} />
          <input className={field} placeholder="Postal code (optional)" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
        </div>
      </section>

      <section className={card}>
        <h2 className="text-sm font-semibold text-foreground">{role === 'admin' ? '5' : '4'}. Delivery and payment</h2>
        {!countryCode ? (
          <p className="mt-2 text-sm text-muted-foreground">Choose a country to see delivery prices.</p>
        ) : (
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            {options?.deliveryOptions.map((d) => (
              <label key={d.deliveryType} className={`cursor-pointer rounded-md border p-3 text-sm ${deliveryType === d.deliveryType ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <input type="radio" name="delivery" className="mr-2" checked={deliveryType === d.deliveryType} onChange={() => setDeliveryType(d.deliveryType)} />
                <span className="font-medium capitalize text-foreground">{d.deliveryType}</span>
                <span className="block text-muted-foreground">{money(d.charge)} · about {d.estimatedDays} days{d.zoneName ? ` · ${d.zoneName}` : ''}</span>
              </label>
            ))}
          </div>
        )}
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <select className={field} value={gatewayId} onChange={(e) => { setGatewayId(e.target.value ? Number(e.target.value) : ''); setProof({}); }} aria-label="Payment method">
            <option value="">Payment method</option>
            {options?.paymentGateways.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          {gateway?.proofFields.map((f) => (
            <input key={f.key} className={field} placeholder={`${f.label} (optional now)`} maxLength={200} value={proof[f.key] ?? ''} onChange={(e) => setProof((p) => ({ ...p, [f.key]: e.target.value }))} />
          ))}
        </div>
        {gateway?.description && <p className="mt-2 text-xs text-muted-foreground">{gateway.description}</p>}
        <textarea className={`${field} mt-3 w-full`} rows={2} maxLength={1000} placeholder="Note on the order (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="text-sm">
          <p className="text-muted-foreground">Items {money(subtotal)} + delivery {countryCode ? money(delivery?.charge ?? 0) : '—'}</p>
          <p className="text-lg font-semibold text-foreground">Payable {money(payable)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {formError && <p role="alert" className="max-w-md text-right text-sm text-destructive">{formError}</p>}
          <button type="submit" disabled={busy} className={primaryButton}>{busy ? 'Creating…' : 'Create order'}</button>
        </div>
      </div>
    </form>
  );
}
