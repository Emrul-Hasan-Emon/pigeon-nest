'use client';

import { useState } from 'react';
import { ApiError } from '@/lib/api/http';
import type { AddressView } from '@/types/address';

type Variant = 'store' | 'admin';

const STYLE: Record<Variant, { input: string; label: string; button: string; muted: string }> = {
  store: {
    input: 'w-full rounded-lg border border-st-line bg-white px-3 py-2 text-sm text-st-ink focus:border-st-teal focus:outline-none focus:ring-2 focus:ring-st-teal/20',
    label: 'mb-1 block text-xs font-medium text-st-slate',
    button: 'rounded-full border border-st-line px-4 py-1.5 text-sm font-medium text-st-ink hover:bg-st-dove disabled:opacity-50',
    muted: 'text-xs text-st-slate',
  },
  admin: {
    input: 'w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none',
    label: 'mb-1 block text-xs font-medium text-muted-foreground',
    button: 'rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50',
    muted: 'text-xs text-muted-foreground',
  },
};

/** The values currently typed into an order's address fields. */
export interface AddressFields {
  recipientName: string;
  phone: string;
  countryCode: string;
  state: string;
  city: string;
  address: string;
  zipCode: string;
}

/** True when the typed fields are the same as the saved address. */
export function sameAddress(saved: AddressView, f: AddressFields): boolean {
  return (
    saved.recipientName === f.recipientName.trim() &&
    saved.phone === f.phone &&
    saved.countryCode === f.countryCode &&
    (saved.state ?? '') === f.state.trim() &&
    saved.city === f.city.trim() &&
    saved.address === f.address.trim() &&
    (saved.zipCode ?? '') === f.zipCode.trim()
  );
}

/** Enough is filled in for the server to accept it as an address. */
export function canSaveAddress(f: AddressFields): boolean {
  return f.recipientName.trim().length >= 2 && !!f.phone && !!f.countryCode && !!f.city.trim() && f.address.trim().length >= 5;
}

/**
 * Sits above an order's address fields. Lists the customer's saved addresses to
 * pick from; when the typed address is new (or edited), offers "Save this
 * address", which saves it to the customer's book and selects it.
 */
export function SavedAddressBar({
  variant,
  addresses,
  selectedId,
  fields,
  onSelect,
  onSave,
}: {
  variant: Variant;
  addresses: AddressView[];
  selectedId: number | null;
  fields: AddressFields;
  onSelect: (address: AddressView | null) => void;
  /** Saves the typed address and resolves with the saved one (which the caller then selects). */
  onSave: () => Promise<void>;
}) {
  const st = STYLE[variant];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = addresses.find((a) => a.id === selectedId) ?? null;
  const filled = canSaveAddress(fields);
  const isNew = !selected || !sameAddress(selected, fields);
  const showSave = filled && isNew;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await onSave();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save the address.');
    } finally {
      setBusy(false);
    }
  }

  if (addresses.length === 0 && !showSave) return null;
  return (
    <div className="space-y-2">
      {addresses.length > 0 && (
        <div>
          <label className={st.label} htmlFor="saved-address">Saved addresses</label>
          <select
            id="saved-address"
            className={st.input}
            value={selectedId ?? ''}
            onChange={(e) => onSelect(addresses.find((a) => a.id === Number(e.target.value)) ?? null)}
          >
            <option value="">Enter a new address</option>
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.recipientName}, {a.address.length > 40 ? `${a.address.slice(0, 40)}…` : a.address}, {a.city}, {a.countryName}{a.isDefault ? ' (default)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      {showSave && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={busy} className={st.button}>
            {busy ? 'Saving…' : selected ? 'Save as a new address' : 'Save this address'}
          </button>
          <span className={st.muted}>Saves it to the address book so it can be picked next time.</span>
        </div>
      )}
      {selected && !isNew && <p className={st.muted}>Using the saved address “{selected.recipientName}”.</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
