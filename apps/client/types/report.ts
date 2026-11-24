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

/** Every report has this shape, so one screen and one CSV writer cover all of them. */
export interface Report {
  title: string;
  note: string;
  from: string;
  to: string;
  summary: ReportSummaryItem[];
  columns: ReportColumn[];
  rows: Record<string, string | number | null>[];
}

export type ReportName = 'sales' | 'products' | 'orders' | 'earnings' | 'returns' | 'sellers';
export type ReportGroup = 'day' | 'month';
export type ProductReportKind = 'best' | 'slow' | 'low';
export type ReturnReportBy = 'reason' | 'product' | 'seller';
export type SellerRankSort = 'sales' | 'orders' | 'rating' | 'returns';

export interface ReportParams {
  from: string;
  to: string;
  groupBy?: ReportGroup;
  kind?: ProductReportKind;
  by?: ReturnReportBy;
  sort?: SellerRankSort;
  sellerId?: number;
}
