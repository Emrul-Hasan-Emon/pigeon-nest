import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/format/money.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/key_value.dart';
import '../../../shared/widgets/loading_view.dart';
import '../../../shared/widgets/section_title.dart';
import '../data/reports_api.dart';

const _lines = [
  ('Sales', 'sales'),
  ('System commission', 'systemCommission'),
  ('Refunds', 'refunds'),
  ('Commission given back', 'systemCommissionGivenBack'),
  ('Net system commission', 'netSystemCommission'),
  ('You keep', 'youKeep'),
  ('Paid to the marketplace', 'paidToMarketplace'),
  ('Owed at the start', 'owedAtStart'),
  ('Owed at the end', 'owedAtEnd'),
];

String _month(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}';

/// The monthly statement: sales, commission, refunds, payments made, and what is owed.
class StatementsScreen extends ConsumerStatefulWidget {
  const StatementsScreen({super.key});

  @override
  ConsumerState<StatementsScreen> createState() => _StatementsScreenState();
}

class _StatementsScreenState extends ConsumerState<StatementsScreen> {
  DateTime _shown = DateTime(DateTime.now().year, DateTime.now().month);

  void _move(int months) => setState(() => _shown = DateTime(_shown.year, _shown.month + months));

  @override
  Widget build(BuildContext context) {
    final key = _month(_shown);
    final data = ref.watch(statementProvider(key));
    final isNow = _month(DateTime.now()) == key;
    return Scaffold(
      appBar: AppBar(title: const Text('Statements')),
      body: Column(children: [
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          IconButton(onPressed: () => _move(-1), icon: const Icon(Icons.chevron_left)),
          Text(key, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
          IconButton(onPressed: isNow ? null : () => _move(1), icon: const Icon(Icons.chevron_right)),
        ]),
        Expanded(
          child: data.when(
            loading: () => const LoadingView(),
            error: (e, _) => ErrorView(message: ApiException.from(e).message, onRetry: () => ref.invalidate(statementProvider(key))),
            data: (s) => ListView(padding: const EdgeInsets.all(AppSpacing.m), children: [
              AppCard(
                child: Column(children: [
                  KeyValue('Paid orders', '${(s.figures['paidOrders'] ?? 0).toInt()}'),
                  for (final (label, k) in _lines) KeyValue(label, formatUsd(s.figures[k] ?? 0), bold: k == 'youKeep' || k == 'owedAtEnd'),
                ]),
              ),
              _group('Orders', s.orders, (r) => ('${r['orderNumber']} · ${r['date']}', 'Sales ${formatUsd((r['amount'] as num?) ?? 0)}, commission ${formatUsd((r['systemCommission'] as num?) ?? 0)}', formatUsd((r['youKeep'] as num?) ?? 0))),
              _group('Refunds', s.refunds, (r) => ('${r['orderNumber'] ?? r['date'] ?? ''}', '${r['date'] ?? ''}', formatUsd((r['amount'] as num?) ?? 0))),
              _group('Payments to the marketplace', s.payments, (r) => ('${r['date']}', '${r['note'] ?? ''}', formatUsd((r['amount'] as num?) ?? 0))),
            ]),
          ),
        ),
      ]),
    );
  }

  Widget _group(String title, List<Map<String, dynamic>> rows, (String, String, String) Function(Map<String, dynamic>) read) {
    if (rows.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.m),
      child: AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SectionTitle(title),
          for (final r in rows)
            Builder(builder: (_) {
              final (top, sub, amount) = read(r);
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(top, style: const TextStyle(fontWeight: FontWeight.w600)), if (sub.isNotEmpty) Text(sub, style: const TextStyle(color: AppTheme.neutral, fontSize: 12))])),
                  Text(amount, style: const TextStyle(fontWeight: FontWeight.w700)),
                ]),
              );
            }),
        ]),
      ),
    );
  }
}
