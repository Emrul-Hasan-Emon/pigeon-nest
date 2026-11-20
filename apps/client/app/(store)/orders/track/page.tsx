'use client';

import { useEffect, useState } from 'react';
import { Breadcrumb, Container } from '@/components/store/page-parts';
import { MyOrderDetail } from '@/components/store/my-order-detail';
import { PhoneInput } from '@/components/phone-input';
import { trackOrder, type MyOrder } from '@/lib/api/customer-orders';
import { ApiError } from '@/lib/api/http';

const input = 'w-full rounded-lg border border-st-line bg-white px-3 py-2 text-sm focus:border-st-teal focus:outline-none focus:ring-2 focus:ring-st-teal/20';

/** Guests look an order up with its number and the phone it was placed with. */
export default function TrackOrderPage() {
  const [number, setNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState<MyOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = 'Track an order | Pigeon Nest';
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (number.trim().length < 4) return setError('Enter the order number, like PN260520-K7M2QX.');
    if (!phone) return setError('Enter the phone number the order was placed with.');
    setBusy(true);
    try {
      setOrder(await trackOrder(number.trim(), phone));
    } catch (err) {
      setOrder(null);
      setError(err instanceof ApiError && err.status === 404 ? 'No order matches that number and phone.' : 'We could not look that up. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container className="max-w-4xl">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Track an order' }]} />
      <h1 className="font-display mb-1 text-2xl font-semibold text-st-ink sm:text-3xl">Track an order</h1>
      <p className="mb-4 text-sm text-st-slate">Enter the order number and the phone number you gave when you ordered.</p>
      <form onSubmit={submit} className="mb-6 grid gap-3 rounded-xl border border-st-line bg-white p-4 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
        <div>
          <label htmlFor="tr-number" className="mb-1 block text-xs font-medium text-st-slate">Order number</label>
          <input id="tr-number" className={input} value={number} onChange={(e) => setNumber(e.target.value)} placeholder="PN260520-K7M2QX" maxLength={60} />
        </div>
        <div>
          <label htmlFor="tr-phone" className="mb-1 block text-xs font-medium text-st-slate">Phone</label>
          <PhoneInput id="tr-phone" onChange={setPhone} />
        </div>
        <button type="submit" disabled={busy} className="rounded-full bg-st-ink px-5 py-2 text-sm font-semibold text-white hover:bg-st-teal disabled:opacity-50">{busy ? 'Looking…' : 'Find order'}</button>
        {error && <p role="alert" className="text-sm text-destructive sm:col-span-3">{error}</p>}
      </form>
      {order && <MyOrderDetail key={order.id} id={order.id} initial={order} />}
    </Container>
  );
}
