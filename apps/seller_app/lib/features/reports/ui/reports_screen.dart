import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../data/reports_api.dart';
import 'report_view.dart';

const _reports = [('Sales', 'sales'), ('Orders', 'orders'), ('Products', 'products'), ('What I earn', 'earnings'), ('Returns', 'returns')];
const _ranges = [('7 days', 7), ('30 days', 30), ('90 days', 90), ('1 year', 365)];

/// The options a report has: how to group it, which products to list, or what returns are grouped by.
const _options = <String, List<(String, String)>>{
  'sales': [('By day', 'day'), ('By month', 'month')],
  'earnings': [('By day', 'day'), ('By month', 'month')],
  'products': [('Best sellers', 'best'), ('Slow sellers', 'slow'), ('Low stock', 'low')],
  'returns': [('By reason', 'reason'), ('By product', 'product')],
};

String _day(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

class ReportsScreen extends ConsumerStatefulWidget {
  const ReportsScreen({super.key});

  @override
  ConsumerState<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends ConsumerState<ReportsScreen> {
  String _report = 'sales';
  int _days = 30;
  String? _option;

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now();
    final options = _options[_report];
    final query = ReportQuery(
      report: _report,
      from: _day(today.subtract(Duration(days: _days - 1))),
      to: _day(today),
      option: options == null ? null : (_option ?? options.first.$2),
    );
    final data = ref.watch(reportProvider(query));
    Widget chips<T>(List<(String, T)> items, T selected, ValueChanged<T> onTap) => SizedBox(
          height: 44,
          child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m), children: [
            for (final (label, value) in items)
              Padding(padding: const EdgeInsets.only(right: AppSpacing.s), child: ChoiceChip(label: Text(label), selected: selected == value, onSelected: (_) => onTap(value))),
          ]),
        );
    return Scaffold(
      appBar: AppBar(title: const Text('Reports')),
      body: Column(children: [
        const SizedBox(height: AppSpacing.s),
        chips(_reports, _report, (v) => setState(() {
              _report = v;
              _option = null;
            })),
        chips(_ranges.map((r) => (r.$1, r.$2)).toList(), _days, (v) => setState(() => _days = v)),
        if (options != null) chips(options, query.option!, (v) => setState(() => _option = v)),
        Expanded(
          child: data.when(
            loading: () => const LoadingView(),
            error: (e, _) => ErrorView(message: ApiException.from(e).message, onRetry: () => ref.invalidate(reportProvider(query))),
            data: (r) => RefreshIndicator(
              onRefresh: () => ref.refresh(reportProvider(query).future).then((_) {}),
              child: ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.all(AppSpacing.m), children: [
                Text(r.title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: AppTheme.ink)),
                const SizedBox(height: AppSpacing.s),
                ReportView(report: r),
              ]),
            ),
          ),
        ),
      ]),
    );
  }
}
