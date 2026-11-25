'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PhoneInput } from '@/components/phone-input';
import { CartTotals } from './cart-lines';
import { money } from './product-card';
import { SavedAddressBar } from '@/components/addresses/saved-address-bar';
import { addressApi } from '@/lib/api/addresses';
import { getCheckoutOptions, placeOrder, type CheckoutOptions } from '@/lib/api/customer-orders';
import { getMyUserProfile } from '@/lib/api/user-portal';
import { ApiError, NotFoundApiError } from '@/lib/api/http';
import { getUserToken } from '@/lib/auth/user-token';
import { useCart } from '@/lib/cart/cart-context';
import { COUNTRIES } from '@/lib/countries';
import type { AddressView } from '@/types/address';
import type { DeliveryType } from '@/types/order';
import { roundMoney } from '@/lib/money';

const input =
  'w-full rounded-lg border border-st-line bg-white px-3 py-2 text-sm text-st-ink placeholder:text-st-slate/70 focus:border-st-teal focus:outline-none focus:ring-2 focus:ring-st-teal/20';
const label = 'mb-1 block text-xs font-medium text-st-slate';

const DELIVERY_TEXT: Record<DeliveryType, string> = {
  standard: 'Standard delivery',
  express: 'Express delivery',
  pickup: 'Pickup',
};

/** One cart, one order: where to send it, how, and how it will be paid. */
export function CheckoutForm({ cartId }: { cartId: number }) {
  const router = useRouter();
  const { changed } = useCart();
  const [data, setData] = useState<CheckoutOptions | null>(null);
  const [state, setState] = useState<'loading' | 'missing' | 'error' | 'ready'>('loading');
  const [signedIn] = useState(() => (typeof window === 'undefined' ? false : !!getUserToken()));

  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneDefault, setPhoneDefault] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [stateName, setStateName] = useState('');
  const [city, setCity] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('standard');
  const [gatewayId, setGatewayId] = useState<number | null>(null);
  const [proof, setProof] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [saved, setSaved] = useState<AddressView[]>([]);
  const [savedId, setSavedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCheckoutOptions(cartId, countryCode || undefined)
      .then((r) => {
        if (cancelled) return;
        setData(r);
        setState('ready');
      })
      .catch((e) => !cancelled && setState(e instanceof NotFoundApiError ? 'missing' : 'error'));
    return () => {
      cancelled = true;
    };
  }, [cartId, countryCode, reloadKey]);

  // A signed-in customer starts with their own details filled in.
  useEffect(() => {
    if (!signedIn) return;
    getMyUserProfile()
      .then((u) => {
        setRecipientName((v) => v || u.name);
        setEmail((v) => v || (u.email ?? ''));
        setPhoneDefault(u.phone ?? '');
        if (u.phone) setPhone(u.phone);
      })
      .catch(() => undefined);
  }, [signedIn]);

  // Saved addresses: the default one is filled in to start with.
  useEffect(() => {
    if (!signedIn) return;
    addressApi({ kind: 'me' })
      .list()
      .then((list) => {
        setSaved(list);
        const first = list.find((a) => a.isDefault) ?? list[0];
        if (first) applySaved(first);
      })
      .catch(() => undefined);
  }, [signedIn]);

  function applySaved(a: AddressView) {
    setSavedId(a.id);
    setRecipientName(a.recipientName);
    setPhoneDefault(a.phone);
    setPhone(a.phone);
    setCountryCode(a.countryCode);
    setStateName(a.state ?? '');
    setCity(a.city);
    setAddressLine(a.address);
    setPostalCode(a.zipCode ?? '');
  }

  /** Saves what is typed into the address book and selects it. */
  async function saveTyped() {
    const created = await addressApi({ kind: 'me' }).create({
      recipientName: recipientName.trim(),
      phone,
      countryCode,
      state: stateName.trim() || null,
      city: city.trim(),
      address: addressLine.trim(),
      zipCode: postalCode.trim() || null,
    });
    setSaved((list) => [...list, created]);
    setSavedId(created.id);
  }

  const gateway = data?.paymentGateways.find((g) => g.id === gatewayId) ?? null;
  const delivery = data?.deliveryOptions.find((d) => d.deliveryType === deliveryType) ?? null;
  const subtotal = data?.cart.totals.payableTotal ?? 0;
  const payable = roundMoney(subtotal + (delivery?.charge ?? 0));
  const countryName = useMemo(() => COUNTRIES.find((c) => c.code === countryCode)?.name, [countryCode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIssues([]);
    if (!data) return;
    if (recipientName.trim().length < 2) return setError('Enter the name of the person receiving the order.');
    if (!phone) return setError('Enter a valid phone number so the seller can reach you.');
    if (!countryCode) return setError('Choose the country to deliver to.');
    if (!city.trim()) return setError('Enter the city.');
    if (addressLine.trim().length < 5) return setError('Enter the street address.');
    if (!gateway) return setError('Choose how you will pay.');
    const missing = gateway.proofFields.find((f) => f.required && !(proof[f.key] ?? '').trim());
    if (missing) return setError(`${missing.label} is required for ${gateway.name}.`);

    setBusy(true);
    try {
      const filled = Object.fromEntries(Object.entries(proof).filter(([, v]) => v.trim()));
      const order = await placeOrder(cartId, {
        recipientName: recipientName.trim(),
        recipientPhone: phone,
        ...(email.trim() ? { contactEmail: email.trim() } : {}),
        countryCode,
        ...(stateName.trim() ? { state: stateName.trim() } : {}),
        city: city.trim(),
        addressLine: addressLine.trim(),
        ...(postalCode.trim() ? { postalCode: postalCode.trim() } : {}),
        deliveryType,
        paymentGatewayId: gateway.id,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(Object.keys(filled).length ? { paymentProof: filled } : {}),
        expectedItemsTotal: subtotal,
      });
      changed();
      router.replace(`/orders/${order.id}?placed=1`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setIssues(err.issues);
        // A 409 means the cart changed under us: show the new prices.
        if (err.status === 409) setReloadKey((k) => k + 1);
      } else {
        setError('We could not place your order. Try again.');
      }
      setBusy(false);
    }
  }

  if (state === 'loading') {
    return <div className="store-skeleton h-64 rounded-xl bg-st-line" aria-busy="true" />;
  }
  if (state !== 'ready' || !data) {
    return (
      <div className="rounded-xl border border-st-line bg-white px-6 py-14 text-center">
        <p className="font-display text-lg font-semibold">
          {state === 'missing' ? 'This cart is no longer open' : 'We couldn’t load checkout'}
        </p>
        <p className="mt-1 text-sm text-st-slate">
          {state === 'missing' ? 'It may have been ordered already, or emptied.' : 'Check your connection and try again.'}
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Link href="/cart" className="rounded-full bg-st-ink px-5 py-2 text-sm font-semibold text-white hover:bg-st-teal">Your carts</Link>
          {state === 'missing' && <Link href="/orders" className="rounded-full border border-st-line px-5 py-2 text-sm font-semibold text-st-ink hover:bg-st-dove">Your orders</Link>}
        </div>
      </div>
    );
  }

  const cart = data.cart;
  return (
    <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-5">
        {!signedIn && (
          <p className="rounded-xl border border-st-line bg-white px-4 py-3 text-sm text-st-slate">
            You are checking out as a guest. Keep the order number we give you, or{' '}
            <Link href="/user/login" className="font-medium text-st-ink underline">sign in</Link> to see your orders any time.
          </p>
        )}

        <section className="rounded-xl border border-st-line bg-white p-4 sm:p-5">
          <h2 className="font-display mb-3 text-lg font-semibold text-st-ink">Who is it for?</h2>
          {signedIn && (
            <div className="mb-3">
              <SavedAddressBar
                variant="store"
                addresses={saved}
                selectedId={savedId}
                fields={{ recipientName, phone, countryCode, state: stateName, city, address: addressLine, zipCode: postalCode }}
                onSelect={(a) => (a ? applySaved(a) : setSavedId(null))}
                onSave={saveTyped}
              />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="co-name">Full name</label>
              <input id="co-name" className={input} value={recipientName} onChange={(e) => setRecipientName(e.target.value)} autoComplete="name" maxLength={255} />
            </div>
            <div>
              <label className={label} htmlFor="co-email">Email (optional)</label>
              <input id="co-email" type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={255} />
            </div>
            <div className="min-w-0 sm:col-span-2">
              <label className={label} htmlFor="co-phone">Phone</label>
              <PhoneInput id="co-phone" key={phoneDefault} defaultValue={phoneDefault} onChange={setPhone} />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-st-line bg-white p-4 sm:p-5">
          <h2 className="font-display mb-3 text-lg font-semibold text-st-ink">Where should it go?</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={label} htmlFor="co-country">Country</label>
              <select id="co-country" className={input} value={countryCode} onChange={(e) => setCountryCode(e.target.value)} autoComplete="country">
                <option value="">Choose a country</option>
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={label} htmlFor="co-address">Street address</label>
              <input id="co-address" className={input} value={addressLine} onChange={(e) => setAddressLine(e.target.value)} autoComplete="street-address" maxLength={500} />
            </div>
            <div>
              <label className={label} htmlFor="co-city">City</label>
              <input id="co-city" className={input} value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" maxLength={120} />
            </div>
            <div>
              <label className={label} htmlFor="co-state">State or division (optional)</label>
              <input id="co-state" className={input} value={stateName} onChange={(e) => setStateName(e.target.value)} autoComplete="address-level1" maxLength={120} />
            </div>
            <div>
              <label className={label} htmlFor="co-zip">Postal code (optional)</label>
              <input id="co-zip" className={input} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} autoComplete="postal-code" maxLength={20} />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-st-line bg-white p-4 sm:p-5">
          <h2 className="font-display mb-3 text-lg font-semibold text-st-ink">How should it be delivered?</h2>
          {!countryCode ? (
            <p className="text-sm text-st-slate">Choose a country to see delivery prices.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              {data.deliveryOptions.map((d) => (
                <label key={d.deliveryType} className={`cursor-pointer rounded-lg border p-3 text-sm ${deliveryType === d.deliveryType ? 'border-st-teal bg-st-teal/5' : 'border-st-line'}`}>
                  <input type="radio" name="delivery" className="mr-2 accent-st-teal" checked={deliveryType === d.deliveryType} onChange={() => setDeliveryType(d.deliveryType)} />
                  <span className="font-medium text-st-ink">{DELIVERY_TEXT[d.deliveryType]}</span>
                  <span className="mt-0.5 block text-st-slate">
                    {d.charge > 0 ? money(d.charge) : 'Free'} · about {d.estimatedDays} {d.estimatedDays === 1 ? 'day' : 'days'}
                  </span>
                </label>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-st-line bg-white p-4 sm:p-5">
          <h2 className="font-display mb-3 text-lg font-semibold text-st-ink">How will you pay?</h2>
          <div className="space-y-2">
            {data.paymentGateways.length === 0 && <p className="text-sm text-st-slate">No payment method is available right now.</p>}
            {data.paymentGateways.map((g) => (
              <label key={g.id} className={`block cursor-pointer rounded-lg border p-3 text-sm ${gatewayId === g.id ? 'border-st-teal bg-st-teal/5' : 'border-st-line'}`}>
                <input type="radio" name="gateway" className="mr-2 accent-st-teal" checked={gatewayId === g.id} onChange={() => { setGatewayId(g.id); setProof({}); }} />
                <span className="font-medium text-st-ink">{g.name}</span>
                <span className="ml-2 text-xs text-st-slate">{g.typeLabel}</span>
                {gatewayId === g.id && (
                  <div className="mt-2 space-y-2 pl-6">
                    {g.description && <p className="whitespace-pre-wrap text-st-slate">{g.description}</p>}
                    {(g.accountName || g.accountNumber || g.bankName) && (
                      <dl className="text-xs text-st-slate">
                        {g.bankName && <div>Bank: <span className="text-st-ink">{g.bankName}{g.branchName ? `, ${g.branchName}` : ''}</span></div>}
                        {g.accountName && <div>Account name: <span className="text-st-ink">{g.accountName}</span></div>}
                        {g.accountNumber && <div>Account number: <span className="text-st-ink">{g.accountNumber}</span></div>}
                      </dl>
                    )}
                    {g.proofFields.length > 0 && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {g.proofFields.map((f) => (
                          <div key={f.key}>
                            <label className={label} htmlFor={`proof-${f.key}`}>{f.label}{f.required ? '' : ' (optional)'}</label>
                            <input id={`proof-${f.key}`} className={input} value={proof[f.key] ?? ''} maxLength={200} onChange={(e) => setProof((p) => ({ ...p, [f.key]: e.target.value }))} />
                          </div>
                        ))}
                      </div>
                    )}
                    {g.proofFields.length > 0 && <p className="text-xs text-st-slate">Pay first, then enter the details above. The seller checks your payment and marks the order paid.</p>}
                  </div>
                )}
              </label>
            ))}
          </div>
          <div className="mt-4">
            <label className={label} htmlFor="co-note">Note for the seller (optional)</label>
            <textarea id="co-note" rows={2} className={input} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </section>
      </div>

      <aside className="h-fit min-w-0 space-y-3 rounded-xl border border-st-line bg-white p-4 sm:p-5 lg:sticky lg:top-32">
        <h2 className="font-display text-lg font-semibold text-st-ink">Your order with {cart.seller.name}</h2>
        <ul className="divide-y divide-st-line text-sm">
          {cart.lines.map((l) => (
            <li key={l.id} className="flex justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="line-clamp-2 text-st-ink">{l.product?.name ?? 'Removed product'}</span>
                <span className="text-xs text-st-slate">{l.sku?.label ? `${l.sku.label} · ` : ''}Qty {l.quantity}{l.proposal?.applied ? ' · your offer' : ''}</span>
                {l.status !== 'ok' && <span className="block text-xs font-medium text-destructive">Not available</span>}
              </span>
              <span className="shrink-0 text-st-ink">{l.status === 'ok' ? money(l.linePayable) : '—'}</span>
            </li>
          ))}
        </ul>
        <CartTotals cart={cart} />
        <dl className="space-y-1 border-t border-st-line pt-2 text-sm">
          <div className="flex justify-between text-st-slate"><dt>Delivery{countryName ? ` to ${countryName}` : ''}</dt><dd>{countryCode ? (delivery && delivery.charge > 0 ? money(delivery.charge) : 'Free') : '—'}</dd></div>
          <div className="flex justify-between text-base font-semibold text-st-ink"><dt>Total</dt><dd>{money(payable)}</dd></div>
        </dl>
        {!cart.canCheckout && (
          <div role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {cart.issues.map((i) => <p key={i}>{i}</p>)}
            <Link href="/cart" className="mt-1 inline-block font-medium underline">Fix your cart</Link>
          </div>
        )}
        {error && (
          <div role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <p>{error}</p>
            {issues.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-xs">
                {issues.map((i) => <li key={i}>{i}</li>)}
              </ul>
            )}
            {issues.length > 0 && <Link href="/cart" className="mt-1 inline-block text-xs font-medium underline">Update your cart</Link>}
          </div>
        )}
        <button type="submit" disabled={busy || !cart.canCheckout} className="w-full rounded-full bg-st-ink px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-st-teal disabled:opacity-50">
          {busy ? 'Placing your order…' : `Place order · ${money(payable)}`}
        </button>
        <p className="text-center text-xs text-st-slate">The price and stock are checked again when you place the order.</p>
      </aside>
    </form>
  );
}
