'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createZone, listCountries, updateZone } from '@/lib/api/shipping';
import { ApiError } from '@/lib/api/http';
import { useToast } from '@/components/ui/toast';
import { DELIVERY_TYPES, type Country, type DeliveryType, type ShippingZone } from '@/types/shipping';
import { CountryPicker } from './country-picker';

const fieldClass =
  'mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none';

export function ZoneForm({ zone }: { zone?: ShippingZone }) {
  const router = useRouter();
  const { showToast } = useToast();
  const isEdit = zone !== undefined;

  const [countries, setCountries] = useState<Country[]>([]);
  const [name, setName] = useState(zone?.name ?? '');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>(zone?.deliveryType ?? 'standard');
  const [codes, setCodes] = useState<string[]>(zone?.countryCodes ?? []);
  const [charge, setCharge] = useState(zone ? String(zone.charge) : '');
  const [days, setDays] = useState(zone ? String(zone.estimatedDays) : '');
  const [live, setLive] = useState(zone?.supportsLiveAnimal ?? true);
  const [isActive, setIsActive] = useState(zone?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listCountries()
      .then(setCountries)
      .catch(() => showToast('Failed to load countries.', 'error'));
  }, [showToast]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Name is required.');
    if (codes.length === 0) return setError('Choose at least one country.');
    const chargeNumber = Number(charge);
    if (charge.trim() === '' || !Number.isFinite(chargeNumber) || chargeNumber < 0 || Math.round(chargeNumber * 100) / 100 !== chargeNumber) {
      return setError('Charge must be an amount of 0 or more, with at most 2 decimals.');
    }
    const daysNumber = Number(days);
    if (days.trim() === '' || !Number.isInteger(daysNumber) || daysNumber < 0 || daysNumber > 365) {
      return setError('Delivery time must be a whole number of days from 0 to 365.');
    }

    const payload = {
      name: name.trim(),
      deliveryType,
      countryCodes: codes,
      charge: chargeNumber,
      estimatedDays: daysNumber,
      supportsLiveAnimal: live,
      isActive,
    };
    setSubmitting(true);
    try {
      if (isEdit) await updateZone(zone.id, payload);
      else await createZone(payload);
      showToast(isEdit ? 'Zone updated.' : 'Zone created.', 'success');
      router.push('/admin/settings/shipping-zones');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold text-foreground">{isEdit ? 'Edit shipping zone' : 'New shipping zone'}</h1>
      {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-card p-5 shadow-sm md:grid-cols-2">
        <label className="text-sm text-foreground">
          Name *
          <input className={fieldClass} value={name} maxLength={255} onChange={(e) => setName(e.target.value)} placeholder="e.g. South Asia" />
        </label>
        <label className="text-sm text-foreground">
          Delivery type
          <select className={fieldClass} value={deliveryType} onChange={(e) => setDeliveryType(e.target.value as DeliveryType)}>
            {DELIVERY_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </label>
        <label className="text-sm text-foreground">
          Delivery charge *
          <input className={fieldClass} inputMode="decimal" value={charge} onChange={(e) => setCharge(e.target.value)} />
        </label>
        <label className="text-sm text-foreground">
          Delivery time (days) *
          <input className={fieldClass} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
          Live birds can be shipped here
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active
        </label>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="text-sm font-medium text-foreground">Countries * <span className="font-normal text-muted-foreground">({codes.length} chosen)</span></p>
        <p className="text-xs text-muted-foreground">A country can belong to one active zone per delivery type.</p>
        <CountryPicker countries={countries} selected={codes} onChange={setCodes} />
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={submitting} className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {submitting ? 'Saving…' : isEdit ? 'Update zone' : 'Create zone'}
        </button>
        <Link href="/admin/settings/shipping-zones" className="rounded-md border border-border px-5 py-2 text-sm font-medium text-foreground hover:bg-muted">Cancel</Link>
      </div>
    </form>
  );
}
