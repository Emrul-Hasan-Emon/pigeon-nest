'use client';

import { useEffect, useState } from 'react';
import { listCountries, quoteShipping } from '@/lib/api/shipping';
import { ApiError } from '@/lib/api/http';
import { DELIVERY_TYPES, type Country, type DeliveryType, type ShippingQuote } from '@/types/shipping';

const selectClass =
  'rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none';

/** "What would delivery to X cost?" — shows which zone, or the default, answers. */
export function QuoteChecker() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [country, setCountry] = useState('');
  const [type, setType] = useState<DeliveryType>('standard');
  const [quote, setQuote] = useState<ShippingQuote | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCountries().then(setCountries).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!country) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    quoteShipping(country, type)
      .then((q) => !cancelled && setQuote(q))
      .catch((e) => !cancelled && setError(e instanceof ApiError ? e.message : 'Could not check that.'));
    return () => {
      cancelled = true;
    };
  }, [country, type]);

  return (
    <div className="mb-5 rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold text-foreground">Check a destination</h2>
      <div className="flex flex-wrap items-center gap-3">
        <select aria-label="Country" value={country} onChange={(e) => { setCountry(e.target.value); setQuote(null); }} className={selectClass}>
          <option value="">Choose a country…</option>
          {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <select aria-label="Delivery type" value={type} onChange={(e) => setType(e.target.value as DeliveryType)} className={selectClass}>
          {DELIVERY_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        {error && <span className="text-sm text-destructive">{error}</span>}
        {country && quote && !error && (
          <p className="text-sm text-foreground" aria-live="polite">
            <span className="font-semibold">{quote.charge}</span> · {quote.estimatedDays} days · live birds {quote.supportsLiveAnimal ? 'allowed' : 'not allowed'} ·{' '}
            <span className="text-muted-foreground">{quote.source === 'zone' ? `zone “${quote.zone?.name}”` : 'global default (no zone covers this)'}</span>
          </p>
        )}
      </div>
    </div>
  );
}
