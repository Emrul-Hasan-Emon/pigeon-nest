'use client';

import { useEffect, useMemo, useState } from 'react';
import { Coins, Download, Package, ReceiptText, Trophy, TrendingUp, Undo2 } from 'lucide-react';
import { money } from '@/components/orders/ui';
import { LoadingBlock } from '@/components/ui/skeleton';
import { downloadReportCsv } from '@/lib/csv';
import { ApiError } from '@/lib/api/http';
import type { ProductReportKind, Report, ReportColumn, ReportGroup, ReportKind, ReportName, ReportParams, ReturnReportBy, SellerRankSort } from '@/types/report';

const pad = (n: number) => String(n).padStart(2, '0');
const dayInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

const PRESETS: { label: string; range: () => [string, string] }[] = [
  { label: 'Last 7 days', range: () => [dayInput(daysAgo(6)), dayInput(new Date())] },
  { label: 'Last 30 days', range: () => [dayInput(daysAgo(29)), dayInput(new Date())] },
  {
    label: 'This month',
    range: () => {
      const n = new Date();
      return [dayInput(new Date(n.getFullYear(), n.getMonth(), 1)), dayInput(n)];
    },
  },
  {
    label: 'Last month',
    range: () => {
      const n = new Date();
      return [dayInput(new Date(n.getFullYear(), n.getMonth() - 1, 1)), dayInput(new Date(n.getFullYear(), n.getMonth(), 0))];
    },
  },
  {
    label: 'This year',
    range: () => {
      const n = new Date();
      return [dayInput(new Date(n.getFullYear(), 0, 1)), dayInput(n)];
    },
  },
];

const PRODUCT_KINDS: { value: ProductReportKind; label: string; hint: string }[] = [
  { value: 'best', label: 'Best sellers', hint: 'What earned the most' },
  { value: 'slow', label: 'Slow sellers', hint: 'What sold least' },
  { value: 'low', label: 'Low stock', hint: 'What is running out' },
];

const RETURN_BYS: { value: ReturnReportBy; label: string; hint: string; adminOnly?: boolean }[] = [
  { value: 'reason', label: 'By reason', hint: 'Why birds come back' },
  { value: 'product', label: 'By product', hint: 'Which products come back most' },
  { value: 'seller', label: 'By seller', hint: 'Which sellers have most returns', adminOnly: true },
];

const RANK_SORTS: { value: SellerRankSort; label: string }[] = [
  { value: 'sales', label: 'Most sales' },
  { value: 'orders', label: 'Most orders' },
  { value: 'rating', label: 'Best rated' },
  { value: 'returns', label: 'Most returns' },
];

function show(value: string | number | null, kind: ReportKind) {
  if (value === null || value === '') return '—';
  if (kind === 'money') return `৳${money(Number(value))}`;
  if (kind === 'number') return Number(value).toLocaleString();
  if (kind === 'percent') return `${value}%`;
  if (kind === 'hours') return `${value} hours`;
  return String(value);
}

const alignRight = (c: ReportColumn) => c.kind !== 'text';

export interface ReportViewProps {
  /** The seller portal says "My products" and "What I earn"; the admin says "Products" and "Earnings". */
  mine: boolean;
  load: (name: ReportName, params: ReportParams) => Promise<Report>;
  /** The admin can narrow every report to one seller. */
  sellers?: { id: number; name: string }[];
  fileBase: string;
}

/** Four plain reports on one screen: pick the report and the dates, read it, or download it as a CSV file. */
export function ReportView({ mine, load, sellers, fileBase }: ReportViewProps) {
  const [name, setName] = useState<ReportName>('sales');
  const [preset, setPreset] = useState(1);
  const [[from, to], setDates] = useState<[string, string]>(() => PRESETS[1].range());
  const [groupBy, setGroupBy] = useState<ReportGroup>('day');
  const [kind, setKind] = useState<ProductReportKind>('best');
  const [by, setBy] = useState<ReturnReportBy>('reason');
  const [sort, setSort] = useState<SellerRankSort>('sales');
  const [sellerId, setSellerId] = useState<number | undefined>(undefined);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tabs: { key: ReportName; label: string; hint: string; icon: typeof Package }[] = [
    { key: 'sales', label: 'Sales', hint: 'Money coming in', icon: TrendingUp },
    { key: 'products', label: mine ? 'My products' : 'Products', hint: 'Best, slow and low stock', icon: Package },
    { key: 'orders', label: 'Orders', hint: 'Where orders are', icon: ReceiptText },
    { key: 'earnings', label: mine ? 'What I earn' : 'Earnings', hint: 'After system commission and refunds', icon: Coins },
    { key: 'returns', label: 'Returns', hint: 'Why birds come back', icon: Undo2 },
    ...(mine ? [] : [{ key: 'sellers' as const, label: 'Seller ranking', hint: 'Who sells and returns most', icon: Trophy }]),
  ];

  const params = useMemo<ReportParams>(
    () => ({
      from,
      to,
      groupBy: name === 'sales' || name === 'earnings' ? groupBy : undefined,
      kind: name === 'products' ? kind : undefined,
      by: name === 'returns' ? by : undefined,
      sort: name === 'sellers' ? sort : undefined,
      // The ranking lists every seller, so it has no seller choice.
      sellerId: name === 'sellers' ? undefined : sellerId,
    }),
    [from, to, groupBy, kind, by, sort, name, sellerId],
  );
  // The dates do not change low stock: it is how things stand now.
  const datesMatter = !(name === 'products' && kind === 'low');

  useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    load(name, params)
      .then((r) => live && setReport(r))
      .catch((e) => {
        if (!live) return;
        setReport(null);
        setError(e instanceof ApiError ? e.message : 'Could not load the report.');
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [load, name, params]);

  const field = 'rounded-lg border border-border bg-card px-3 py-2 text-base text-foreground focus:border-foreground focus:outline-none';
  const pill = (on: boolean) =>
    `rounded-full border px-4 py-2 text-base font-medium transition-colors ${on ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-foreground hover:bg-muted'}`;

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Reports" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tabs.map((t) => {
          const Icon = t.icon;
          const on = t.key === name;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setName(t.key)}
              className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${on ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-card hover:bg-muted'}`}
            >
              <Icon aria-hidden="true" className="h-6 w-6 shrink-0" />
              <span>
                <span className="block text-lg font-semibold">{t.label}</span>
                <span className="block text-sm text-muted-foreground">{t.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <section className="space-y-4 rounded-xl border border-border bg-card p-5" aria-label="Report options">
        {name === 'returns' && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="How to group returns">
            {RETURN_BYS.filter((b) => !b.adminOnly || !mine).map((b) => (
              <button key={b.value} type="button" className={pill(by === b.value)} aria-pressed={by === b.value} onClick={() => setBy(b.value)} title={b.hint}>
                {b.label}
              </button>
            ))}
          </div>
        )}
        {name === 'sellers' && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Rank sellers by">
            {RANK_SORTS.map((o) => (
              <button key={o.value} type="button" className={pill(sort === o.value)} aria-pressed={sort === o.value} onClick={() => setSort(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        )}
        {name === 'products' && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Which products">
            {PRODUCT_KINDS.map((k) => (
              <button key={k.value} type="button" className={pill(kind === k.value)} aria-pressed={kind === k.value} onClick={() => setKind(k.value)} title={k.hint}>
                {k.label}
              </button>
            ))}
          </div>
        )}
        {datesMatter && (
          <>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Quick dates">
              {PRESETS.map((p, i) => (
                <button
                  key={p.label}
                  type="button"
                  className={pill(preset === i)}
                  aria-pressed={preset === i}
                  onClick={() => {
                    setPreset(i);
                    setDates(p.range());
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <label className="text-sm text-muted-foreground">
                From
                <input
                  type="date"
                  className={`${field} mt-1 block`}
                  value={from}
                  max={to}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    setPreset(-1);
                    setDates([e.target.value, to]);
                  }}
                />
              </label>
              <label className="text-sm text-muted-foreground">
                To
                <input
                  type="date"
                  className={`${field} mt-1 block`}
                  value={to}
                  min={from}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    setPreset(-1);
                    setDates([from, e.target.value]);
                  }}
                />
              </label>
              {(name === 'sales' || name === 'earnings') && (
                <label className="text-sm text-muted-foreground">
                  Show one line for each
                  <select className={`${field} mt-1 block`} value={groupBy} onChange={(e) => setGroupBy(e.target.value as ReportGroup)}>
                    <option value="day">Day</option>
                    <option value="month">Month</option>
                  </select>
                </label>
              )}
              {sellers && name !== 'sellers' && (
                <label className="text-sm text-muted-foreground">
                  Seller
                  <select className={`${field} mt-1 block`} value={sellerId ?? ''} onChange={(e) => setSellerId(e.target.value ? Number(e.target.value) : undefined)}>
                    <option value="">All sellers</option>
                    {sellers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </>
        )}
        {!datesMatter && sellers && (
          <label className="block text-sm text-muted-foreground">
            Seller
            <select className={`${field} mt-1 block`} value={sellerId ?? ''} onChange={(e) => setSellerId(e.target.value ? Number(e.target.value) : undefined)}>
              <option value="">All sellers</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-base text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <LoadingBlock />
      ) : (
        report && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-[family-name:var(--font-serif)] text-2xl font-medium tracking-tight text-foreground">{report.title}</h2>
                <p className="text-base text-muted-foreground">
                  {datesMatter ? `${report.from} to ${report.to}` : 'Right now'}
                  {sellerId !== undefined && sellers ? ` · ${sellers.find((s) => s.id === sellerId)?.name ?? ''}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => downloadReportCsv(report, `${fileBase}-${name}${name === 'products' ? `-${kind}` : name === 'returns' ? `-${by}` : name === 'sellers' ? `-${sort}` : ''}-${report.from}-to-${report.to}.csv`)}
                disabled={report.rows.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Download aria-hidden="true" className="h-4 w-4" />
                Download CSV
              </button>
            </div>

            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {report.summary.map((s) => (
                <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                  <dt className="text-sm text-muted-foreground">{s.label}</dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{show(s.value, s.kind)}</dd>
                </div>
              ))}
            </dl>

            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              {report.rows.length === 0 ? (
                <p className="px-4 py-10 text-center text-base text-muted-foreground">Nothing to show for these dates.</p>
              ) : (
                <table className="w-full text-base">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-left text-sm text-muted-foreground">
                      {report.columns.map((c) => (
                        <th key={c.key} scope="col" className={`px-4 py-3 font-medium ${alignRight(c) ? 'text-right' : ''}`}>
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row, i) => (
                      <tr key={i} className="border-b border-border last:border-b-0">
                        {report.columns.map((c) => (
                          <td key={c.key} className={`px-4 py-2.5 ${alignRight(c) ? 'text-right tabular-nums' : ''}`}>
                            {show(row[c.key] ?? null, c.kind)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{report.note}</p>
          </>
        )
      )}
    </div>
  );
}
