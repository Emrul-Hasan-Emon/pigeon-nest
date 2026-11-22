import { DashboardRange } from '../dtos/dashboard.dtos';

export type Bucket = 'day' | 'month';

/** The period a dashboard covers and the equal period before it. Local time, like the stored timestamps. */
export interface DashboardWindow {
  range: DashboardRange;
  bucket: Bucket;
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
}

const DAYS: Record<string, number> = { [DashboardRange.WEEK]: 7, [DashboardRange.MONTH]: 30, [DashboardRange.QUARTER]: 90 };

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function resolveWindow(range: DashboardRange = DashboardRange.MONTH, now = new Date()): DashboardWindow {
  const to = now;
  if (range === DashboardRange.YEAR) {
    const from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    return { range, bucket: 'month', from, to, prevFrom: new Date(from.getFullYear(), from.getMonth() - 12, 1), prevTo: from };
  }
  const days = DAYS[range];
  const first = startOfDay(now);
  const from = new Date(first.getFullYear(), first.getMonth(), first.getDate() - (days - 1));
  return { range, bucket: 'day', from, to, prevFrom: new Date(from.getFullYear(), from.getMonth(), from.getDate() - days), prevTo: from };
}

const pad = (n: number) => String(n).padStart(2, '0');
const key = (d: Date, bucket: Bucket) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${bucket === 'month' ? '01' : pad(d.getDate())}`;

/** Every bucket key from the window's start to now, oldest first, so empty days still show as zero. */
export function bucketKeys(w: DashboardWindow): string[] {
  const keys: string[] = [];
  const cursor = new Date(w.from);
  while (cursor <= w.to) {
    keys.push(key(cursor, w.bucket));
    if (w.bucket === 'month') cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

/** Percent change from `before` to `now`, one decimal. Null when there is nothing to compare to. */
export function percentChange(now: number, before: number): number | null {
  if (!before) return null;
  return Math.round(((now - before) / before) * 1000) / 10;
}
