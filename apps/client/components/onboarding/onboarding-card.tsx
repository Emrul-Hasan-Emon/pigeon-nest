'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, CircleCheck, Circle } from 'lucide-react';
import { getMyOnboarding } from '@/lib/api/onboarding';
import type { Onboarding } from '@/types/onboarding';

/** "Get your shop ready" on the seller dashboard: what is done, what is next. Gone once everything is done. */
export function OnboardingCard() {
  const [data, setData] = useState<Onboarding | null>(null);

  useEffect(() => {
    // If it cannot load the card is simply not shown; the dashboard works without it.
    getMyOnboarding().then(setData).catch(() => setData(null));
  }, []);

  if (!data || data.percent === 100) return null;
  const next = data.steps.find((s) => !s.done);

  return (
    <section aria-labelledby="onboarding-title" className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="onboarding-title" className="font-[family-name:var(--font-serif)] text-2xl font-medium tracking-tight text-foreground">
            Get your shop ready
          </h2>
          <p className="text-base text-muted-foreground">
            {data.done} of {data.total} steps done. A complete shop gets more buyers.
          </p>
        </div>
        {next && (
          <Link href={next.href} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:opacity-90">
            {next.label}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        )}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={data.percent} aria-label="Shop setup" className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${data.percent}%` }} />
        </div>
        <span className="w-12 text-right text-base font-semibold tabular-nums text-foreground">{data.percent}%</span>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {data.steps.map((s) => (
          <li key={s.key}>
            {s.done ? (
              <span className="flex items-center gap-2 rounded-lg px-3 py-2 text-base text-muted-foreground">
                <CircleCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
                <span className="line-through decoration-muted-foreground/40">{s.label}</span>
                <span className="sr-only">(done)</span>
              </span>
            ) : (
              <Link href={s.href} className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-base hover:bg-muted">
                <Circle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <span>
                  <span className="block font-semibold text-foreground">{s.label}</span>
                  <span className="block text-sm text-muted-foreground">{s.hint}</span>
                </span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
