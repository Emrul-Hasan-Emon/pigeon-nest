import type { Report, ReportKind } from '@/types/report';

/** One CSV cell. Quotes are doubled; cells starting with = + - @ get a leading apostrophe so a spreadsheet never runs them as a formula. */
function cell(value: string | number | null): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const plain = (value: string | number | null, kind: ReportKind) => (kind === 'text' ? value : value === null ? '' : value);

/** The report as CSV text: the headline numbers, a blank line, then the table. Numbers are plain, with no thousands commas. */
export function reportToCsv(report: Report): string {
  const lines: string[] = [];
  lines.push([report.title, `${report.from} to ${report.to}`].map(cell).join(','));
  for (const s of report.summary) lines.push([s.label, plain(s.value, s.kind)].map(cell).join(','));
  lines.push('');
  lines.push(report.columns.map((c) => cell(c.label)).join(','));
  for (const row of report.rows) lines.push(report.columns.map((c) => cell(plain(row[c.key] ?? null, c.kind))).join(','));
  return lines.join('\r\n');
}

/** Saves the report as a file. The byte-order mark makes Excel read Bengali and other non-English text correctly. */
export function downloadReportCsv(report: Report, fileName: string) {
  const blob = new Blob(['﻿', reportToCsv(report)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
