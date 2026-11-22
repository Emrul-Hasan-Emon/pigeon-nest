'use client';

import { useEffect, useState } from 'react';
import { listSettings, updateSettings } from '@/lib/api/shipping';
import { ApiError } from '@/lib/api/http';
import { useToast } from '@/components/ui/toast';
import type { SettingItem } from '@/types/shipping';

const fieldClass =
  'mt-1 w-full max-w-xs rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none';

export default function GeneralSettingsPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<SettingItem[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string | boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load(list: SettingItem[]) {
    setItems(list);
    setDraft(Object.fromEntries(list.map((s) => [s.key, typeof s.value === 'boolean' ? s.value : String(s.value)])));
  }

  useEffect(() => {
    listSettings()
      .then(load)
      .catch(() => showToast('Failed to load settings.', 'error'));
  }, [showToast]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!items) return;
    setError(null);

    const changes: Record<string, number | boolean | string> = {};
    for (const s of items) {
      const value = draft[s.key];
      if (s.type === 'enum') {
        if (value !== s.value) changes[s.key] = value as string;
        continue;
      }
      if (s.type === 'boolean') {
        if (value !== s.value) changes[s.key] = value as boolean;
        continue;
      }
      const text = String(value).trim();
      const number = Number(text);
      if (text === '' || !Number.isFinite(number)) return setError(`${s.label} must be a number.`);
      if (s.type === 'int' && !Number.isInteger(number)) return setError(`${s.label} must be a whole number.`);
      if (s.type === 'decimal' && Math.round(number * 100) / 100 !== number) return setError(`${s.label} can have at most 2 decimals.`);
      if (number < (s.min ?? -Infinity) || number > (s.max ?? Infinity)) return setError(`${s.label} must be between ${s.min} and ${s.max}.`);
      if (number !== s.value) changes[s.key] = number;
    }
    if (Object.keys(changes).length === 0) return showToast('Nothing changed.', 'success');

    setSaving(true);
    try {
      load(await updateSettings(changes));
      showToast('Settings saved.', 'success');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!items) return <p className="py-10 text-center text-muted-foreground">Loading…</p>;

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold text-foreground">General settings</h1>
      {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-1 font-semibold text-foreground">Shipping defaults</h2>
        <p className="mb-4 text-xs text-muted-foreground">Used for any destination and delivery type that no active shipping zone covers.</p>
        <div className="space-y-4">
          {items.filter((s) => s.group === 'shipping').map((s) =>
            s.type === 'boolean' ? (
              <label key={s.key} className="flex items-start gap-2 text-sm text-foreground">
                <input type="checkbox" className="mt-1" checked={draft[s.key] as boolean} onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.checked }))} />
                <span>{s.label}<span className="block text-xs text-muted-foreground">{s.description}</span></span>
              </label>
            ) : (
              <label key={s.key} className="block text-sm text-foreground">
                {s.label}
                <input className={fieldClass} inputMode="decimal" value={draft[s.key] as string} onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))} />
                <span className="mt-1 block text-xs text-muted-foreground">{s.description}</span>
              </label>
            ),
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-1 font-semibold text-foreground">Seller commission</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          The platform&apos;s cut, worked out for each item and added up for the order. It counts once the order is fully paid and comes back off when an item is returned.
          A seller with their own rate (set on the seller&apos;s page) uses that instead. Changes affect new orders only.
        </p>
        <div className="space-y-4">
          {items.filter((s) => s.group === 'commission').map((s) =>
            s.type === 'enum' ? (
              <label key={s.key} className="block text-sm text-foreground">
                {s.label}
                <select className={fieldClass} value={draft[s.key] as string} onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))}>
                  {s.options?.map((o) => <option key={o} value={o}>{o === 'percentage' ? 'Percentage of each item' : 'Fixed amount per item'}</option>)}
                </select>
              </label>
            ) : (
              <label key={s.key} className="block text-sm text-foreground">
                {draft['commission.type'] === 'percentage' ? 'Commission percentage' : 'Commission amount per item'}
                <input className={fieldClass} inputMode="decimal" value={draft[s.key] as string} onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))} />
                <span className="mt-1 block text-xs text-muted-foreground">{draft['commission.type'] === 'percentage' ? 'From 0 to 100, at most 2 decimals.' : 'At most 2 decimals.'}</span>
              </label>
            ),
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-1 font-semibold text-foreground">Returns and refunds</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Customers can ask to return a delivered, fully paid order, or some of its items. A customer gets one request per order or item. Admins can open more.
        </p>
        <div className="space-y-4">
          {items.filter((s) => s.group === 'returns').map((s) =>
            s.type === 'boolean' ? (
              <label key={s.key} className="flex items-start gap-2 text-sm text-foreground">
                <input type="checkbox" className="mt-1" checked={draft[s.key] as boolean} onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.checked }))} />
                <span>{s.label}<span className="block text-xs text-muted-foreground">{s.description}</span></span>
              </label>
            ) : (
              <label key={s.key} className="block text-sm text-foreground">
                {s.label}
                <input className={fieldClass} inputMode="numeric" value={draft[s.key] as string} onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))} />
                <span className="mt-1 block text-xs text-muted-foreground">{s.description}</span>
              </label>
            ),
          )}
        </div>
      </div>

      <button type="submit" disabled={saving} className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
        {saving ? 'Saving…' : 'Save settings'}
      </button>
    </form>
  );
}
