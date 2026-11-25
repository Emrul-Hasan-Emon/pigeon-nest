import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/format/money.dart';
import '../../../shared/widgets/app_card.dart';
import '../data/report_models.dart';

/// Shows a figure the way its kind says: money with a dollar sign, a percent, hours, a plain number.
String reportValue(String kind, Object? value) {
  if (value == null) return '-';
  if (value is! num) return value.toString();
  return switch (kind) {
    'money' => formatUsd(value),
    'percent' => '${_plain(value)}%',
    'hours' => '${_plain(value)} h',
    _ => _plain(value),
  };
}

String _plain(num v) => v % 1 == 0 ? v.toInt().toString() : v.toStringAsFixed(2);

/// One report: its summary figures, the plain-words note, and a card per row.
class ReportView extends StatelessWidget {
  const ReportView({super.key, required this.report});
  final Report report;

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text('${report.from} to ${report.to}', style: const TextStyle(color: AppTheme.neutral)),
        const SizedBox(height: AppSpacing.s),
        AppCard(
          child: Column(children: [
            for (final f in report.summary)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(children: [Expanded(child: Text(f.label)), Text(reportValue(f.kind, f.value), style: const TextStyle(fontWeight: FontWeight.w800))]),
              ),
          ]),
        ),
        const SizedBox(height: AppSpacing.s),
        Text(report.note, style: const TextStyle(color: AppTheme.neutral, fontSize: 13)),
        const SizedBox(height: AppSpacing.m),
        if (report.rows.isEmpty) const Padding(padding: EdgeInsets.all(AppSpacing.l), child: Center(child: Text('Nothing in these dates.', style: TextStyle(color: AppTheme.neutral)))),
        for (final row in report.rows)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.s),
            child: AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(reportValue(report.columns.first.kind, row[report.columns.first.key]), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                const SizedBox(height: AppSpacing.xs),
                for (final c in report.columns.skip(1))
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: Row(children: [Expanded(child: Text(c.label, style: const TextStyle(color: AppTheme.neutral))), Text(reportValue(c.kind, row[c.key]), style: const TextStyle(fontWeight: FontWeight.w600))]),
                  ),
              ]),
            ),
          ),
      ]);
}
