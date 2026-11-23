'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, CircleCheck, Feather } from 'lucide-react';
import { money } from '@/components/orders/ui';
import type { DashboardPoint, DashboardRange, DashboardStatusCount } from '@/types/dashboard';

export const taka = (n: number) => `৳${money(n)}`;

const RANGES: { value: DashboardRange; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '12m', label: '12 months' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function labelFor(date: string, bucket: 'day' | 'month') {
  const [y, m, d] = date.split('-').map(Number);
  return bucket === 'month' ? `${MONTHS[m - 1]} ${y}` : `${d} ${MONTHS[m - 1]}`;
}

/** "25 Oct – 23 Nov": the exact dates a period covers, so "30 days" is never ambiguous. */
export function rangeLabel(from: string, to: string) {
  const a = new Date(from);
  const b = new Date(to);
  const day = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return a.getFullYear() === b.getFullYear() ? `${day(a)} – ${day(b)}` : `${day(a)} ${a.getFullYear()} – ${day(b)} ${b.getFullYear()}`;
}

export function RangeTabs({ value, onChange }: { value: DashboardRange; onChange: (range: DashboardRange) => void }) {
  return (
    <div role="tablist" aria-label="Period" className="inline-flex rounded-lg border border-border bg-card p-0.5 text-sm">
      {RANGES.map((r) => (
        <button
          key={r.value}
          role="tab"
          aria-selected={value === r.value}
          onClick={() => onChange(r.value)}
          className={`rounded-md px-3 py-1.5 font-medium transition-colors ${value === r.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

/** The page's title row: the title, what it is, the exact period, and the period switch. */
export function DashboardHeader({ title, subtitle, guideHref, period, range, onRange }: { title: string; subtitle: string; guideHref: string; period: string; range: DashboardRange; onRange: (r: DashboardRange) => void }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[2rem] leading-tight text-foreground">{title}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {subtitle} <Link href={guideHref} className="text-primary hover:underline">What do these figures mean?</Link>
        </p>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <RangeTabs value={range} onChange={onRange} />
        <span className="text-xs text-muted-foreground">{period}</span>
      </div>
    </div>
  );
}

export function Panel({ title, note, children, className = '', action }: { title: string; note?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={`rounded-xl border border-border bg-card p-6 shadow-sm ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
          {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** How a figure moved against the period before. Says nothing when there is nothing to compare. */
export function Change({ value, lowerIsBetter = false, dark = false }: { value: number | null | undefined; lowerIsBetter?: boolean; dark?: boolean }) {
  if (value === null || value === undefined) return null;
  const up = value > 0;
  const down = value < 0;
  const good = lowerIsBetter ? down : up;
  const bad = lowerIsBetter ? up : down;
  const tone = good ? (dark ? 'text-emerald-400' : 'text-emerald-600') : bad ? (dark ? 'text-red-400' : 'text-red-600') : '';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${tone}`}>
      {up ? '▲' : down ? '▼' : '–'} {Math.abs(value)}%
      <span className={`font-normal ${dark ? 'text-topbar-foreground/50' : 'text-muted-foreground'}`}>vs before</span>
    </span>
  );
}

export interface Stat {
  label: string;
  value: string;
  change?: number | null;
  hint?: string;
  lowerIsBetter?: boolean;
  tone?: 'good' | 'warn' | 'bad';
}

const STAT_TONE = { good: 'text-emerald-600', warn: 'text-amber-600', bad: 'text-red-600' };

/**
 * Several related figures in one card, split by hairlines, instead of one bordered card each. Groups the page
 * into a few readable bands (orders, commission, people) so no single small figure competes with the lead.
 */
export function StatStrip({ title, stats, className = '' }: { title?: string; stats: Stat[]; className?: string }) {
  const cols = stats.length >= 4 ? 'sm:grid-cols-4' : stats.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';
  return (
    <section className={`overflow-hidden rounded-xl border border-border bg-border shadow-sm ${className}`}>
      {title && <h2 className="border-b border-border bg-card px-5 pt-4 pb-3 text-sm font-semibold text-foreground">{title}</h2>}
      <div className={`grid grid-cols-2 gap-px ${cols}`}>
        {stats.map((s) => (
          <div key={s.label} className="bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`mt-1.5 font-[family-name:var(--figure-font,var(--font-display))] text-[1.7rem] font-semibold tracking-tight ${s.tone ? STAT_TONE[s.tone] : 'text-foreground'}`}>{s.value}</p>
            <div className="mt-1 min-h-4 text-xs text-muted-foreground">{s.change !== undefined && s.change !== null ? <Change value={s.change} lowerIsBetter={s.lowerIsBetter} /> : s.hint}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The lead figure of a page: dark, large, with what it changed by, a sparkline of the period and the figures it is made of. */
export function HeroKpi({ label, value, change, support, note, spark }: { label: string; value: string; change: number | null; support: { label: string; value: string }[]; note?: string; spark?: number[] }) {
  return (
    <div className="hero-kpi relative flex flex-col justify-between overflow-hidden rounded-2xl bg-topbar p-7 text-topbar-foreground shadow-md">
      <Feather aria-hidden="true" strokeWidth={0.6} className="hero-feather pointer-events-none absolute -bottom-10 -right-8 hidden h-64 w-64 -rotate-12 text-white/[0.07]" />
      <div className="relative">
        <p className="text-sm text-topbar-foreground/60">{label}</p>
        <p className={`mt-3 ${FIG_HERO} text-[2.6rem] font-medium leading-none tracking-tight text-white xl:text-[3.4rem]`}>{value}</p>
        <div className="mt-3 min-h-5">{change === null ? <span className="text-xs text-topbar-foreground/50">{note}</span> : <Change value={change} dark />}</div>
      </div>
      {spark && spark.some((n) => n > 0) && <Sparkline values={spark} />}
      <dl className="relative mt-6 space-y-3 border-t border-white/10 pt-4">
        {support.map((s) => (
          <div key={s.label} className="flex items-baseline justify-between gap-4">
            <dt className="text-sm text-topbar-foreground/60">{s.label}</dt>
            <dd className="text-base font-semibold text-white">{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const FIG_HERO = 'font-[family-name:var(--figure-font,var(--font-display))]';

/** The shape of the period at a glance: a thin line with a soft fill, no axes. The chart beside it has the figures. */
function Sparkline({ values }: { values: number[] }) {
  const W = 240;
  const H = 44;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? W / (values.length - 1) : W;
  const pts = values.map((v, i) => [i * step, H - 3 - (v / max) * (H - 8)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="relative mt-5 h-11 w-full">
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="hsl(var(--signal))" stopOpacity="0.35" />
          <stop offset="1" stopColor="hsl(var(--signal))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${W} ${H} L0 ${H} Z`} fill="url(#spark-fill)" />
      <path d={line} fill="none" stroke="hsl(var(--signal))" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** A tidy axis maximum (1, 2, 2.5, 5 or 10 times a power of ten) so the grid lines carry round figures. */
function niceMax(n: number) {
  if (n <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(n)));
  const f = n / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp;
}

/**
 * Sales per day (or month): a brass bar for sales and a thin red one beside it for refunds, with grid lines and a
 * readout that follows the pointer. Move over the chart for the exact figures of a day.
 */
export function SalesChart({ series, bucket }: { series: DashboardPoint[]; bucket: 'day' | 'month' }) {
  const [hover, setHover] = useState<number | null>(null);
  const top = niceMax(Math.max(0, ...series.map((p) => p.grossSales)));
  const W = 600;
  const H = 180;
  const slot = W / series.length;
  const bar = Math.max(1.5, slot * 0.58);
  const empty = series.every((p) => p.grossSales === 0 && p.refunds === 0);
  const shown = hover !== null ? series[hover] : null;
  const ticks = series.length <= 7 ? series.map((_, i) => i) : [0, 1, 2, 3, 4].map((k) => Math.round((k * (series.length - 1)) / 4));

  return (
    <div>
      <div className="flex min-h-9 items-start justify-between gap-4 text-xs text-muted-foreground">
        <div aria-live="polite">
          {shown ? (
            <>
              <span className="font-medium text-foreground">{labelFor(shown.date, bucket)}</span>
              <span className="mx-1.5">·</span>
              {taka(shown.grossSales)} sales
              <span className="mx-1.5">·</span>
              {taka(shown.refunds)} refunds
              <span className="mx-1.5">·</span>
              {shown.orders} {shown.orders === 1 ? 'order' : 'orders'}
            </>
          ) : (
            'Move over the chart for the figures of a day.'
          )}
        </div>
        <span className="flex shrink-0 items-center gap-3">
          <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm bg-gold" /> Sales</span>
          <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm bg-rose-400" /> Refunds</span>
        </span>
      </div>

      <div className="relative mt-1 pl-12">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex w-10 flex-col justify-between pb-0.5 text-right text-[11px] text-muted-foreground">
          <span>{empty ? '' : taka(top)}</span>
          <span>{empty ? '' : taka(top / 2)}</span>
          <span>0</span>
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Sales and refunds over time"
          className="h-44 w-full"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setHover(Math.min(series.length - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * series.length))));
          }}
        >
          {[0, 0.5, 1].map((g) => (
            <line key={g} x1="0" x2={W} y1={g * (H - 1) + 0.5} y2={g * (H - 1) + 0.5} className={g === 1 ? 'stroke-border' : 'stroke-border/70'} strokeDasharray={g === 1 ? undefined : '3 4'} vectorEffect="non-scaling-stroke" />
          ))}
          {hover !== null && <rect x={hover * slot} y="0" width={slot} height={H} className="fill-gold-soft" opacity="0.7" />}
          {series.map((p, i) => {
            const h = (p.grossSales / top) * (H - 4);
            const r = (p.refunds / top) * (H - 4);
            const x = i * slot + (slot - bar) / 2;
            return (
              <g key={p.date}>
                {h > 0 && <rect x={x} y={H - h} width={bar} height={h} rx="1.5" className="fill-gold" />}
                {r > 0 && <rect x={x + bar * 0.55} y={H - r} width={bar * 0.45} height={r} rx="1" className="fill-rose-400" />}
              </g>
            );
          })}
        </svg>
        <div className="relative mt-1.5 h-4 text-[11px] text-muted-foreground">
          {ticks.map((i, k) => (
            <span key={i} className="absolute whitespace-nowrap" style={{ left: `${((i + 0.5) / series.length) * 100}%`, transform: k === 0 ? 'translateX(-10%)' : k === ticks.length - 1 ? 'translateX(-90%)' : 'translateX(-50%)' }}>
              {labelFor(series[i].date, bucket)}
            </span>
          ))}
        </div>
      </div>
      {empty && <p className="mt-2 text-center text-sm text-muted-foreground">No sales in this period yet.</p>}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500',
  confirmed: 'bg-sky-600',
  packed: 'bg-indigo-500',
  shipped: 'bg-violet-500',
  delivered: 'bg-teal-600',
  cancelled: 'bg-rose-400',
};

export function StatusBars({ items }: { items: DashboardStatusCount[] }) {
  const total = items.reduce((n, i) => n + i.count, 0);
  if (total === 0) return <p className="text-sm text-muted-foreground">No orders in this period.</p>;
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label="Orders by status">
        {items.filter((i) => i.count > 0).map((i) => (
          <div key={i.status} className={STATUS_COLORS[i.status] ?? 'bg-primary'} style={{ width: `${(i.count / total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-4 space-y-2">
        {items.map((i) => (
          <li key={i.status} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 capitalize text-foreground">
              <i className={`inline-block h-2 w-2 rounded-full ${STATUS_COLORS[i.status] ?? 'bg-primary'} ${i.count === 0 ? 'opacity-30' : ''}`} />
              <span className={i.count === 0 ? 'text-muted-foreground' : ''}>{i.status}</span>
            </span>
            <span className="tabular-nums text-muted-foreground">
              {i.count}
              {i.count > 0 && <span className="ml-2 text-xs">{Math.round((i.count / total) * 100)}%</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface TodoItem {
  label: string;
  count: number;
  href: string;
  tone?: 'warn' | 'bad';
}

/** Work waiting right now. Items at zero are hidden. */
export function Todo({ items }: { items: TodoItem[] }) {
  const open = items.filter((i) => i.count > 0);
  if (open.length === 0) {
    return (
      <div className="rounded-lg bg-accent px-4 py-5 text-center text-sm text-accent-foreground">
        <p className="font-medium">All caught up</p>
        <p className="mt-0.5 opacity-80">Nothing is waiting for you.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {open.map((i) => (
        <li key={i.label}>
          <Link href={i.href} className="flex items-center justify-between py-2.5 text-sm hover:text-primary">
            <span className="text-foreground">{i.label}</span>
            <span className={`min-w-8 rounded-full px-2 py-0.5 text-center text-xs font-semibold ${i.tone === 'bad' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{i.count}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * "What to do now" as big, plain buttons: the number waiting, what it is, and one tap to go there. Meant for people who
 * are not at ease with software, so it comes before any figure. Nothing waiting shows a calm "all done" instead.
 */
export function ActionTiles({ items }: { items: TodoItem[] }) {
  const open = items.filter((i) => i.count > 0);
  return (
    <section aria-label="What to do now">
      <h2 className="mb-3 font-[family-name:var(--font-serif)] text-2xl font-medium tracking-tight text-foreground">What to do now</h2>
      {open.length === 0 ? (
        <div className="flex items-center gap-4 rounded-2xl bg-accent px-6 py-5 text-accent-foreground">
          <CircleCheck aria-hidden="true" className="h-9 w-9 shrink-0" strokeWidth={1.75} />
          <div>
            <p className="text-lg font-semibold">All done for now</p>
            <p className="mt-0.5">Nothing is waiting for you.</p>
          </div>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {open.map((i) => (
            <li key={i.label}>
              <Link href={i.href} className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition-[border-color,box-shadow] hover:border-ring/50 hover:shadow-md">
                <span className={`grid h-14 min-w-14 shrink-0 place-items-center rounded-xl px-2 font-[family-name:var(--font-serif)] text-2xl font-semibold ${i.tone === 'bad' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{i.count}</span>
                <span className="flex-1 text-base font-medium leading-snug text-foreground">{i.label}</span>
                <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** A ranked list. The position is shown because the order is the point. */
export function Ranking({ rows, empty }: { rows: { key: string | number; name: string; detail: string; amount: number; href?: string }[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.amount), 1);
  return (
    <ol className="space-y-3.5">
      {rows.map((r, i) => (
        <li key={r.key} className="flex gap-3 text-sm">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold-soft text-[11px] font-semibold text-gold-ink">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              {r.href ? <Link href={r.href} className="truncate font-medium text-foreground hover:text-primary">{r.name}</Link> : <span className="truncate font-medium text-foreground">{r.name}</span>}
              <span className="shrink-0 tabular-nums text-foreground">{taka(r.amount)}</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-gold" style={{ width: `${(r.amount / max) * 100}%` }} /></div>
            <p className="mt-1 text-xs text-muted-foreground">{r.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Definition() {
  return (
    <p className="text-xs text-muted-foreground">
      Sales are fully paid orders that are not cancelled, counted on the day they were placed. Refunds are returns confirmed in the period. Net = sales minus refunds.
    </p>
  );
}
