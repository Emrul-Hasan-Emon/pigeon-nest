/** How the screen and the CSV write a value. */
export type ReportKind = 'text' | 'number' | 'money' | 'percent' | 'hours';

export interface ReportColumn {
  key: string;
  label: string;
  kind: ReportKind;
}

export interface ReportSummaryItem {
  label: string;
  value: number | string | null;
  kind: ReportKind;
}

/**
 * Every report has the same shape: a few headline numbers and a table. One screen and one CSV writer can show all of
 * them, for admins and sellers alike.
 */
export interface Report {
  title: string;
  /** What the numbers mean, in plain words. */
  note: string;
  from: string;
  to: string;
  summary: ReportSummaryItem[];
  columns: ReportColumn[];
  rows: Record<string, string | number | null>[];
}
