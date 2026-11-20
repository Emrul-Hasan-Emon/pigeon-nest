'use client';

import { useMemo, useState } from 'react';
import type { Country } from '@/types/shipping';

/** Tick countries from the full list; chips on top show what is chosen. */
export function CountryPicker({
  countries,
  selected,
  onChange,
}: {
  countries: Country[];
  selected: string[];
  onChange: (codes: string[]) => void;
}) {
  const [filter, setFilter] = useState('');
  const chosen = useMemo(() => new Set(selected), [selected]);
  const names = useMemo(() => new Map(countries.map((c) => [c.code, c.name])), [countries]);
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? countries.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q) : countries;
  }, [countries, filter]);

  function toggle(code: string) {
    onChange(chosen.has(code) ? selected.filter((c) => c !== code) : [...selected, code]);
  }
  function addShown() {
    onChange([...new Set([...selected, ...shown.map((c) => c.code)])]);
  }

  return (
    <div className="mt-1 rounded-md border border-input">
      <div className="flex flex-wrap gap-1.5 border-b border-input p-2">
        {selected.length === 0 && <span className="text-xs text-muted-foreground">No country chosen yet.</span>}
        {selected.map((code) => (
          <span key={code} className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs text-accent-foreground">
            {names.get(code) ?? code}
            <button type="button" aria-label={`Remove ${names.get(code) ?? code}`} onClick={() => toggle(code)} className="hover:text-destructive">✕</button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2 border-b border-input p-2">
        <input
          type="text"
          placeholder="Search countries…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full rounded-md border border-input px-3 py-1.5 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
        />
        <button type="button" onClick={addShown} className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">Add shown</button>
        <button type="button" onClick={() => onChange([])} className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">Clear</button>
      </div>
      <ul className="max-h-56 overflow-auto p-1">
        {shown.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No country matches.</li>}
        {shown.map((c) => (
          <li key={c.code}>
            <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
              <input type="checkbox" checked={chosen.has(c.code)} onChange={() => toggle(c.code)} />
              <span className="flex-1">{c.name}</span>
              <span className="text-xs text-muted-foreground">{c.code}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
