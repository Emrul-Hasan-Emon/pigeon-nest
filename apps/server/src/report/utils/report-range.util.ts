import { BadRequestException } from '@nestjs/common';
import { ReportGroup, ReportRangeDto } from '../dtos/report.dtos';

/** A report covers `from` (00:00) up to but not including `to` (00:00 of the day after the last day asked for). */
export interface ReportWindow {
  from: Date;
  to: Date;
  /** The first and last day, as people read them. */
  fromDay: string;
  toDay: string;
}

const MAX_DAYS = 366;
const DEFAULT_DAYS = 30;
const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function parseDay(value: string, field: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  // 2026-02-31 rolls over to March; refuse it instead of silently shifting the report.
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    throw new BadRequestException(`${field} is not a real date`);
  }
  return date;
}

export function resolveReportWindow(range: ReportRangeDto, now = new Date()): ReportWindow {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const last = range.to ? parseDay(range.to, 'to') : today;
  const first = range.from ? parseDay(range.from, 'from') : new Date(last.getFullYear(), last.getMonth(), last.getDate() - (DEFAULT_DAYS - 1));
  if (first > last) throw new BadRequestException('The start date must not be after the end date');
  const days = Math.round((last.getTime() - first.getTime()) / 86_400_000) + 1;
  if (days > MAX_DAYS) throw new BadRequestException(`Pick at most ${MAX_DAYS} days at a time`);
  return {
    from: first,
    to: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
    fromDay: dayKey(first),
    toDay: dayKey(last),
  };
}

/** Every day (or month) of the window, oldest first, so a quiet day still shows as a zero row. */
export function windowBuckets(w: ReportWindow, group: ReportGroup): string[] {
  const keys: string[] = [];
  if (group === ReportGroup.MONTH) {
    const cursor = new Date(w.from.getFullYear(), w.from.getMonth(), 1);
    while (cursor < w.to) {
      keys.push(`${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return keys;
  }
  const cursor = new Date(w.from);
  while (cursor < w.to) {
    keys.push(dayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

/** The to_char pattern that matches `windowBuckets`. */
export const bucketFormat = (group: ReportGroup) => (group === ReportGroup.MONTH ? 'YYYY-MM' : 'YYYY-MM-DD');
