'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PhoneInput } from '@/components/phone-input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ApiError } from '@/lib/api/http';
import { addressApi, type AddressOwner } from '@/lib/api/addresses';
import { COUNTRIES } from '@/lib/countries';
import type { AddressInput, AddressView } from '@/types/address';
import { DELETE_ENABLED } from '@/lib/features';

type Variant = 'store' | 'admin';

const STYLE: Record<Variant, Record<'input' | 'label' | 'card' | 'primary' | 'outline' | 'muted' | 'ink' | 'badge' | 'link', string>> = {
  store: {
    input: 'w-full rounded-lg border border-st-line bg-white px-3 py-2 text-sm text-st-ink placeholder:text-st-slate/70 focus:border-st-teal focus:outline-none focus:ring-2 focus:ring-st-teal/20',
    label: 'mb-1 block text-xs font-medium text-st-slate',
    card: 'rounded-xl border border-st-line bg-white p-4 sm:p-5',
    primary: 'rounded-full bg-st-ink px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-st-teal disabled:opacity-50',
    outline: 'rounded-full border border-st-line px-4 py-2 text-sm text-st-ink hover:bg-st-dove disabled:opacity-50',
    muted: 'text-st-slate',
    ink: 'text-st-ink',
    badge: 'rounded-full bg-st-teal/10 px-2 py-0.5 text-xs font-medium text-st-teal',
    link: 'text-xs text-st-slate underline-offset-2 hover:text-st-ink hover:underline',
  },
  admin: {
    input: 'w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none',
    label: 'mb-1 block text-xs font-medium text-muted-foreground',
    card: 'rounded-xl border border-border bg-card p-4 shadow-sm',
    primary: 'rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50',
    outline: 'rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50',
    muted: 'text-muted-foreground',
    ink: 'text-foreground',
    badge: 'rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary',
    link: 'text-xs text-primary hover:underline',
  },
};

const BLANK = { recipientName: '', phone: '', countryCode: '', state: '', city: '', address: '', zipCode: '', isDefault: false };

function AddressForm({
  variant,
  initial,
  onSave,
  onCancel,
}: {
  variant: Variant;
  initial: AddressView | null;
  onSave: (input: AddressInput) => Promise<void>;
  onCancel: () => void;
}) {
  const st = STYLE[variant];
  const [f, setF] = useState(
    initial
      ? { recipientName: initial.recipientName, phone: initial.phone, countryCode: initial.countryCode, state: initial.state ?? '', city: initial.city, address: initial.address, zipCode: initial.zipCode ?? '', isDefault: initial.isDefault }
      : BLANK,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof BLANK) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((v) => ({ ...v, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (f.recipientName.trim().length < 2) return setError('Enter the name of the person receiving the order.');
    if (!f.phone) return setError('Enter a valid phone number.');
    if (!f.countryCode) return setError('Choose a country.');
    if (!f.city.trim()) return setError('Enter the city.');
    if (f.address.trim().length < 5) return setError('Write the address in a few words: house, road, area.');
    setBusy(true);
    try {
      await onSave({
        recipientName: f.recipientName.trim(),
        phone: f.phone,
        countryCode: f.countryCode,
        state: f.state.trim() || null,
        city: f.city.trim(),
        address: f.address.trim(),
        zipCode: f.zipCode.trim() || null,
        isDefault: f.isDefault,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the address.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={`${st.card} space-y-3`}>
      <h3 className={`font-semibold ${st.ink}`}>{initial ? 'Edit address' : 'New address'}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={st.label} htmlFor="ad-name">Recipient name</label>
          <input id="ad-name" className={st.input} value={f.recipientName} onChange={set('recipientName')} maxLength={255} />
        </div>
        <div>
          <label className={st.label} htmlFor="ad-phone">Phone</label>
          <PhoneInput id="ad-phone" defaultValue={initial?.phone ?? ''} onChange={(v) => setF((x) => ({ ...x, phone: v }))} />
        </div>
        <div>
          <label className={st.label} htmlFor="ad-country">Country</label>
          <select id="ad-country" className={st.input} value={f.countryCode} onChange={set('countryCode')}>
            <option value="">Choose a country</option>
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={st.label} htmlFor="ad-state">State or division (optional)</label>
          <input id="ad-state" className={st.input} value={f.state} onChange={set('state')} maxLength={120} />
        </div>
        <div>
          <label className={st.label} htmlFor="ad-city">City or district</label>
          <input id="ad-city" className={st.input} value={f.city} onChange={set('city')} maxLength={120} />
        </div>
        <div>
          <label className={st.label} htmlFor="ad-zip">Postal code (optional)</label>
          <input id="ad-zip" className={st.input} value={f.zipCode} onChange={set('zipCode')} maxLength={20} />
        </div>
        <div className="sm:col-span-2">
          <label className={st.label} htmlFor="ad-address">Address</label>
          <textarea id="ad-address" rows={2} className={st.input} value={f.address} onChange={set('address')} maxLength={500} placeholder="House, road, area, landmarks" />
        </div>
      </div>
      <label className={`flex items-center gap-2 text-sm ${st.ink}`}>
        <input type="checkbox" checked={f.isDefault} onChange={(e) => setF((v) => ({ ...v, isDefault: e.target.checked }))} disabled={initial?.isDefault} />
        Use as the default address{initial?.isDefault ? ' (choose another address to change it)' : ''}
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={st.primary}>{busy ? 'Saving…' : 'Save address'}</button>
        <button type="button" onClick={onCancel} className={st.outline}>Cancel</button>
      </div>
    </form>
  );
}

/**
 * A customer's saved addresses: add, edit, delete, choose the default. Used by the
 * customer themselves (`me`) and by an admin managing a customer's list.
 */
export function AddressBook({ owner, variant, onError }: { owner: AddressOwner; variant: Variant; onError?: (message: string) => void }) {
  const st = STYLE[variant];
  const ownerKey = owner.kind === 'me' ? 'me' : `user-${owner.userId}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const api = useMemo(() => addressApi(owner), [ownerKey]);
  const [items, setItems] = useState<AddressView[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<AddressView | 'new' | null>(null);
  const [removing, setRemoving] = useState<AddressView | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await api.list());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [api]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function save(input: AddressInput) {
    if (editing && editing !== 'new') await api.update(editing.id, input);
    else await api.create(input);
    setEditing(null);
    await load();
  }

  async function makeDefault(a: AddressView) {
    try {
      await api.update(a.id, { isDefault: true });
      await load();
    } catch (e) {
      onError?.(e instanceof ApiError ? e.message : 'Could not change the default address.');
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    try {
      await api.remove(removing.id);
      await load();
    } catch (e) {
      onError?.(e instanceof ApiError ? e.message : 'Could not delete the address.');
    } finally {
      setRemoving(null);
    }
  }

  if (failed) return <p className="text-sm text-destructive">Could not load the addresses. <button type="button" className="underline" onClick={load}>Try again</button></p>;
  if (items === null) return <p className={`text-sm ${st.muted}`}>Loading…</p>;

  return (
    <div className="space-y-3">
      {editing ? (
        <AddressForm key={editing === 'new' ? 'new' : editing.id} variant={variant} initial={editing === 'new' ? null : editing} onSave={save} onCancel={() => setEditing(null)} />
      ) : (
        <button type="button" onClick={() => setEditing('new')} className={st.primary}>Add an address</button>
      )}
      {items.length === 0 && !editing && <p className={`text-sm ${st.muted}`}>No saved addresses yet.</p>}
      <ul className="grid gap-3 md:grid-cols-2">
        {items.map((a) => (
          <li key={a.id} className={st.card}>
            <div className="flex items-start justify-between gap-2">
              <p className={`font-medium ${st.ink}`}>{a.recipientName}</p>
              {a.isDefault && <span className={st.badge}>Default</span>}
            </div>
            <p className={`mt-1 text-sm ${st.muted}`}>{a.address}</p>
            <p className={`text-sm ${st.muted}`}>{[a.city, a.state, a.zipCode].filter(Boolean).join(', ')}</p>
            <p className={`text-sm ${st.muted}`}>{a.countryName}</p>
            <p className={`text-sm ${st.muted}`}>{a.phone}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" className={st.link} onClick={() => setEditing(a)}>Edit</button>
              {!a.isDefault && <button type="button" className={st.link} onClick={() => makeDefault(a)}>Make default</button>}
              {(variant === 'store' || DELETE_ENABLED) && <button type="button" className={`${st.link} hover:!text-destructive`} onClick={() => setRemoving(a)}>Delete</button>}
            </div>
          </li>
        ))}
      </ul>
      {removing && (
        <ConfirmDialog
          title="Delete this address?"
          description={`${removing.recipientName}, ${removing.city}. Orders already placed keep the address they were sent to.`}
          confirmLabel="Delete address"
          onConfirm={confirmRemove}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
